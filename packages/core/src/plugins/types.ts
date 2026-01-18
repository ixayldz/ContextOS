/**
 * Plugin System Types
 * Extensibility framework for ContextOS
 */

/**
 * Plugin metadata from manifest
 */
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author?: string;
    homepage?: string;
    repository?: string;
    license?: string;
    keywords?: string[];
    engines?: {
        contextos?: string;
        node?: string;
    };
    main: string;
    dependencies?: Record<string, string>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
    /**
     * Called before context is built
     */
    onBeforeContextBuild?: (goal: string, files: string[]) => Promise<string[]> | string[];
    
    /**
     * Called after context is built
     */
    onAfterContextBuild?: (context: string, goal: string) => Promise<string> | string;
    
    /**
     * Called before indexing starts
     */
    onBeforeIndex?: (paths: string[]) => Promise<string[]> | string[];
    
    /**
     * Called after indexing completes
     */
    onAfterIndex?: (stats: { files: number; time: number }) => Promise<void> | void;
    
    /**
     * Called before RLM analysis
     */
    onBeforeAnalyze?: (query: string) => Promise<string> | string;
    
    /**
     * Called after RLM analysis
     */
    onAfterAnalyze?: (result: string, query: string) => Promise<string> | string;
    
    /**
     * Custom file filter for indexing
     */
    fileFilter?: (path: string) => boolean;
    
    /**
     * Custom ranking boost
     */
    rankingBoost?: (path: string, goal: string) => number;
}

/**
 * Context passed to plugins for core API access
 */
export interface PluginContext {
    /**
     * Project root directory
     */
    projectRoot: string;
    
    /**
     * ContextOS config directory
     */
    configDir: string;
    
    /**
     * Logger instance
     */
    log: {
        debug: (message: string, ...args: unknown[]) => void;
        info: (message: string, ...args: unknown[]) => void;
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };
    
    /**
     * Execute a context query
     */
    query: (goal: string) => Promise<{ files: string[]; context: string }>;
    
    /**
     * Read a file from project
     */
    readFile: (path: string) => Promise<string>;
    
    /**
     * Get file dependencies
     */
    getDependencies: (path: string, depth?: number) => Promise<string[]>;
    
    /**
     * Store plugin-specific data
     */
    storage: {
        get: <T>(key: string) => T | undefined;
        set: <T>(key: string, value: T) => void;
        delete: (key: string) => boolean;
    };
}

/**
 * Plugin instance interface
 */
export interface Plugin {
    /**
     * Plugin name (unique identifier)
     */
    name: string;
    
    /**
     * Semantic version
     */
    version: string;
    
    /**
     * Human-readable description
     */
    description?: string;
    
    /**
     * Lifecycle hooks
     */
    hooks?: PluginHooks;
    
    /**
     * Called when plugin is activated
     */
    activate?: (context: PluginContext) => Promise<void> | void;
    
    /**
     * Called when plugin is deactivated
     */
    deactivate?: () => Promise<void> | void;
    
    /**
     * Custom commands provided by plugin
     */
    commands?: Record<string, {
        description: string;
        handler: (args: string[], context: PluginContext) => Promise<void> | void;
    }>;
}

/**
 * Plugin state in manager
 */
export interface PluginState {
    manifest: PluginManifest;
    instance: Plugin;
    enabled: boolean;
    path: string;
    loadedAt: Date;
    error?: string;
}

/**
 * Plugin registry entry (for remote plugins)
 */
export interface RegistryEntry {
    name: string;
    version: string;
    description: string;
    author: string;
    downloads: number;
    lastUpdated: string;
    tarball: string;
    keywords: string[];
}

/**
 * Plugin install options
 */
export interface InstallOptions {
    /**
     * Install from local path
     */
    local?: boolean;
    
    /**
     * Specific version to install
     */
    version?: string;
    
    /**
     * Force reinstall
     */
    force?: boolean;
    
    /**
     * Skip activation after install
     */
    skipActivate?: boolean;
}

/**
 * Plugin creation template
 */
export interface PluginTemplate {
    name: string;
    description: string;
    author: string;
    hooks: (keyof PluginHooks)[];
    withCommands: boolean;
}

/**
 * Hook execution result
 */
export interface HookResult<T> {
    modified: boolean;
    value: T;
    pluginsExecuted: string[];
    errors: Array<{ plugin: string; error: Error }>;
}
