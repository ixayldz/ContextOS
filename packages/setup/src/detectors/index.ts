/**
 * IDE & CLI Tool Detectors
 * Detect installed IDEs, AI CLI tools, and their configuration paths
 * 
 * Supported Tools:
 * - Claude Desktop / Claude Code CLI
 * - Cursor
 * - Windsurf
 * - VS Code
 * - Codex CLI (OpenAI)
 * - Gemini CLI (Google)
 * - OpenCode CLI
 * - Kilo Code
 * - Warp Terminal
 */

import { existsSync, readdirSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

export interface IDEInfo {
    id: string;
    name: string;
    configPath: string;
    configType: 'json' | 'yaml' | 'toml';
    hasExistingConfig: boolean;
    mcpKey: string;
    /** Tool type: 'ide' for editors, 'cli' for command-line tools, 'terminal' for terminal apps */
    toolType: 'ide' | 'cli' | 'terminal';
    /** Whether the tool natively supports MCP protocol */
    mcpSupport: 'native' | 'wrapper' | 'extension';
    /** Installation method detected */
    installMethod?: 'binary' | 'npm' | 'pip' | 'app';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
    try {
        const isWin = platform() === 'win32';
        const checkCmd = isWin ? `where ${cmd}` : `which ${cmd}`;
        execSync(checkCmd, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get platform-specific config directory
 */
function getConfigDir(appName: string, subPath: string = ''): string {
    const os = platform();
    let base: string;

    if (os === 'win32') {
        base = join(homedir(), 'AppData', 'Roaming', appName);
    } else if (os === 'darwin') {
        base = join(homedir(), 'Library', 'Application Support', appName);
    } else {
        base = join(homedir(), '.config', appName.toLowerCase());
    }

    return subPath ? join(base, subPath) : base;
}

// ═══════════════════════════════════════════════════════════════════════════
// DESKTOP APP DETECTORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect Claude Desktop App
 */
function detectClaudeDesktop(): IDEInfo | null {
    const configPath = getConfigDir('Claude', 'claude_desktop_config.json');
    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir) || existsSync(configPath);

    if (!isInstalled) return null;

    return {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
        toolType: 'ide',
        mcpSupport: 'native',
        installMethod: 'app',
    };
}

/**
 * Detect Cursor
 */
function detectCursor(): IDEInfo | null {
    const configPath = getConfigDir('Cursor', join('User', 'settings.json'));
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
        toolType: 'ide',
        mcpSupport: 'native',
        installMethod: 'app',
    };
}

/**
 * Detect Windsurf
 */
function detectWindsurf(): IDEInfo | null {
    const configPath = getConfigDir('Windsurf', join('User', 'settings.json'));
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
        toolType: 'ide',
        mcpSupport: 'native',
        installMethod: 'app',
    };
}

/**
 * Detect VS Code
 */
function detectVSCode(): IDEInfo | null {
    const configPath = getConfigDir('Code', join('User', 'settings.json'));
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
        toolType: 'ide',
        mcpSupport: 'extension', // VS Code uses Continue.dev extension for MCP
        installMethod: 'app',
    };
}

/**
 * Detect Kilo Code (VS Code fork with AI)
 */
function detectKiloCode(): IDEInfo | null {
    const configPath = getConfigDir('KiloCode', join('User', 'settings.json'));
    const configDir = join(configPath, '..');
    const isInstalled = existsSync(configDir);

    if (!isInstalled) return null;

    return {
        id: 'kilocode',
        name: 'Kilo Code',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcp.servers',
        toolType: 'ide',
        mcpSupport: 'native',
        installMethod: 'app',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI TOOL DETECTORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect Claude Code CLI (Anthropic's official CLI)
 */
function detectClaudeCodeCLI(): IDEInfo | null {
    // Check for claude command in PATH
    const hasCommand = commandExists('claude');

    // Also check for config directory
    const configPath = join(homedir(), '.claude', 'mcp.json');
    const configDir = join(configPath, '..');
    const hasConfig = existsSync(configDir);

    if (!hasCommand && !hasConfig) return null;

    return {
        id: 'claude-code',
        name: 'Claude Code CLI',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
        toolType: 'cli',
        mcpSupport: 'native',
        installMethod: hasCommand ? 'binary' : 'npm',
    };
}

/**
 * Detect OpenAI Codex CLI
 */
function detectCodexCLI(): IDEInfo | null {
    // Check for codex command in PATH
    const hasCommand = commandExists('codex');

    // Check for config directory
    const configPath = join(homedir(), '.codex', 'config.json');
    const configDir = join(configPath, '..');
    const hasConfig = existsSync(configDir);

    if (!hasCommand && !hasConfig) return null;

    return {
        id: 'codex',
        name: 'OpenAI Codex CLI',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
        toolType: 'cli',
        mcpSupport: 'wrapper', // Need to wrap with context injection
        installMethod: hasCommand ? 'npm' : undefined,
    };
}

/**
 * Detect Google Gemini CLI
 */
function detectGeminiCLI(): IDEInfo | null {
    // Check for gemini command in PATH
    const hasCommand = commandExists('gemini');

    // Check for config directory
    const configPath = join(homedir(), '.gemini', 'config.json');
    const configDir = join(configPath, '..');
    const hasConfig = existsSync(configDir);

    if (!hasCommand && !hasConfig) return null;

    return {
        id: 'gemini-cli',
        name: 'Gemini CLI',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
        toolType: 'cli',
        mcpSupport: 'wrapper', // Need to wrap with context injection
        installMethod: hasCommand ? 'npm' : undefined,
    };
}

/**
 * Detect OpenCode CLI (Community open-source CLI)
 */
function detectOpenCodeCLI(): IDEInfo | null {
    // Check for opencode command in PATH
    const hasCommand = commandExists('opencode');

    // Check for config directory
    const configPath = join(homedir(), '.opencode', 'config.json');
    const configDir = join(configPath, '..');
    const hasConfig = existsSync(configDir);

    if (!hasCommand && !hasConfig) return null;

    return {
        id: 'opencode',
        name: 'OpenCode CLI',
        configPath,
        configType: 'json',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'mcpServers',
        toolType: 'cli',
        mcpSupport: 'wrapper',
        installMethod: hasCommand ? 'binary' : undefined,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL DETECTORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect Warp Terminal (AI-powered terminal)
 */
function detectWarp(): IDEInfo | null {
    const os = platform();

    // Warp is currently macOS only, but checking Windows/Linux for future
    let configPath: string;
    if (os === 'darwin') {
        configPath = join(homedir(), '.warp', 'config.yaml');
    } else {
        configPath = join(homedir(), '.warp', 'config.yaml');
    }

    const configDir = join(configPath, '..');
    const hasWarp = existsSync(configDir) || commandExists('warp');

    if (!hasWarp) return null;

    return {
        id: 'warp',
        name: 'Warp Terminal',
        configPath,
        configType: 'yaml',
        hasExistingConfig: existsSync(configPath),
        mcpKey: 'ai.context_providers',
        toolType: 'terminal',
        mcpSupport: 'wrapper', // Needs shell hook integration
        installMethod: 'app',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DETECTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect all installed IDEs and CLI tools
 */
export async function detectIDEs(): Promise<IDEInfo[]> {
    const detectors = [
        // Desktop Apps / IDEs
        detectClaudeDesktop,
        detectCursor,
        detectWindsurf,
        detectVSCode,
        detectKiloCode,
        // CLI Tools
        detectClaudeCodeCLI,
        detectCodexCLI,
        detectGeminiCLI,
        detectOpenCodeCLI,
        // Terminals
        detectWarp,
    ];

    const results: IDEInfo[] = [];

    for (const detect of detectors) {
        try {
            const ide = detect();
            if (ide) {
                results.push(ide);
            }
        } catch {
            // Skip failed detections silently
        }
    }

    return results;
}

/**
 * Detect only CLI tools
 */
export async function detectCLITools(): Promise<IDEInfo[]> {
    const all = await detectIDEs();
    return all.filter(t => t.toolType === 'cli');
}

/**
 * Detect only IDE apps
 */
export async function detectIDEApps(): Promise<IDEInfo[]> {
    const all = await detectIDEs();
    return all.filter(t => t.toolType === 'ide');
}

/**
 * Detect tools that natively support MCP
 */
export async function detectMCPNativeTools(): Promise<IDEInfo[]> {
    const all = await detectIDEs();
    return all.filter(t => t.mcpSupport === 'native');
}

/**
 * Detect tools that need wrapper scripts
 */
export async function detectWrapperTools(): Promise<IDEInfo[]> {
    const all = await detectIDEs();
    return all.filter(t => t.mcpSupport === 'wrapper');
}

