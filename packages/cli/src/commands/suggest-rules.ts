/**
 * ctx suggest-rules - Use Gemini to suggest coding constraints
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import { parse, stringify } from 'yaml';
import {
    isGeminiAvailable,
    createGeminiClient,
    loadConfig,
    type ContextYamlOutput,
    type ConstraintSuggestion,
} from '@contextos/core';

export const suggestRulesCommand = new Command('suggest-rules')
    .description('Suggest coding constraints using Gemini AI analysis')
    .option('-a, --apply', 'Automatically apply suggested rules')
    .option('-n, --count <number>', 'Number of files to analyze', '5')
    .action(async (options) => {
        console.log(chalk.blue.bold('\n🤖 Gemini Constraint Suggester\n'));

        // Check Gemini availability
        if (!isGeminiAvailable()) {
            console.log(chalk.yellow('⚠️  Gemini API key not configured.'));
            console.log(chalk.gray('   Set GEMINI_API_KEY environment variable to use this feature.\n'));
            console.log(chalk.white('   Example: export GEMINI_API_KEY="your-api-key"\n'));
            return;
        }

        const spinner = ora('Loading project configuration...').start();

        try {
            const config = loadConfig();
            const gemini = createGeminiClient();

            if (!gemini) {
                spinner.fail('Failed to create Gemini client');
                return;
            }

            // Get existing constraints
            type ConstraintItem = { rule: string };
            const existingRules = config.context.constraints?.map((c: ConstraintItem) => c.rule) || [];

            spinner.text = 'Finding sample code files...';

            // Find sample code files
            const extensions = ['*.ts', '*.js', '*.tsx', '*.jsx', '*.py'];
            const patterns = extensions.map(e => `**/${e}`);

            let files = await glob(patterns, {
                cwd: config.rootDir,
                ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/*.test.*', '**/*.spec.*'],
                absolute: true,
            });

            // Limit files
            const maxFiles = parseInt(options.count) || 5;
            files = files.slice(0, maxFiles);

            if (files.length === 0) {
                spinner.fail('No source files found to analyze');
                return;
            }

            spinner.text = `Analyzing ${files.length} files with Gemini...`;

            // Read and combine sample code
            let sampleCode = '';
            for (const file of files) {
                try {
                    const content = readFileSync(file, 'utf-8');
                    const relativePath = file.replace(config.rootDir, '');
                    sampleCode += `\n// File: ${relativePath}\n${content.slice(0, 500)}\n`;
                } catch {
                    // Skip unreadable files
                }
            }

            // Call Gemini for suggestions
            const suggestions = await gemini.suggestConstraints(sampleCode, existingRules);

            spinner.succeed('Analysis complete');

            if (suggestions.length === 0) {
                console.log(chalk.yellow('\n📋 No new constraint suggestions at this time.'));
                console.log(chalk.gray('   Your existing rules seem comprehensive!\n'));
                return;
            }

            // Display suggestions
            console.log(chalk.white.bold('\n📋 Suggested Constraints:\n'));

            suggestions.forEach((suggestion: ConstraintSuggestion, index: number) => {
                const severityIcon = suggestion.severity === 'error' ? '🚫' :
                    suggestion.severity === 'warning' ? '⚠️' : 'ℹ️';
                const severityColor = suggestion.severity === 'error' ? chalk.red :
                    suggestion.severity === 'warning' ? chalk.yellow : chalk.blue;

                console.log(`${chalk.gray(`${index + 1}.`)} ${severityIcon} ${chalk.white.bold(suggestion.rule)}`);
                console.log(`   ${chalk.gray('Severity:')} ${severityColor(suggestion.severity)}`);
                console.log(`   ${chalk.gray('Reason:')} ${suggestion.reason}`);
                console.log();
            });

            // Apply if requested
            if (options.apply) {
                const applySpinner = ora('Applying suggestions to context.yaml...').start();

                try {
                    const contextPath = join(config.rootDir, '.contextos', 'context.yaml');
                    const contextContent = readFileSync(contextPath, 'utf-8');
                    const contextYaml = parse(contextContent) as ContextYamlOutput;

                    // Add new constraints
                    if (!contextYaml.constraints) {
                        contextYaml.constraints = [];
                    }

                    for (const suggestion of suggestions) {
                        contextYaml.constraints.push({
                            rule: suggestion.rule,
                            severity: suggestion.severity,
                        });
                    }

                    // Write back
                    writeFileSync(contextPath, stringify(contextYaml, { indent: 2 }), 'utf-8');

                    applySpinner.succeed(`Added ${suggestions.length} constraints to context.yaml`);
                } catch (error) {
                    applySpinner.fail('Failed to apply suggestions');
                    console.error(chalk.red('Error:'), error);
                }
            } else {
                console.log(chalk.blue('💡 Run with --apply to add these rules to your context.yaml\n'));
            }

        } catch (error) {
            spinner.fail('Suggestion failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
