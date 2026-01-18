/**
 * IDE Detectors
 * Detect installed IDEs and their configuration paths
 */

import { existsSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

export interface IDEInfo {
    id: string;
    name: string;
    configPath: string;
    configType: 'json' | 'yaml';
    hasExistingConfig: boolean;
    mcpKey: string;
}

/**
 * Detect Claude Desktop
 */
function detectClaude(): IDEInfo | null {
    const os = platform();
    let configPath: string;

    if (os === 'win32') {
        configPath = join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    } else if (os === 'darwin') {
        configPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
        configPath = join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
    }

    // Check if Claude is installed (config dir exists)
    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir) || existsSync(configPath);

    if (!isInstalled) return null;

    return {
        id: 'claude',
        name: 'Claude Desktop',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
    };
}

/**
 * Detect Cursor
 */
function detectCursor(): IDEInfo | null {
    const os = platform();
    let configPath: string;

    if (os === 'win32') {
        configPath = join(homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json');
    } else if (os === 'darwin') {
        configPath = join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
    } else {
        configPath = join(homedir(), '.config', 'Cursor', 'User', 'settings.json');
    }

    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir);

    if (!isInstalled) return null;

    return {
        id: 'cursor',
        name: 'Cursor',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcp.servers',
    };
}

/**
 * Detect Windsurf
 */
function detectWindsurf(): IDEInfo | null {
    const os = platform();
    let configPath: string;

    if (os === 'win32') {
        configPath = join(homedir(), 'AppData', 'Roaming', 'Windsurf', 'User', 'settings.json');
    } else if (os === 'darwin') {
        configPath = join(homedir(), 'Library', 'Application Support', 'Windsurf', 'User', 'settings.json');
    } else {
        configPath = join(homedir(), '.config', 'Windsurf', 'User', 'settings.json');
    }

    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir);

    if (!isInstalled) return null;

    return {
        id: 'windsurf',
        name: 'Windsurf',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcp.servers',
    };
}

/**
 * Detect VS Code
 */
function detectVSCode(): IDEInfo | null {
    const os = platform();
    let configPath: string;

    if (os === 'win32') {
        configPath = join(homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
    } else if (os === 'darwin') {
        configPath = join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    } else {
        configPath = join(homedir(), '.config', 'Code', 'User', 'settings.json');
    }

    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir);

    if (!isInstalled) return null;

    return {
        id: 'vscode',
        name: 'VS Code',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcp.servers',
    };
}

/**
 * Detect Codex CLI
 */
function detectCodex(): IDEInfo | null {
    const os = platform();
    let configPath: string;

    if (os === 'win32') {
        configPath = join(homedir(), '.codex', 'config.json');
    } else {
        configPath = join(homedir(), '.codex', 'config.json');
    }

    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir);

    if (!isInstalled) return null;

    return {
        id: 'codex',
        name: 'OpenAI Codex CLI',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
    };
}

/**
 * Detect all installed IDEs
 */
export async function detectIDEs(): Promise<IDEInfo[]> {
    const detectors = [
        detectClaude,
        detectCursor,
        detectWindsurf,
        detectVSCode,
        detectCodex,
    ];

    const results: IDEInfo[] = [];

    for (const detect of detectors) {
        const ide = detect();
        if (ide) {
            results.push(ide);
        }
    }

    return results;
}
