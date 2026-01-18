/**
 * Config Injectors
 * Inject ContextOS MCP configuration into IDE/CLI tool configs
 * 
 * Supports:
 * - Native MCP: Direct config injection (Claude, Cursor, Windsurf)
 * - Wrapper: Shell wrapper scripts for non-MCP tools (Codex, Gemini)
 * - Extension: VS Code extension installation guidance
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import { homedir, platform } from 'os';
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
    /** Additional steps the user needs to take */
    nextSteps?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP CONFIG GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate MCP server configuration for Claude-style configs
 */
function generateClaudeMCPConfig(_projectPath?: string): Record<string, unknown> {
    return {
        command: 'npx',
        args: ['-y', '@contextos/mcp'],
    };
}

/**
 * Generate MCP server configuration for VS Code-style configs
 */
function generateVSCodeMCPConfig(projectPath?: string): Record<string, unknown> {
    return {
        command: 'npx @contextos/mcp',
        cwd: projectPath || '${workspaceFolder}',
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// NATIVE MCP INJECTORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inject config for Claude Desktop / Claude Code CLI (mcpServers format)
 */
async function injectClaudeStyle(ide: IDEInfo, options: InjectOptions): Promise<InjectResult> {
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
        contextos: generateClaudeMCPConfig(options.projectPath),
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
        message: 'MCP configuration added',
        configPath: ide.configPath,
    };
}

/**
 * Inject config for Cursor/Windsurf/VS Code/Kilo Code (mcp.servers format)
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
        contextos: generateVSCodeMCPConfig(options.projectPath),
    };

    // Ensure directory exists
    const configDir = dirname(ide.configPath);
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }

    // Write config
    writeFileSync(ide.configPath, JSON.stringify(config, null, 2));

    const nextSteps: string[] = [];

    // VS Code needs Continue.dev extension
    if (ide.id === 'vscode' && ide.mcpSupport === 'extension') {
        nextSteps.push('Install Continue.dev extension: code --install-extension continue.continue');
    }

    return {
        ide: ide.name,
        success: true,
        message: 'MCP configuration added',
        configPath: ide.configPath,
        nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// WRAPPER SCRIPT INJECTORS (for non-MCP tools)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get wrapper scripts directory
 */
function getWrapperDir(): string {
    const os = platform();
    if (os === 'win32') {
        return join(homedir(), '.contextos', 'bin');
    }
    return join(homedir(), '.local', 'bin');
}

/**
 * Generate wrapper script for CLI tools that don't support MCP
 * This wraps the original command and injects ContextOS context
 */
function generateWrapperScript(toolName: string, originalCommand: string): string {
    const os = platform();

    if (os === 'win32') {
        // PowerShell wrapper script
        return `#!/usr/bin/env pwsh
# ContextOS wrapper for ${toolName}
# This script injects optimized context before running the tool

$ErrorActionPreference = "SilentlyContinue"

# Build context if in a ContextOS project
$contextFile = ".contextos/cache/last-context.md"
if (Test-Path ".contextos") {
    # Refresh context
    npx @contextos/mcp --build 2>$null | Out-Null
}

# Build system prompt with context
$systemPrompt = ""
if (Test-Path $contextFile) {
    $systemPrompt = Get-Content $contextFile -Raw
}

# Run original command with context
if ($systemPrompt) {
    & ${originalCommand} @args --system-prompt $systemPrompt
} else {
    & ${originalCommand} @args
}
`;
    } else {
        // Bash wrapper script
        return `#!/bin/bash
# ContextOS wrapper for ${toolName}
# This script injects optimized context before running the tool

set -e

# Build context if in a ContextOS project
CONTEXT_FILE=".contextos/cache/last-context.md"
if [ -d ".contextos" ]; then
    # Refresh context silently
    npx @contextos/mcp --build 2>/dev/null || true
fi

# Build system prompt with context
SYSTEM_PROMPT=""
if [ -f "$CONTEXT_FILE" ]; then
    SYSTEM_PROMPT=$(cat "$CONTEXT_FILE")
fi

# Run original command with context
if [ -n "$SYSTEM_PROMPT" ]; then
    ${originalCommand} "$@" --system-prompt "$SYSTEM_PROMPT"
else
    ${originalCommand} "$@"
fi
`;
    }
}

/**
 * Inject wrapper script for CLI tools without MCP support
 */
async function injectWrapper(ide: IDEInfo, options: InjectOptions): Promise<InjectResult> {
    const wrapperDir = getWrapperDir();
    const os = platform();
    const ext = os === 'win32' ? '.ps1' : '';

    // Determine wrapper name and original command
    let wrapperName = '';
    let originalCommand = '';

    switch (ide.id) {
        case 'codex':
            wrapperName = `codex-ctx${ext}`;
            originalCommand = 'codex';
            break;
        case 'gemini-cli':
            wrapperName = `gemini-ctx${ext}`;
            originalCommand = 'gemini';
            break;
        case 'opencode':
            wrapperName = `opencode-ctx${ext}`;
            originalCommand = 'opencode';
            break;
        default:
            return {
                ide: ide.name,
                success: false,
                message: `Wrapper not implemented for ${ide.id}`,
            };
    }

    const wrapperPath = join(wrapperDir, wrapperName);

    // Check if already exists
    if (existsSync(wrapperPath) && !options.force) {
        return {
            ide: ide.name,
            success: false,
            message: 'Wrapper already exists (use --force to overwrite)',
        };
    }

    // Create wrapper directory
    if (!existsSync(wrapperDir)) {
        mkdirSync(wrapperDir, { recursive: true });
    }

    // Generate and write wrapper script
    const script = generateWrapperScript(ide.name, originalCommand);
    writeFileSync(wrapperPath, script);

    // Make executable on Unix
    if (os !== 'win32') {
        chmodSync(wrapperPath, '755');
    }

    // Determine shell config file for PATH update
    const shellConfigFile = os === 'win32'
        ? 'PowerShell Profile'
        : '~/.bashrc or ~/.zshrc';

    return {
        ide: ide.name,
        success: true,
        message: `Wrapper script created: ${wrapperName}`,
        configPath: wrapperPath,
        nextSteps: [
            `Add ${wrapperDir} to your PATH`,
            `Update your ${shellConfigFile}`,
            `Use '${wrapperName.replace(ext, '')}' instead of '${originalCommand}'`,
        ],
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL INJECTORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inject configuration for Warp terminal
 */
async function injectWarp(ide: IDEInfo, _options: InjectOptions): Promise<InjectResult> {
    // Warp uses YAML config, needs special handling
    // For now, provide guidance since Warp's AI config format may vary

    return {
        ide: ide.name,
        success: true,
        message: 'Warp integration guidance provided',
        nextSteps: [
            'Warp AI integration is experimental',
            'Use shell hook: eval "$(npx @contextos/mcp --hook)"',
            'Or run: ctx build before Warp AI commands',
        ],
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN INJECTOR ROUTER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inject ContextOS configuration into an IDE or CLI tool
 */
export async function injectConfig(ide: IDEInfo, options: InjectOptions = {}): Promise<InjectResult> {
    // Route based on MCP support type
    switch (ide.mcpSupport) {
        case 'native':
            // Native MCP support - inject config directly
            if (ide.mcpKey === 'mcpServers') {
                return injectClaudeStyle(ide, options);
            } else {
                return injectVSCodeStyle(ide, options);
            }

        case 'wrapper':
            // No MCP support - create wrapper script
            if (ide.toolType === 'terminal') {
                return injectWarp(ide, options);
            }
            return injectWrapper(ide, options);

        case 'extension':
            // Needs extension - inject config + provide guidance
            return injectVSCodeStyle(ide, options);

        default:
            return {
                ide: ide.name,
                success: false,
                message: `Unknown MCP support type: ${ide.mcpSupport}`,
            };
    }
}

/**
 * Inject configuration for all detected tools
 */
export async function injectAll(
    ides: IDEInfo[],
    options: InjectOptions = {}
): Promise<InjectResult[]> {
    const results: InjectResult[] = [];

    for (const ide of ides) {
        try {
            const result = await injectConfig(ide, options);
            results.push(result);
        } catch (error) {
            results.push({
                ide: ide.name,
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return results;
}

/**
 * Generate shell hook for automatic context updates
 */
export function generateShellHook(): string {
    const os = platform();

    if (os === 'win32') {
        return `
# ContextOS PowerShell Hook
# Add to your $PROFILE

function ctx-hook {
    if (Test-Path ".contextos") {
        npx @contextos/mcp --build 2>$null | Out-Null
    }
}

# Auto-run on directory change
$ExecutionContext.SessionState.InvokeCommand.PostCommandLookupAction = {
    param($command)
    if ($command -eq "cd" -or $command -eq "Set-Location") {
        ctx-hook
    }
}
`;
    } else {
        return `
# ContextOS Shell Hook
# Add to your ~/.bashrc or ~/.zshrc

ctx_hook() {
    if [ -d ".contextos" ]; then
        npx @contextos/mcp --build 2>/dev/null &
    fi
}

# For bash
if [ -n "$BASH_VERSION" ]; then
    PROMPT_COMMAND="ctx_hook;$PROMPT_COMMAND"
fi

# For zsh
if [ -n "$ZSH_VERSION" ]; then
    autoload -Uz add-zsh-hook
    add-zsh-hook chpwd ctx_hook
fi
`;
    }
}
