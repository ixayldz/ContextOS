/**
 * Plugin Manager
 * Handles plugin lifecycle, loading, and hook execution
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve, normalize } from 'path';
import type {
    Plugin,
    PluginManifest,
    PluginState,
    PluginContext,
    PluginHooks,
    HookResult,
    InstallOptions,
    PluginTemplate,
} from './types.js';

/**
 * Plugin Manager - Core plugin system orchestrator
 */
export class PluginManager {
    private plugins: Map<string, PluginState> = new Map();
    private pluginsDir: string;
    private projectRoot: string;
    private storage: Map<string, Map<string, unknown>> = new Map();

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.pluginsDir = join(projectRoot, '.contextos', 'plugins');

        // Ensure plugins directory exists
        if (!existsSync(this.pluginsDir)) {
            mkdirSync(this.pluginsDir, { recursive: true });
        }
    }

    /**
     * Load all plugins from plugins directory
     */
    async loadAll(): Promise<{ loaded: string[]; errors: Array<{ name: string; error: string }> }> {
        const loaded: string[] = [];
        const errors: Array<{ name: string; error: string }> = [];

        if (!existsSync(this.pluginsDir)) {
            return { loaded, errors };
        }

        const entries = readdirSync(this.pluginsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const pluginPath = join(this.pluginsDir, entry.name);
            try {
                await this.loadPlugin(pluginPath);
                loaded.push(entry.name);
            } catch (error) {
                errors.push({
                    name: entry.name,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return { loaded, errors };
    }

    /**
     * Load a single plugin from path
     */
    async loadPlugin(pluginPath: string): Promise<Plugin> {
        // Validate plugin path stays within plugins directory (Fix N3: Path Traversal)
        const absolutePluginPath = resolve(pluginPath);
        const absolutePluginsDir = resolve(this.pluginsDir);
        const normalizedPlugin = normalize(absolutePluginPath);
        const normalizedPluginsDir = normalize(absolutePluginsDir);

        if (!normalizedPlugin.startsWith(normalizedPluginsDir)) {
            throw new Error(`Plugin path "${pluginPath}" is outside plugins directory`);
        }

        const manifestPath = join(pluginPath, 'package.json');

        if (!existsSync(manifestPath)) {
            throw new Error(`Plugin manifest not found: ${manifestPath}`);
        }

        const manifestContent = readFileSync(manifestPath, 'utf-8');

        let manifest: PluginManifest;
        try {
            manifest = JSON.parse(manifestContent);
        } catch (error) {
            throw new Error(
                `Failed to parse plugin manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}\n` +
                `The file may contain invalid JSON.`
            );
        }

        // Validate manifest
        if (!manifest.name || !manifest.version || !manifest.main) {
            throw new Error(`Invalid plugin manifest: missing name, version, or main`);
        }

        // Load plugin module
        const mainPath = join(pluginPath, manifest.main);
        if (!existsSync(mainPath)) {
            throw new Error(`Plugin main file not found: ${mainPath}`);
        }

        // Dynamic import
        const pluginModule = await import(`file://${resolve(mainPath)}`);
        const plugin: Plugin = pluginModule.default || pluginModule;

        // Validate plugin
        if (!plugin.name || !plugin.version) {
            throw new Error(`Invalid plugin: missing name or version`);
        }

        // Create plugin state
        const state: PluginState = {
            manifest,
            instance: plugin,
            enabled: true,
            path: pluginPath,
            loadedAt: new Date(),
        };

        this.plugins.set(plugin.name, state);

        // Activate plugin
        if (plugin.activate) {
            const context = this.createPluginContext(plugin.name);
            await plugin.activate(context);
        }

        return plugin;
    }

    /**
     * Unload a plugin
     */
    async unloadPlugin(name: string): Promise<boolean> {
        const state = this.plugins.get(name);
        if (!state) return false;

        // Deactivate if necessary
        if (state.instance.deactivate) {
            await state.instance.deactivate();
        }

        // Clear storage
        this.storage.delete(name);

        // Remove from registry
        this.plugins.delete(name);

        return true;
    }

    /**
     * Enable a disabled plugin
     */
    async enablePlugin(name: string): Promise<boolean> {
        const state = this.plugins.get(name);
        if (!state) return false;

        if (state.enabled) return true;

        state.enabled = true;

        if (state.instance.activate) {
            const context = this.createPluginContext(name);
            await state.instance.activate(context);
        }

        return true;
    }

    /**
     * Disable a plugin (keep loaded but inactive)
     */
    async disablePlugin(name: string): Promise<boolean> {
        const state = this.plugins.get(name);
        if (!state) return false;

        if (!state.enabled) return true;

        state.enabled = false;

        if (state.instance.deactivate) {
            await state.instance.deactivate();
        }

        return true;
    }

    /**
     * Install a plugin
     */
    async install(source: string, options: InstallOptions = {}): Promise<Plugin> {
        const targetDir = join(this.pluginsDir, source.split('/').pop() || source);

        if (existsSync(targetDir) && !options.force) {
            throw new Error(`Plugin already installed: ${source}`);
        }

        if (options.local) {
            // Copy from local path
            const sourcePath = resolve(source);
            if (!existsSync(sourcePath)) {
                throw new Error(`Source path not found: ${sourcePath}`);
            }

            // Simple copy (in production, use proper fs copy)
            if (options.force && existsSync(targetDir)) {
                rmSync(targetDir, { recursive: true });
            }
            mkdirSync(targetDir, { recursive: true });

            // Copy package.json and main file (Fix N5: JSON.parse without try-catch)
            let manifest: { main: string };
            try {
                const manifestContent = readFileSync(join(sourcePath, 'package.json'), 'utf-8');
                manifest = JSON.parse(manifestContent);
            } catch (error) {
                throw new Error(
                    `Failed to parse plugin manifest at ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
            writeFileSync(join(targetDir, 'package.json'), JSON.stringify(manifest, null, 2));

            const mainContent = readFileSync(join(sourcePath, manifest.main), 'utf-8');
            writeFileSync(join(targetDir, manifest.main), mainContent);
        } else {
            // TODO: Install from npm registry
            throw new Error('Remote plugin installation not yet implemented');
        }

        const plugin = await this.loadPlugin(targetDir);

        if (options.skipActivate) {
            await this.disablePlugin(plugin.name);
        }

        return plugin;
    }

    /**
     * Uninstall a plugin
     */
    async uninstall(name: string): Promise<boolean> {
        const state = this.plugins.get(name);
        if (!state) return false;

        await this.unloadPlugin(name);

        // Remove plugin directory
        if (existsSync(state.path)) {
            rmSync(state.path, { recursive: true });
        }

        return true;
    }

    /**
     * Get all loaded plugins
     */
    list(): PluginState[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get a specific plugin
     */
    get(name: string): PluginState | undefined {
        return this.plugins.get(name);
    }

    /**
     * Execute a hook across all enabled plugins
     */
    async executeHook<K extends keyof PluginHooks>(
        hookName: K,
        ...args: Parameters<NonNullable<PluginHooks[K]>>
    ): Promise<HookResult<ReturnType<NonNullable<PluginHooks[K]>>>> {
        const result: HookResult<ReturnType<NonNullable<PluginHooks[K]>>> = {
            modified: false,
            value: args[0] as ReturnType<NonNullable<PluginHooks[K]>>,
            pluginsExecuted: [],
            errors: [],
        };

        for (const [name, state] of this.plugins) {
            if (!state.enabled) continue;

            const hook = state.instance.hooks?.[hookName];
            if (!hook) continue;

            try {
                const hookFn = hook as (...args: unknown[]) => Promise<unknown> | unknown;
                const hookResult = await hookFn(...args);

                if (hookResult !== undefined) {
                    result.modified = true;
                    result.value = hookResult as ReturnType<NonNullable<PluginHooks[K]>>;
                    // Pass modified value to next plugin
                    args[0] = hookResult as Parameters<NonNullable<PluginHooks[K]>>[0];
                }

                result.pluginsExecuted.push(name);
            } catch (error) {
                result.errors.push({
                    plugin: name,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            }
        }

        return result;
    }

    /**
     * Create a scaffold for new plugin
     */
    createPluginScaffold(template: PluginTemplate): string {
        const pluginDir = join(this.pluginsDir, template.name);

        if (existsSync(pluginDir)) {
            throw new Error(`Plugin directory already exists: ${template.name}`);
        }

        mkdirSync(pluginDir, { recursive: true });

        // Create package.json
        const manifest: PluginManifest = {
            name: template.name,
            version: '1.0.0',
            description: template.description,
            author: template.author,
            main: 'index.js',
            engines: {
                contextos: '>=2.0.0',
            },
        };

        writeFileSync(
            join(pluginDir, 'package.json'),
            JSON.stringify(manifest, null, 2)
        );

        // Generate plugin code
        const hookCode = template.hooks
            .map(h => `        ${h}: async (value) => {\n            // TODO: Implement ${h}\n            return value;\n        },`)
            .join('\n');

        const commandsCode = template.withCommands
            ? `
    commands: {
        'my-command': {
            description: 'Example command',
            handler: async (args, context) => {
                context.log.info('Command executed with args:', args);
            },
        },
    },`
            : '';

        const pluginCode = `/**
 * ${template.name} - ContextOS Plugin
 * ${template.description}
 */

module.exports = {
    name: '${template.name}',
    version: '1.0.0',
    description: '${template.description}',

    hooks: {
${hookCode}
    },
${commandsCode}

    activate: async (context) => {
        context.log.info('${template.name} activated');
    },

    deactivate: async () => {
        // Cleanup if needed
    },
};
`;

        writeFileSync(join(pluginDir, 'index.js'), pluginCode);

        return pluginDir;
    }

    /**
     * Create plugin context for API access
     */
    private createPluginContext(pluginName: string): PluginContext {
        // Get or create plugin storage
        if (!this.storage.has(pluginName)) {
            this.storage.set(pluginName, new Map());
        }
        const pluginStorage = this.storage.get(pluginName);

        // This should never be null due to the has check above, but TypeScript doesn't know that
        if (!pluginStorage) {
            throw new Error(`Failed to get plugin storage for ${pluginName}`);
        }

        return {
            projectRoot: this.projectRoot,
            configDir: join(this.projectRoot, '.contextos'),

            log: {
                debug: (msg, ...args) => console.debug(`[${pluginName}]`, msg, ...args),
                info: (msg, ...args) => console.info(`[${pluginName}]`, msg, ...args),
                warn: (msg, ...args) => console.warn(`[${pluginName}]`, msg, ...args),
                error: (msg, ...args) => console.error(`[${pluginName}]`, msg, ...args),
            },

            query: async (_goal: string) => {
                // TODO: Integrate with ContextBuilder
                return { files: [], context: '' };
            },

            readFile: async (path: string) => {
                // Resolve and validate path stays within project root (Fix N1: Path Traversal)
                const fullPath = resolve(this.projectRoot, path);
                const normalized = normalize(fullPath);
                const rootNormalized = normalize(this.projectRoot);

                if (!normalized.startsWith(rootNormalized)) {
                    throw new Error(`Path traversal detected: "${path}" escapes project boundaries`);
                }

                return readFileSync(normalized, 'utf-8');
            },

            getDependencies: async (_path: string, _depth = 2) => {
                // TODO: Integrate with DependencyGraph
                return [];
            },

            storage: {
                get: <T>(key: string) => pluginStorage.get(key) as T | undefined,
                set: <T>(key: string, value: T) => { pluginStorage.set(key, value); },
                delete: (key: string) => pluginStorage.delete(key),
            },
        };
    }
}

/**
 * Factory function
 */
export function createPluginManager(projectRoot: string): PluginManager {
    return new PluginManager(projectRoot);
}
