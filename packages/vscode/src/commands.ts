/**
 * VS Code Extension Commands
 * Wraps CLI functionality for VS Code
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCtxCommand(command: string): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder open');
    }

    const { stdout, stderr } = await execAsync(`npx ctx ${command}`, {
        cwd: workspaceFolder.uri.fsPath,
        env: {
            ...process.env,
            FORCE_COLOR: '0', // Disable colors for parsing
        },
    });

    if (stderr && !stderr.includes('npm')) {
        console.warn('ctx stderr:', stderr);
    }

    return stdout;
}

export async function init(): Promise<void> {
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Initializing ContextOS...',
            },
            async () => {
                await runCtxCommand('init -y');
            }
        );
        vscode.window.showInformationMessage('ContextOS initialized successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize: ${error}`);
    }
}

export async function build(): Promise<void> {
    try {
        const output = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Building context...',
            },
            async () => {
                return await runCtxCommand('build');
            }
        );

        vscode.window.showInformationMessage('Context built successfully!');

        // Show output in output channel
        const channel = vscode.window.createOutputChannel('ContextOS');
        channel.appendLine(output);
        channel.show();
    } catch (error) {
        vscode.window.showErrorMessage(`Build failed: ${error}`);
    }
}

export async function copy(): Promise<void> {
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Copying context to clipboard...',
            },
            async () => {
                await runCtxCommand('copy');
            }
        );
        vscode.window.showInformationMessage('Context copied to clipboard!');
    } catch (error) {
        vscode.window.showErrorMessage(`Copy failed: ${error}`);
    }
}

export async function doctor(): Promise<void> {
    try {
        const output = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running health check...',
            },
            async () => {
                return await runCtxCommand('doctor --json');
            }
        );

        const report = JSON.parse(output);

        if (report.errors.length === 0 && report.warnings.length === 0) {
            vscode.window.showInformationMessage('✅ All health checks passed!');
        } else {
            const message = `Found ${report.errors.length} errors and ${report.warnings.length} warnings`;
            const action = await vscode.window.showWarningMessage(message, 'View Details');

            if (action === 'View Details') {
                const channel = vscode.window.createOutputChannel('ContextOS Doctor');
                channel.appendLine('=== ContextOS Health Check ===\n');

                for (const error of report.errors) {
                    channel.appendLine(`❌ ERROR: ${error.message}`);
                    channel.appendLine(`   Expected: ${error.expected}`);
                    channel.appendLine(`   Actual: ${error.actual}`);
                    channel.appendLine(`   Fix: ${error.suggestion}\n`);
                }

                for (const warning of report.warnings) {
                    channel.appendLine(`⚠️ WARNING: ${warning.message}`);
                    channel.appendLine(`   ${warning.suggestion}\n`);
                }

                channel.show();
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Health check failed: ${error}`);
    }
}

export async function suggestRules(): Promise<void> {
    const config = vscode.workspace.getConfiguration('contextos');
    const apiKey = config.get('geminiApiKey');

    if (!apiKey) {
        const action = await vscode.window.showWarningMessage(
            'Gemini API key not configured.',
            'Open Settings'
        );

        if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'contextos.geminiApiKey');
        }
        return;
    }

    try {
        const output = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing code with Gemini...',
            },
            async () => {
                return await runCtxCommand('suggest-rules');
            }
        );

        const channel = vscode.window.createOutputChannel('ContextOS Rules');
        channel.appendLine(output);
        channel.show();

        const action = await vscode.window.showInformationMessage(
            'Rule suggestions generated!',
            'Apply Suggestions'
        );

        if (action === 'Apply Suggestions') {
            await runCtxCommand('suggest-rules --apply');
            vscode.window.showInformationMessage('Suggestions applied to context.yaml');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Suggest rules failed: ${error}`);
    }
}

export async function indexFile(filePath: string): Promise<void> {
    try {
        // This would ideally use the core library directly
        // For now, we trigger a full incremental index
        await runCtxCommand('index');
    } catch (error) {
        console.error('Index failed:', error);
    }
}
