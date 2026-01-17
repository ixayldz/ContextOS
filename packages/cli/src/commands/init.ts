/**
 * ctx init - Initialize ContextOS in the current directory
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import {
    detectProjectType,
    type ContextYamlOutput,
    type ConfigYamlOutput,
} from '@contextos/core';

const CONTEXTOS_DIR = '.contextos';

export const initCommand = new Command('init')
    .description('Initialize ContextOS in the current directory')
    .option('-t, --template <name>', 'Use a community template')
    .option('-y, --yes', 'Skip interactive prompts')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
        const cwd = process.cwd();
        const contextosPath = join(cwd, CONTEXTOS_DIR);

        // Check if already initialized
        if (existsSync(contextosPath) && !options.force) {
            console.log(chalk.yellow('⚠️  ContextOS is already initialized in this directory.'));
            console.log(chalk.gray('   Use --force to reinitialize.\n'));
            return;
        }

        console.log(chalk.blue.bold('\n🚀 Initializing ContextOS...\n'));

        // Auto-detect project type
        const spinner = ora('Detecting project type...').start();
        const detected = await detectProjectType(cwd);
        spinner.succeed(`Detected: ${chalk.cyan(detected.language)}${detected.framework ? ` / ${chalk.cyan(detected.framework)}` : ''}`);

        // Interactive prompts (unless --yes)
        let projectName = cwd.split(/[\\/]/).pop() || 'my-project';
        let description = '';

        if (!options.yes) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectName',
                    message: 'Project name:',
                    default: projectName,
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Project description (optional):',
                },
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Create .contextos folder?',
                    default: true,
                },
            ]);

            if (!answers.proceed) {
                console.log(chalk.yellow('\nInitialization cancelled.'));
                return;
            }

            projectName = answers.projectName;
            description = answers.description;
        }

        // Create .contextos directory structure
        const createSpinner = ora('Creating .contextos folder...').start();

        try {
            // Create directories
            mkdirSync(contextosPath, { recursive: true });
            mkdirSync(join(contextosPath, 'db'), { recursive: true });
            mkdirSync(join(contextosPath, 'rules'), { recursive: true });

            // Create context.yaml
            const contextYaml: ContextYamlOutput = {
                version: '3.1',
                project: {
                    name: projectName,
                    language: detected.language,
                    framework: detected.framework,
                    description: description || undefined,
                },
                stack: {},
                constraints: [
                    {
                        rule: 'Follow project coding conventions',
                        severity: 'warning',
                    },
                ],
                boundaries: [],
                meta: {
                    last_indexed: new Date().toISOString(),
                    index_version: '3.1',
                },
            };

            writeFileSync(
                join(contextosPath, 'context.yaml'),
                stringify(contextYaml, { indent: 2 }),
                'utf-8'
            );

            // Create config.yaml
            const configYaml: ConfigYamlOutput = {
                indexing: {
                    watch_mode: true,
                    ignore_patterns: [
                        '**/*.test.ts',
                        '**/*.spec.ts',
                        'node_modules/**',
                        'dist/**',
                        '.git/**',
                    ],
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

            writeFileSync(
                join(contextosPath, 'config.yaml'),
                stringify(configYaml, { indent: 2 }),
                'utf-8'
            );

            // Create coding rules template
            const codingRules = `# Coding Rules

## General Guidelines

- Follow the established patterns in this codebase
- Write clean, readable code
- Add comments for complex logic

## Architecture

- Separate concerns appropriately
- Use dependency injection where applicable

## Testing

- Write tests for new functionality
- Maintain test coverage
`;

            writeFileSync(
                join(contextosPath, 'rules', 'coding.md'),
                codingRules,
                'utf-8'
            );

            createSpinner.succeed('Created .contextos folder');

            // Summary
            console.log(chalk.green.bold('\n✅ ContextOS initialized successfully!\n'));
            console.log(chalk.gray('Created:'));
            console.log(chalk.gray('  .contextos/context.yaml    - Project configuration'));
            console.log(chalk.gray('  .contextos/config.yaml     - Tool settings'));
            console.log(chalk.gray('  .contextos/rules/coding.md - Coding guidelines'));
            console.log();
            console.log(chalk.blue('Next steps:'));
            console.log(chalk.white('  1. Edit .contextos/context.yaml to customize your project'));
            console.log(chalk.white('  2. Run "ctx index" to build the initial index'));
            console.log(chalk.white('  3. Run "ctx goal <description>" to build context\n'));

        } catch (error) {
            createSpinner.fail('Failed to create .contextos folder');
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
