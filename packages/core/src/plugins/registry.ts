/**
 * Plugin Registry
 * Handles local and remote plugin discovery
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PluginManifest, RegistryEntry } from './types.js';

/**
 * Registry configuration
 */
export interface RegistryConfig {
    /**
     * Local plugins directory
     */
    localDir: string;

    /**
     * Remote registry URL (npm-like)
     */
    remoteUrl?: string;

    /**
     * Cache directory for remote plugins
     */
    cacheDir?: string;
}

/**
 * Local plugin info
 */
export interface LocalPluginInfo {
    name: string;
    version: string;
    description: string;
    path: string;
    enabled: boolean;
}

/**
 * Plugin Registry
 */
export class PluginRegistry {
    private config: RegistryConfig;
    private remoteCache: Map<string, RegistryEntry[]> = new Map();

    constructor(config: RegistryConfig) {
        this.config = config;
    }

    /**
     * List all locally installed plugins
     */
    listLocal(): LocalPluginInfo[] {
        const plugins: LocalPluginInfo[] = [];

        if (!existsSync(this.config.localDir)) {
            return plugins;
        }

        const entries = readdirSync(this.config.localDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const pluginPath = join(this.config.localDir, entry.name);
            const manifestPath = join(pluginPath, 'package.json');

            if (!existsSync(manifestPath)) continue;

            try {
                const manifest: PluginManifest = JSON.parse(
                    readFileSync(manifestPath, 'utf-8')
                );

                // Check if plugin is enabled (via .disabled file or config)
                const disabledPath = join(pluginPath, '.disabled');
                const enabled = !existsSync(disabledPath);

                plugins.push({
                    name: manifest.name,
                    version: manifest.version,
                    description: manifest.description,
                    path: pluginPath,
                    enabled,
                });
            } catch {
                // Skip invalid plugins
            }
        }

        return plugins;
    }

    /**
     * Search remote registry for plugins
     */
    async searchRemote(query: string): Promise<RegistryEntry[]> {
        if (!this.config.remoteUrl) {
            return [];
        }

        // Check cache
        const cacheKey = `search:${query}`;
        if (this.remoteCache.has(cacheKey)) {
            return this.remoteCache.get(cacheKey)!;
        }

        try {
            // npm-style search
            const searchUrl = `${this.config.remoteUrl}/-/v1/search?text=${encodeURIComponent(query)}&scope=contextos-plugin`;
            const response = await fetch(searchUrl);

            if (!response.ok) {
                throw new Error(`Registry search failed: ${response.statusText}`);
            }

            const data = await response.json() as { objects: Array<{ package: RegistryEntry }> };
            const results = data.objects.map(obj => obj.package);

            // Cache results for 5 minutes
            this.remoteCache.set(cacheKey, results);
            setTimeout(() => this.remoteCache.delete(cacheKey), 5 * 60 * 1000);

            return results;
        } catch (error) {
            console.error('Remote registry search failed:', error);
            return [];
        }
    }

    /**
     * Get plugin info from remote registry
     */
    async getRemoteInfo(name: string, version?: string): Promise<RegistryEntry | null> {
        if (!this.config.remoteUrl) {
            return null;
        }

        try {
            const infoUrl = version
                ? `${this.config.remoteUrl}/${name}/${version}`
                : `${this.config.remoteUrl}/${name}/latest`;

            const response = await fetch(infoUrl);

            if (!response.ok) {
                return null;
            }

            return await response.json() as RegistryEntry;
        } catch {
            return null;
        }
    }

    /**
     * Check if a plugin is installed locally
     */
    isInstalled(name: string): boolean {
        const plugins = this.listLocal();
        return plugins.some(p => p.name === name);
    }

    /**
     * Get local plugin by name
     */
    getLocal(name: string): LocalPluginInfo | null {
        const plugins = this.listLocal();
        return plugins.find(p => p.name === name) || null;
    }

    /**
     * Get featured/popular plugins from remote
     */
    async getFeatured(): Promise<RegistryEntry[]> {
        if (!this.config.remoteUrl) {
            // Return built-in plugin suggestions
            return [
                {
                    name: '@contextos/plugin-docker',
                    version: '1.0.0',
                    description: 'Docker context integration - scan Dockerfiles and compose files',
                    author: 'ContextOS Team',
                    downloads: 1200,
                    lastUpdated: new Date().toISOString(),
                    tarball: '',
                    keywords: ['docker', 'container', 'devops'],
                },
                {
                    name: '@contextos/plugin-kubernetes',
                    version: '1.0.0',
                    description: 'Kubernetes context integration - scan K8s manifests',
                    author: 'ContextOS Team',
                    downloads: 800,
                    lastUpdated: new Date().toISOString(),
                    tarball: '',
                    keywords: ['kubernetes', 'k8s', 'devops'],
                },
                {
                    name: '@contextos/plugin-graphql',
                    version: '1.0.0',
                    description: 'GraphQL schema and resolver context',
                    author: 'ContextOS Team',
                    downloads: 650,
                    lastUpdated: new Date().toISOString(),
                    tarball: '',
                    keywords: ['graphql', 'api', 'schema'],
                },
                {
                    name: '@contextos/plugin-prisma',
                    version: '1.0.0',
                    description: 'Prisma ORM schema integration',
                    author: 'ContextOS Team',
                    downloads: 500,
                    lastUpdated: new Date().toISOString(),
                    tarball: '',
                    keywords: ['prisma', 'database', 'orm'],
                },
            ];
        }

        return this.searchRemote('contextos-plugin featured');
    }

    /**
     * Clear remote cache
     */
    clearCache(): void {
        this.remoteCache.clear();
    }
}

/**
 * Factory function
 */
export function createPluginRegistry(projectRoot: string): PluginRegistry {
    return new PluginRegistry({
        localDir: join(projectRoot, '.contextos', 'plugins'),
        remoteUrl: process.env.CONTEXTOS_REGISTRY_URL || undefined,
        cacheDir: join(projectRoot, '.contextos', 'cache', 'plugins'),
    });
}
