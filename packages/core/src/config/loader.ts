/**
 * Configuration Loader
 * Loads and validates context.yaml and config.yaml files
 * Fixed: Added encryption support for sensitive data
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
import { encrypt, decrypt, sanitizeConfig, getEncryptionPassword } from './encryption.js';

const CONTEXTOS_DIR = '.contextos';
const CONTEXT_FILE = 'context.yaml';
const CONFIG_FILE = 'config.yaml';
const SECRETS_FILE = '.config.secrets';

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
 * Fixed: Loads encrypted secrets from .config.secrets
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

    const config = result.data;

    // Load encrypted secrets if they exist
    const secretsPath = join(rootDir, CONTEXTOS_DIR, SECRETS_FILE);
    if (existsSync(secretsPath)) {
        try {
            const encryptedSecrets = readFileSync(secretsPath, 'utf-8');
            const password = getEncryptionPassword();

            // Fix N6: JSON.parse without try-catch
            let decryptedSecrets: Record<string, unknown>;
            try {
                const secretsJson = decrypt(encryptedSecrets, password);
                decryptedSecrets = JSON.parse(secretsJson);
            } catch (parseError) {
                console.warn(`Failed to parse encrypted secrets: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                // Continue without secrets
                return config;
            }

            // Merge secrets into config
            if (decryptedSecrets.apiKeys) {
                (config as Record<string, unknown>).apiKeys = decryptedSecrets.apiKeys;
            }
        } catch (error) {
            console.warn(`Failed to load encrypted secrets: ${error instanceof Error ? error.message : String(error)}`);
            // Continue without secrets rather than failing
        }
    }

    return config;
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
 * Fixed: Encrypts and saves sensitive data separately to .config.secrets
 */
export function saveConfigYaml(
    rootDir: string,
    config: ConfigYamlOutput,
    options: { encryptSecrets?: boolean; skipEncryption?: boolean } = {}
): void {
    const contextosDir = join(rootDir, CONTEXTOS_DIR);
    const configPath = join(contextosDir, CONFIG_FILE);
    const secretsPath = join(contextosDir, SECRETS_FILE);

    if (!existsSync(contextosDir)) {
        mkdirSync(contextosDir, { recursive: true });
    }

    // Check if we should encrypt (default: yes, unless explicitly skipped)
    const shouldEncrypt = !options.skipEncryption && (options.encryptSecrets !== false);

    // Extract sensitive fields to encrypt separately
    const sensitiveFields: Record<string, unknown> = {};
    const sanitizedConfig = { ...config };

    // List of sensitive field paths (config.path.to.field)
    const sensitivePaths = [
        { path: 'apiKeys', key: 'apiKeys' },
        { path: 'embedding.api_key', key: 'embedding' },
        { path: 'llm.apiKey', key: 'llm' },
    ];

    // Extract sensitive data
    for (const { path: fieldPath, key: sectionKey } of sensitivePaths) {
        const keys = fieldPath.split('.');
        let current: Record<string, unknown> = sanitizedConfig as Record<string, unknown>;

        // Navigate to parent
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] && typeof current[keys[i]] === 'object') {
                current = current[keys[i]] as Record<string, unknown>;
            } else {
                break;
            }
        }

        const lastKey = keys[keys.length - 1];
        if (lastKey in current) {
            sensitiveFields[lastKey] = current[lastKey];
            delete current[lastKey];
        }
    }

    // Save sanitized config (without secrets)
    const content = stringifyYaml(sanitizedConfig, {
        indent: 2,
        lineWidth: 120,
    });

    writeFileSync(configPath, content, 'utf-8');

    // Encrypt and save secrets separately
    if (shouldEncrypt && Object.keys(sensitiveFields).length > 0) {
        try {
            const password = getEncryptionPassword();
            const encryptedSecrets = encrypt(JSON.stringify(sensitiveFields), password);

            // Write with restricted permissions (0600 = read/write for owner only)
            writeFileSync(secretsPath, encryptedSecrets, {
                mode: 0o600,
                encoding: 'utf-8',
            });

            console.log(`Sensitive configuration encrypted and saved to ${SECRETS_FILE}`);
        } catch (error) {
            console.warn(`Failed to encrypt secrets: ${error instanceof Error ? error.message : String(error)}`);
            console.warn('Secrets were not saved. Set CONTEXTOS_ENCRYPTION_KEY environment variable.');
        }
    } else if (Object.keys(sensitiveFields).length > 0 && !shouldEncrypt) {
        // If encryption is disabled, save secrets in plain text (not recommended)
        console.warn('Saving secrets in plain text (not recommended)');
        writeFileSync(secretsPath, JSON.stringify(sensitiveFields, null, 2), {
            mode: 0o600,
            encoding: 'utf-8',
        });
    }
}

/**
 * Check if ContextOS is initialized in the given directory
 */
export function isInitialized(startDir: string = process.cwd()): boolean {
    return findContextosRoot(startDir) !== null;
}
