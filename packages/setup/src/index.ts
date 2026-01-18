#!/usr/bin/env node
/**
 * ContextOS Setup CLI
 * One-click setup for all your AI coding tools
 * 
 * Supports:
 * - IDEs: Claude Desktop, Cursor, Windsurf, VS Code, Kilo Code
 * - CLI Tools: Claude Code, Codex, Gemini CLI, OpenCode
 * - Terminals: Warp
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
    detectIDEs,
    detectCLITools,
    detectIDEApps,
    detectMCPNativeTools,
    detectWrapperTools,
    type IDEInfo
} from './detectors/index.js';
import {
    injectConfig,
    injectAll,
    generateShellHook,
    type InjectResult
} from './injectors/index.js';

const program = new Command();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getToolTypeIcon(tool: IDEInfo): string {
    switch (tool.toolType) {
        case 'ide': return '🖥️';
        case 'cli': return '⌨️';
        case 'terminal': return '💻';
        default: return '📦';
    }
}

function getMCPSupportBadge(tool: IDEInfo): string {
    switch (tool.mcpSupport) {
        case 'native': return chalk.green('MCP');
        case 'wrapper': return chalk.yellow('Wrapper');
        case 'extension': return chalk.blue('Extension');
        default: return chalk.gray('Unknown');
    }
}

function printToolList(tools: IDEInfo[]): void {
    console.log();
    console.log(chalk.gray('  Tool                    Type        MCP Support    Status'));
    console.log(chalk.gray('  ' + '─'.repeat(68)));

    tools.forEach(tool => {
        const icon = getToolTypeIcon(tool);
        const status = tool.hasExistingConfig
            ? chalk.yellow('Configured')
            : chalk.green('Ready');
        const mcpBadge = getMCPSupportBadge(tool);
        const typeLabel = tool.toolType.toUpperCase().padEnd(10);

        console.log(`  ${icon} ${tool.name.padEnd(22)} ${typeLabel} ${mcpBadge.padEnd(20)} ${status}`);
    });
    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

program
    .name('contextos-setup')
    .description('One-click ContextOS setup for all your AI coding tools')
    .version('0.2.0');

program
    .command('auto')
    .description('Automatically detect and configure all AI tools')
    .option('--dry-run', 'Show what would be configured without making changes')
    .option('--force', 'Overwrite existing configurations')
    .option('--only-mcp', 'Only configure tools with native MCP support')
    .option('--only-cli', 'Only configure CLI tools')
    .option('--only-ide', 'Only configure IDE apps')
    .action(async (options) => {
        console.log(chalk.cyan.bold('\n🚀 ContextOS Universal Setup\n'));

        const spinner = ora('Detecting AI coding tools...').start();

        try {
            let tools: IDEInfo[];

            // Filter based on options
            if (options.onlyMcp) {
                tools = await detectMCPNativeTools();
            } else if (options.onlyCli) {
                tools = await detectCLITools();
            } else if (options.onlyIde) {
                tools = await detectIDEApps();
            } else {
                tools = await detectIDEs();
            }

            if (tools.length === 0) {
                spinner.warn('No supported AI tools detected');
                console.log(chalk.gray('\nSupported tools:'));
                console.log(chalk.gray('  IDEs: Claude Desktop, Cursor, Windsurf, VS Code, Kilo Code'));
                console.log(chalk.gray('  CLI:  Claude Code, Codex, Gemini CLI, OpenCode'));
                console.log(chalk.gray('  Terminal: Warp\n'));
                return;
            }

            spinner.succeed(`Found ${tools.length} AI tool(s)`);

            // Group by type
            const ides = tools.filter(t => t.toolType === 'ide');
            const clis = tools.filter(t => t.toolType === 'cli');
            const terminals = tools.filter(t => t.toolType === 'terminal');

            if (ides.length > 0) {
                console.log(chalk.cyan('\n🖥️  IDEs:'));
                ides.forEach(t => {
                    const badge = getMCPSupportBadge(t);
                    const status = t.hasExistingConfig ? chalk.yellow('(configured)') : '';
                    console.log(`   ${t.name} ${badge} ${status}`);
                });
            }

            if (clis.length > 0) {
                console.log(chalk.cyan('\n⌨️  CLI Tools:'));
                clis.forEach(t => {
                    const badge = getMCPSupportBadge(t);
                    const status = t.hasExistingConfig ? chalk.yellow('(configured)') : '';
                    console.log(`   ${t.name} ${badge} ${status}`);
                });
            }

            if (terminals.length > 0) {
                console.log(chalk.cyan('\n💻 Terminals:'));
                terminals.forEach(t => {
                    const badge = getMCPSupportBadge(t);
                    const status = t.hasExistingConfig ? chalk.yellow('(configured)') : '';
                    console.log(`   ${t.name} ${badge} ${status}`);
                });
            }

            if (options.dryRun) {
                console.log(chalk.yellow('\n[Dry Run] Would configure:'));
                tools.forEach(t => console.log(`  - ${t.name} (${t.mcpSupport})`));
                return;
            }

            // Confirm before proceeding
            console.log();
            const { proceed } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Configure ContextOS for these tools?',
                    default: true,
                },
            ]);

            if (!proceed) {
                console.log(chalk.gray('Setup cancelled.\n'));
                return;
            }

            // Configure each tool
            console.log();
            const results = await injectAll(tools, { force: options.force });

            // Show results
            for (const result of results) {
                if (result.success) {
                    console.log(chalk.green(`  ✓ ${result.ide}: ${result.message}`));
                    if (result.nextSteps && result.nextSteps.length > 0) {
                        result.nextSteps.forEach(step => {
                            console.log(chalk.gray(`      → ${step}`));
                        });
                    }
                } else {
                    console.log(chalk.yellow(`  ⚠ ${result.ide}: ${result.message}`));
                }
            }

            // Summary
            const successful = results.filter(r => r.success).length;
            const native = results.filter(r => r.success && !r.nextSteps).length;
            const needsSteps = results.filter(r => r.success && r.nextSteps).length;

            console.log(chalk.green(`\n✅ Setup complete: ${successful}/${tools.length} tools configured`));

            if (native > 0) {
                console.log(chalk.cyan(`   ${native} tools are ready to use`));
            }
            if (needsSteps > 0) {
                console.log(chalk.yellow(`   ${needsSteps} tools need additional steps (see above)`));
            }

            console.log(chalk.cyan('\n📋 Next steps:'));
            console.log('  1. Restart your IDE(s) and terminal(s)');
            console.log('  2. Navigate to a project: cd your-project');
            console.log('  3. Initialize ContextOS: npx @contextos/cli init');
            console.log('  4. Start using AI with optimized context!\n');

        } catch (error) {
            spinner.fail('Setup failed');
            console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List all detected AI tools and their status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        const spinner = ora('Scanning for AI tools...').start();
        const tools = await detectIDEs();
        spinner.stop();

        if (options.json) {
            console.log(JSON.stringify(tools, null, 2));
            return;
        }

        console.log(chalk.cyan.bold('\n🔍 Detected AI Tools\n'));

        if (tools.length === 0) {
            console.log(chalk.yellow('No AI tools found.\n'));
            console.log(chalk.gray('Supported tools:'));
            console.log(chalk.gray('  IDEs: Claude Desktop, Cursor, Windsurf, VS Code, Kilo Code'));
            console.log(chalk.gray('  CLI:  Claude Code, Codex, Gemini CLI, OpenCode'));
            console.log(chalk.gray('  Terminal: Warp\n'));
            return;
        }

        printToolList(tools);
    });

program
    .command('configure <tool>')
    .description('Configure a specific tool')
    .option('--force', 'Overwrite existing configuration')
    .action(async (toolName, options) => {
        const tools = await detectIDEs();
        const tool = tools.find(t =>
            t.id === toolName.toLowerCase() ||
            t.name.toLowerCase().includes(toolName.toLowerCase())
        );

        if (!tool) {
            console.log(chalk.red(`\n❌ Tool not found: ${toolName}`));
            console.log(chalk.gray('\nAvailable tools:'));
            tools.forEach(t => console.log(`  - ${t.id} (${t.name})`));
            console.log();
            process.exit(1);
        }

        const spinner = ora(`Configuring ${tool.name}...`).start();

        try {
            const result = await injectConfig(tool, { force: options.force });

            if (result.success) {
                spinner.succeed(`${tool.name}: ${result.message}`);
                if (result.nextSteps) {
                    console.log(chalk.cyan('\nNext steps:'));
                    result.nextSteps.forEach((step, i) => {
                        console.log(`  ${i + 1}. ${step}`);
                    });
                }
            } else {
                spinner.warn(result.message);
            }
        } catch (error) {
            spinner.fail(error instanceof Error ? error.message : 'Failed');
            process.exit(1);
        }
        console.log();
    });

program
    .command('hook')
    .description('Generate shell hook for automatic context updates')
    .option('--install', 'Automatically install hook to shell config')
    .action(async (options) => {
        const hook = generateShellHook();

        if (options.install) {
            // TODO: Auto-install to shell config
            console.log(chalk.yellow('Auto-install not yet implemented.\n'));
            console.log(chalk.cyan('Add this to your shell config:\n'));
        } else {
            console.log(chalk.cyan.bold('\n🪝 ContextOS Shell Hook\n'));
            console.log(chalk.gray('Add this to your ~/.bashrc, ~/.zshrc, or PowerShell $PROFILE:\n'));
        }

        console.log(hook);
    });

program
    .command('uninstall')
    .description('Remove ContextOS from all configured tools')
    .action(async () => {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Remove ContextOS configuration from all tools?',
                default: false,
            },
        ]);

        if (!confirm) {
            console.log(chalk.gray('Cancelled.\n'));
            return;
        }

        const tools = await detectIDEs();
        const configured = tools.filter(t => t.hasExistingConfig);

        if (configured.length === 0) {
            console.log(chalk.gray('No configured tools found.\n'));
            return;
        }

        console.log(chalk.yellow('\nRemoving ContextOS configuration...\n'));

        for (const tool of configured) {
            // TODO: Implement proper removal
            console.log(chalk.gray(`  Would remove from ${tool.name}`));
        }

        console.log(chalk.yellow('\nNote: Removal not yet fully implemented.\n'));
    });

program
    .command('status')
    .description('Show ContextOS integration status')
    .action(async () => {
        console.log(chalk.cyan.bold('\n📊 ContextOS Integration Status\n'));

        const tools = await detectIDEs();
        const configured = tools.filter(t => t.hasExistingConfig);
        const mcpNative = tools.filter(t => t.mcpSupport === 'native');
        const needsWrapper = tools.filter(t => t.mcpSupport === 'wrapper');

        console.log(`  Total tools detected:    ${chalk.bold(tools.length)}`);
        console.log(`  Already configured:      ${chalk.green(configured.length)}`);
        console.log(`  MCP Native support:      ${chalk.cyan(mcpNative.length)}`);
        console.log(`  Need wrapper scripts:    ${chalk.yellow(needsWrapper.length)}`);

        if (tools.length > 0) {
            printToolList(tools);
        }

        console.log(chalk.gray('Run "npx @contextos/setup" to configure all tools.\n'));
    });

// Default to auto if no command specified
program
    .action(async () => {
        await program.commands.find(c => c.name() === 'auto')?.parseAsync(process.argv);
    });

program.parse();
