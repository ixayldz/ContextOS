#!/usr/bin/env node
/**
 * ContextOS Setup CLI
 * One-click setup for all your IDEs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { detectIDEs, type IDEInfo } from './detectors/index.js';
import { injectConfig, type InjectResult } from './injectors/index.js';

const program = new Command();

program
    .name('contextos-setup')
    .description('One-click ContextOS setup for all your IDEs')
    .version('0.1.0');

program
    .command('auto')
    .description('Automatically detect and configure all IDEs')
    .option('--dry-run', 'Show what would be configured without making changes')
    .option('--force', 'Overwrite existing configurations')
    .action(async (options) => {
        console.log(chalk.cyan.bold('\n🚀 ContextOS Auto Setup\n'));

        const spinner = ora('Detecting installed IDEs...').start();

        try {
            const ides = await detectIDEs();

            if (ides.length === 0) {
                spinner.warn('No supported IDEs detected');
                console.log(chalk.gray('\nSupported IDEs: Claude Desktop, Cursor, Windsurf, VS Code\n'));
                return;
            }

            spinner.succeed(`Found ${ides.length} IDE(s)`);

            console.log(chalk.gray('\nDetected IDEs:'));
            ides.forEach(ide => {
                const status = ide.hasExistingConfig ? chalk.yellow('⚠ has config') : chalk.green('✓ ready');
                console.log(`  ${ide.name} ${status}`);
            });

            if (options.dryRun) {
                console.log(chalk.yellow('\n[Dry Run] Would configure:'));
                ides.forEach(ide => console.log(`  - ${ide.name}`));
                return;
            }

            // Confirm before proceeding
            const { proceed } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Configure ContextOS for these IDEs?',
                    default: true,
                },
            ]);

            if (!proceed) {
                console.log(chalk.gray('Setup cancelled.\n'));
                return;
            }

            // Configure each IDE
            console.log();
            const results: InjectResult[] = [];

            for (const ide of ides) {
                const configSpinner = ora(`Configuring ${ide.name}...`).start();

                try {
                    const result = await injectConfig(ide, { force: options.force });
                    results.push(result);

                    if (result.success) {
                        configSpinner.succeed(`${ide.name} configured`);
                    } else {
                        configSpinner.warn(`${ide.name}: ${result.message}`);
                    }
                } catch (error) {
                    configSpinner.fail(`${ide.name} failed`);
                    results.push({
                        ide: ide.name,
                        success: false,
                        message: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            // Summary
            const successful = results.filter(r => r.success).length;
            console.log(chalk.green(`\n✅ Setup complete: ${successful}/${ides.length} IDEs configured\n`));

            if (successful > 0) {
                console.log(chalk.cyan('Next steps:'));
                console.log('  1. Restart your IDE(s)');
                console.log('  2. Open a project folder');
                console.log('  3. ContextOS will be available in your AI assistant!\n');
            }

        } catch (error) {
            spinner.fail('Setup failed');
            console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List detected IDEs and their status')
    .action(async () => {
        console.log(chalk.cyan.bold('\n🔍 Detected IDEs\n'));

        const spinner = ora('Scanning...').start();
        const ides = await detectIDEs();
        spinner.stop();

        if (ides.length === 0) {
            console.log(chalk.yellow('No supported IDEs found.\n'));
            console.log(chalk.gray('Supported: Claude Desktop, Cursor, Windsurf, VS Code\n'));
            return;
        }

        console.log(chalk.gray('IDE                     Status              Config Path'));
        console.log(chalk.gray('─'.repeat(70)));

        ides.forEach(ide => {
            const status = ide.hasExistingConfig
                ? chalk.yellow('Configured')
                : chalk.green('Ready');
            const configPath = ide.configPath.length > 35
                ? '...' + ide.configPath.slice(-32)
                : ide.configPath;
            console.log(`${ide.name.padEnd(24)}${status.padEnd(20)}${chalk.gray(configPath)}`);
        });
        console.log();
    });

program
    .command('configure <ide>')
    .description('Configure a specific IDE (claude, cursor, windsurf, vscode)')
    .option('--force', 'Overwrite existing configuration')
    .action(async (ideName, options) => {
        const ides = await detectIDEs();
        const ide = ides.find(i => i.id === ideName.toLowerCase());

        if (!ide) {
            console.log(chalk.red(`\nIDE not found: ${ideName}`));
            console.log(chalk.gray('Available: claude, cursor, windsurf, vscode\n'));
            process.exit(1);
        }

        const spinner = ora(`Configuring ${ide.name}...`).start();

        try {
            const result = await injectConfig(ide, { force: options.force });

            if (result.success) {
                spinner.succeed(result.message);
            } else {
                spinner.warn(result.message);
            }
        } catch (error) {
            spinner.fail(error instanceof Error ? error.message : 'Failed');
            process.exit(1);
        }
    });

program
    .command('uninstall')
    .description('Remove ContextOS from all configured IDEs')
    .action(async () => {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Remove ContextOS configuration from all IDEs?',
                default: false,
            },
        ]);

        if (!confirm) {
            console.log(chalk.gray('Cancelled.\n'));
            return;
        }

        const ides = await detectIDEs();

        for (const ide of ides) {
            if (ide.hasExistingConfig) {
                // TODO: Implement removal
                console.log(chalk.yellow(`Would remove from ${ide.name}`));
            }
        }
    });

// Default to auto if no command specified
program
    .action(async () => {
        await program.commands.find(c => c.name() === 'auto')?.parseAsync(process.argv);
    });

program.parse();
