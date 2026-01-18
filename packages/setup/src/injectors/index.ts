/**
 * Config Injectors
 * Inject ContextOS MCP configuration into IDE configs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { IDEInfo } from '../detectors/index.js';

export interface InjectOptions {
    force?: boolean;
    projectPath?: string;
}

export interface InjectResult {
    ide: string;
    success: boolean;
    message: string;
    configPath?: string;
}

/**
 * Generate MCP server configuration
 */
function generateMCPConfig(projectPath?: string): Record<string, unknown> {
    const baseConfig = {
        command: 'npx',
        args: ['@contextos/mcp'],
    };

    if (projectPath) {
        return {
            ...baseConfig,
            cwd: projectPath,
        };
    }

    return baseConfig;
}

/**
 * Inject config for Claude Desktop
 */
async function injectClaude(ide: IDEInfo, options: InjectOptions): Promise<InjectResult> {
    let config: Record<string, unknown> = {};

    if (existsSync(ide.configPath)) {
        try {
            config = JSON.parse(readFileSync(ide.configPath, 'utf-8'));
        } catch {
            config = {};
        }
    }

    // Check if already configured
    const mcpServers = (config.mcpServers as Record<string, unknown>) || {};
    if (mcpServers.contextos && !options.force) {
        return {
            ide: ide.name,
            success: false,
            message: 'Already configured (use --force to overwrite)',
        };
    }

    // Inject configuration
    config.mcpServers = {
        ...mcpServers,
        contextos: generateMCPConfig(options.projectPath),
    };

    // Ensure directory exists
    const configDir = dirname(ide.configPath);
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }

    // Write config
    writeFileSync(ide.configPath, JSON.stringify(config, null, 2));

    return {
        ide: ide.name,
        success: true,
        message: 'Configuration added successfully',
        configPath: ide.configPath,
    };
}

/**
 * Inject config for Cursor/Windsurf/VS Code (similar format)
 */
async function injectVSCodeStyle(ide: IDEInfo, options: InjectOptions): Promise<InjectResult> {
    let config: Record<string, unknown> = {};

    if (existsSync(ide.configPath)) {
        try {
            config = JSON.parse(readFileSync(ide.configPath, 'utf-8'));
        } catch {
            config = {};
        }
    }

    // Navigate to mcp.servers using dot notation
    const keys = ide.mcpKey.split('.');
    let current: Record<string, unknown> = config;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    const servers = (current[lastKey] as Record<string, unknown>) || {};

    // Check if already configured
    if (servers.contextos && !options.force) {
        return {
            ide: ide.name,
            success: false,
            message: 'Already configured (use --force to overwrite)',
        };
    }

    // Inject configuration
    current[lastKey] = {
        ...servers,
        contextos: {
            command: 'npx @contextos/mcp',
            cwd: options.projectPath || '${workspaceFolder}',
        },
    };

    // Ensure directory exists
    const configDir = dirname(ide.configPath);
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }

    // Write config
    writeFileSync(ide.configPath, JSON.stringify(config, null, 2));

    return {
        ide: ide.name,
        success: true,
        message: 'Configuration added successfully',
        configPath: ide.configPath,
    };
}

/**
 * Inject ContextOS configuration into an IDE
 */
export async function injectConfig(ide: IDEInfo, options: InjectOptions = {}): Promise<InjectResult> {
    switch (ide.id) {
        case 'claude':
            return injectClaude(ide, options);
        case 'cursor':
        case 'windsurf':
        case 'vscode':
        case 'codex':
            return injectVSCodeStyle(ide, options);
        default:
            return {
                ide: ide.name,
                success: false,
                message: `Unknown IDE: ${ide.id}`,
            };
    }
}
