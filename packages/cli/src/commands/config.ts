/**
 * ctx config - View and modify configuration settings
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import { loadConfig, type ConfigYamlOutput } from '@contextos/core';

export const configCommand = new Command('config')
    .description('View and modify configuration settings')
    .argument('[key]', 'Configuration key to view/set (e.g., indexing.watch_mode)')
    .argument('[value]', 'Value to set')
    .option('-l, --list', 'List all configuration values')
    .option('-r, --reset', 'Reset to default configuration')
    .option('-e, --edit', 'Open configuration in interactive editor')
    .action(async (key, value, options) => {
        try {
            const config = loadConfig();
            const configPath = join(config.rootDir, '.contextos', 'config.yaml');
            const configContent = readFileSync(configPath, 'utf-8');
            const configYaml = parse(configContent) as ConfigYamlOutput;

            // List all configuration
            if (options.list || (!key && !options.reset && !options.edit)) {
                console.log(chalk.blue.bold('\n⚙️  ContextOS Configuration\n'));
                console.log(chalk.gray('Path:'), configPath);
                console.log();

                printConfig(configYaml);
                return;
            }

            // Reset configuration
            if (options.reset) {
                const { confirm } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Reset configuration to defaults?',
                    default: false,
                }]);

                if (confirm) {
                    const defaultConfig: ConfigYamlOutput = {
                        indexing: {
                            watch_mode: true,
                            ignore_patterns: ['node_modules/**', 'dist/**', '.git/**'],
                            file_size_limit: '1MB',
                        },
                        graph: {
                            max_depth: 2,
                            follow_types: ['import', 'require', 'export'],
                            include_types: true,
                        },
                        embedding: {
                            strategy: 'adaptive',
                            provider: 'local',
                            model: 'all-MiniLM-L6-v2',
                            chunk_size: 512,
                            overlap: 50,
                        },
                        budgeting: {
                            strategy: 'adaptive',
                        },
                    };

                    writeFileSync(configPath, stringify(defaultConfig, { indent: 2 }), 'utf-8');
                    console.log(chalk.green('\n✅ Configuration reset to defaults.\n'));
                }
                return;
            }

            // Interactive edit
            if (options.edit) {
                const answers = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'watchMode',
                        message: 'Enable watch mode (auto-indexing)?',
                        default: configYaml.indexing?.watch_mode ?? true,
                    },
                    {
                        type: 'number',
                        name: 'maxDepth',
                        message: 'Max dependency graph depth:',
                        default: configYaml.graph?.max_depth ?? 2,
                    },
                    {
                        type: 'list',
                        name: 'embeddingStrategy',
                        message: 'Embedding strategy:',
                        choices: ['adaptive', 'full', 'lazy'],
                        default: configYaml.embedding?.strategy ?? 'adaptive',
                    },
                    {
                        type: 'number',
                        name: 'chunkSize',
                        message: 'Chunk size (tokens):',
                        default: configYaml.embedding?.chunk_size ?? 512,
                    },
                    {
                        type: 'input',
                        name: 'targetModel',
                        message: 'Target LLM model:',
                        default: configYaml.budgeting?.target_model ?? 'gpt-4-turbo',
                    },
                ]);

                configYaml.indexing = { ...configYaml.indexing, watch_mode: answers.watchMode };
                configYaml.graph = { ...configYaml.graph, max_depth: answers.maxDepth };
                configYaml.embedding = {
                    ...configYaml.embedding,
                    strategy: answers.embeddingStrategy,
                    chunk_size: answers.chunkSize,
                };
                configYaml.budgeting = { ...configYaml.budgeting, target_model: answers.targetModel };

                writeFileSync(configPath, stringify(configYaml, { indent: 2 }), 'utf-8');
                console.log(chalk.green('\n✅ Configuration updated.\n'));
                return;
            }

            // Get/set specific key
            if (key) {
                const keys = key.split('.');

                if (value !== undefined) {
                    // Set value
                    setNestedValue(configYaml, keys, parseValue(value));
                    writeFileSync(configPath, stringify(configYaml, { indent: 2 }), 'utf-8');
                    console.log(chalk.green(`\n✅ Set ${key} = ${value}\n`));
                } else {
                    // Get value
                    const val = getNestedValue(configYaml, keys);
                    if (val !== undefined) {
                        console.log(`\n${chalk.cyan(key)}: ${formatValue(val)}\n`);
                    } else {
                        console.log(chalk.yellow(`\n⚠️  Key '${key}' not found.\n`));
                    }
                }
            }

        } catch (error) {
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });

function printConfig(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            console.log(chalk.white.bold(`${fullKey}:`));
            printConfig(value as Record<string, unknown>, fullKey);
        } else {
            console.log(`  ${chalk.cyan(fullKey)}: ${formatValue(value)}`);
        }
    }
}

function formatValue(value: unknown): string {
    if (Array.isArray(value)) {
        return chalk.gray(`[${value.join(', ')}]`);
    }
    if (typeof value === 'boolean') {
        return value ? chalk.green('true') : chalk.red('false');
    }
    if (typeof value === 'number') {
        return chalk.yellow(String(value));
    }
    return chalk.white(String(value));
}

function getNestedValue(obj: Record<string, unknown>, keys: string[]): unknown {
    let current: unknown = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = (current as Record<string, unknown>)[key];
        } else {
            return undefined;
        }
    }
    return current;
}

function setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
}

function parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
}
