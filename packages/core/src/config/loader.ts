/**
 * Configuration Loader
 * Loads and validates context.yaml and config.yaml files
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
    ContextYamlSchema,
    ConfigYamlSchema,
    type ContextYamlOutput,
    type ConfigYamlOutput,
} from './schema.js';

const CONTEXTOS_DIR = '.contextos';
const CONTEXT_FILE = 'context.yaml';
const CONFIG_FILE = 'config.yaml';

export interface LoadedConfig {
    context: ContextYamlOutput;
    config: ConfigYamlOutput;
    rootDir: string;
}

/**
 * Find the .contextos directory by walking up the directory tree
 */
export function findContextosRoot(startDir: string = process.cwd()): string | null {
    let currentDir = startDir;

    while (currentDir !== dirname(currentDir)) {
        const contextosPath = join(currentDir, CONTEXTOS_DIR);
        if (existsSync(contextosPath)) {
            return currentDir;
        }
        currentDir = dirname(currentDir);
    }

    return null;
}

/**
 * Load and validate context.yaml
 */
export function loadContextYaml(rootDir: string): ContextYamlOutput {
    const contextPath = join(rootDir, CONTEXTOS_DIR, CONTEXT_FILE);

    if (!existsSync(contextPath)) {
        throw new Error(`context.yaml not found at ${contextPath}. Run 'ctx init' first.`);
    }

    const rawContent = readFileSync(contextPath, 'utf-8');
    const parsed = parseYaml(rawContent);

    const result = ContextYamlSchema.safeParse(parsed);

    if (!result.success) {
        const errors = result.error.issues
            .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid context.yaml:\n${errors}`);
    }

    return result.data;
}

/**
 * Load and validate config.yaml
 */
export function loadConfigYaml(rootDir: string): ConfigYamlOutput {
    const configPath = join(rootDir, CONTEXTOS_DIR, CONFIG_FILE);

    if (!existsSync(configPath)) {
        // Return defaults if config doesn't exist
        return ConfigYamlSchema.parse({});
    }

    const rawContent = readFileSync(configPath, 'utf-8');
    const parsed = parseYaml(rawContent);

    const result = ConfigYamlSchema.safeParse(parsed);

    if (!result.success) {
        const errors = result.error.issues
            .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid config.yaml:\n${errors}`);
    }

    return result.data;
}

/**
 * Load both configuration files
 */
export function loadConfig(startDir: string = process.cwd()): LoadedConfig {
    const rootDir = findContextosRoot(startDir);

    if (!rootDir) {
        throw new Error('ContextOS not initialized. Run "ctx init" first.');
    }

    return {
        context: loadContextYaml(rootDir),
        config: loadConfigYaml(rootDir),
        rootDir,
    };
}

/**
 * Save context.yaml
 */
export function saveContextYaml(rootDir: string, context: ContextYamlOutput): void {
    const contextosDir = join(rootDir, CONTEXTOS_DIR);
    const contextPath = join(contextosDir, CONTEXT_FILE);

    if (!existsSync(contextosDir)) {
        mkdirSync(contextosDir, { recursive: true });
    }

    // Update meta
    context.meta = {
        ...context.meta,
        last_indexed: new Date().toISOString(),
        index_version: context.version,
    };

    const content = stringifyYaml(context, {
        indent: 2,
        lineWidth: 120,
    });

    writeFileSync(contextPath, content, 'utf-8');
}

/**
 * Save config.yaml
 */
export function saveConfigYaml(rootDir: string, config: ConfigYamlOutput): void {
    const contextosDir = join(rootDir, CONTEXTOS_DIR);
    const configPath = join(contextosDir, CONFIG_FILE);

    if (!existsSync(contextosDir)) {
        mkdirSync(contextosDir, { recursive: true });
    }

    const content = stringifyYaml(config, {
        indent: 2,
        lineWidth: 120,
    });

    writeFileSync(configPath, content, 'utf-8');
}

/**
 * Check if ContextOS is initialized in the given directory
 */
export function isInitialized(startDir: string = process.cwd()): boolean {
    return findContextosRoot(startDir) !== null;
}
