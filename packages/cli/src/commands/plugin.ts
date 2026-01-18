/**
 * Plugin CLI Command
 * Manage ContextOS plugins
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { createPluginManager, createPluginRegistry } from '@contextos/core';
import type { PluginTemplate, PluginHooks } from '@contextos/core';

/**
 * Register plugin command
 */
export function registerPluginCommand(program: Command): void {
    const plugin = program
        .command('plugin')
        .description('Manage ContextOS plugins');

    // List plugins
    plugin
        .command('list')
        .description('List installed plugins')
        .option('-a, --all', 'Include disabled plugins')
        .option('--remote', 'Show available plugins from registry')
        .action(async (options) => {
            const cwd = process.cwd();
            const registry = createPluginRegistry(cwd);

            if (options.remote) {
                console.log(chalk.cyan('\n📦 Featured Plugins:\n'));
                const featured = await registry.getFeatured();

                for (const plugin of featured) {
                    const installed = registry.isInstalled(plugin.name);
                    const status = installed ? chalk.green('✓ installed') : '';
                    console.log(`  ${chalk.bold(plugin.name)} ${chalk.gray(`v${plugin.version}`)} ${status}`);
                    console.log(`    ${plugin.description}`);
                    console.log(`    ${chalk.gray(`Downloads: ${plugin.downloads}`)}\n`);
                }
                return;
            }

            const plugins = registry.listLocal();

            if (plugins.length === 0) {
                console.log(chalk.yellow('\nNo plugins installed.'));
                console.log(chalk.gray('Run `ctx plugin list --remote` to see available plugins.\n'));
                return;
            }

            console.log(chalk.cyan('\n🔌 Installed Plugins:\n'));

            for (const plugin of plugins) {
                if (!options.all && !plugin.enabled) continue;

                const status = plugin.enabled
                    ? chalk.green('● enabled')
                    : chalk.gray('○ disabled');

                console.log(`  ${status} ${chalk.bold(plugin.name)} ${chalk.gray(`v${plugin.version}`)}`);
                console.log(`    ${plugin.description || 'No description'}`);
                console.log(`    ${chalk.gray(plugin.path)}\n`);
            }
        });

    // Install plugin
    plugin
        .command('install <source>')
        .description('Install a plugin')
        .option('-l, --local', 'Install from local path')
        .option('-f, --force', 'Force reinstall')
        .action(async (source, options) => {
            const spinner = ora('Installing plugin...').start();

            try {
                const cwd = process.cwd();
                const manager = createPluginManager(cwd);

                const plugin = await manager.install(source, {
                    local: options.local,
                    force: options.force,
                });

                spinner.succeed(`Installed ${chalk.bold(plugin.name)} v${plugin.version}`);
            } catch (error) {
                spinner.fail(`Failed to install plugin`);
                console.error(chalk.red(error instanceof Error ? error.message : String(error)));
                process.exit(1);
            }
        });

    // Remove plugin
    plugin
        .command('remove <name>')
        .alias('uninstall')
        .description('Remove a plugin')
        .option('-f, --force', 'Skip confirmation')
        .action(async (name, options) => {
            const cwd = process.cwd();
            const registry = createPluginRegistry(cwd);

            const localPlugin = registry.getLocal(name);
            if (!localPlugin) {
                console.log(chalk.red(`Plugin not found: ${name}`));
                process.exit(1);
            }

            if (!options.force) {
                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Remove plugin ${chalk.bold(name)}?`,
                        default: false,
                    },
                ]);

                if (!confirm) {
                    console.log(chalk.gray('Cancelled.'));
                    return;
                }
            }

            const spinner = ora('Removing plugin...').start();

            try {
                const manager = createPluginManager(cwd);
                await manager.uninstall(name);
                spinner.succeed(`Removed ${chalk.bold(name)}`);
            } catch (error) {
                spinner.fail(`Failed to remove plugin`);
                console.error(chalk.red(error instanceof Error ? error.message : String(error)));
                process.exit(1);
            }
        });

    // Enable plugin
    plugin
        .command('enable <name>')
        .description('Enable a disabled plugin')
        .action(async (name) => {
            const cwd = process.cwd();
            const manager = createPluginManager(cwd);

            await manager.loadAll();
            const success = await manager.enablePlugin(name);

            if (success) {
                console.log(chalk.green(`✓ Enabled ${chalk.bold(name)}`));
            } else {
                console.log(chalk.red(`Plugin not found: ${name}`));
                process.exit(1);
            }
        });

    // Disable plugin
    plugin
        .command('disable <name>')
        .description('Disable a plugin')
        .action(async (name) => {
            const cwd = process.cwd();
            const manager = createPluginManager(cwd);

            await manager.loadAll();
            const success = await manager.disablePlugin(name);

            if (success) {
                console.log(chalk.green(`✓ Disabled ${chalk.bold(name)}`));
            } else {
                console.log(chalk.red(`Plugin not found: ${name}`));
                process.exit(1);
            }
        });

    // Create new plugin
    plugin
        .command('create <name>')
        .description('Create a new plugin scaffold')
        .option('-d, --description <desc>', 'Plugin description')
        .option('-a, --author <author>', 'Plugin author')
        .option('--with-commands', 'Include command examples')
        .action(async (name, options) => {
            const cwd = process.cwd();

            // Interactive prompts if options not provided
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'description',
                    message: 'Plugin description:',
                    default: options.description || `A ContextOS plugin`,
                    when: !options.description,
                },
                {
                    type: 'input',
                    name: 'author',
                    message: 'Author:',
                    default: options.author || process.env.USER || 'Anonymous',
                    when: !options.author,
                },
                {
                    type: 'checkbox',
                    name: 'hooks',
                    message: 'Select hooks to implement:',
                    choices: [
                        { name: 'onBeforeContextBuild', value: 'onBeforeContextBuild' },
                        { name: 'onAfterContextBuild', value: 'onAfterContextBuild' },
                        { name: 'onBeforeIndex', value: 'onBeforeIndex' },
                        { name: 'onAfterIndex', value: 'onAfterIndex' },
                        { name: 'onBeforeAnalyze', value: 'onBeforeAnalyze' },
                        { name: 'onAfterAnalyze', value: 'onAfterAnalyze' },
                        { name: 'fileFilter', value: 'fileFilter' },
                        { name: 'rankingBoost', value: 'rankingBoost' },
                    ],
                    default: ['onAfterContextBuild'],
                },
            ]);

            const template: PluginTemplate = {
                name,
                description: options.description || answers.description,
                author: options.author || answers.author,
                hooks: answers.hooks as (keyof PluginHooks)[],
                withCommands: options.withCommands || false,
            };

            const spinner = ora('Creating plugin scaffold...').start();

            try {
                const manager = createPluginManager(cwd);
                const pluginPath = manager.createPluginScaffold(template);

                spinner.succeed(`Created plugin at ${chalk.cyan(pluginPath)}`);
                console.log(`\n${chalk.gray('Next steps:')}`);
                console.log(`  1. Edit ${chalk.cyan(`${pluginPath}/index.js`)}`);
                console.log(`  2. Run ${chalk.cyan(`ctx plugin enable ${name}`)}`);
                console.log(`  3. Test your plugin!\n`);
            } catch (error) {
                spinner.fail(`Failed to create plugin`);
                console.error(chalk.red(error instanceof Error ? error.message : String(error)));
                process.exit(1);
            }
        });

    // Run plugin command
    plugin
        .command('run <plugin> <command> [args...]')
        .description('Run a custom command from a plugin')
        .action(async (pluginName, command, args) => {
            const cwd = process.cwd();
            const manager = createPluginManager(cwd);

            await manager.loadAll();
            const pluginState = manager.get(pluginName);

            if (!pluginState) {
                console.log(chalk.red(`Plugin not found: ${pluginName}`));
                process.exit(1);
            }

            const cmd = pluginState.instance.commands?.[command];
            if (!cmd) {
                console.log(chalk.red(`Command not found: ${command}`));
                console.log(chalk.gray('Available commands:'));

                const commands = Object.keys(pluginState.instance.commands || {});
                if (commands.length === 0) {
                    console.log(chalk.gray('  (none)'));
                } else {
                    for (const c of commands) {
                        console.log(`  ${c}`);
                    }
                }
                process.exit(1);
            }

            try {
                // Create minimal context for command execution
                const context = {
                    projectRoot: cwd,
                    configDir: `${cwd}/.contextos`,
                    log: {
                        debug: console.debug,
                        info: console.info,
                        warn: console.warn,
                        error: console.error,
                    },
                    query: async () => ({ files: [], context: '' }),
                    readFile: async () => '',
                    getDependencies: async () => [],
                    storage: {
                        get: () => undefined,
                        set: () => { },
                        delete: () => false,
                    },
                };

                await cmd.handler(args, context as any);
            } catch (error) {
                console.error(chalk.red(`Command failed: ${error instanceof Error ? error.message : String(error)}`));
                process.exit(1);
            }
        });
}
