/**
 * ctx copy - Copy context to clipboard
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getContextBuilder } from '@contextos/core';

export const copyCommand = new Command('copy')
    .description('Copy built context to clipboard')
    .option('-g, --goal <description>', 'Goal for context')
    .option('-m, --max-tokens <number>', 'Maximum tokens', '32000')
    .option('-f, --format <type>', 'Output format: markdown, json, plain', 'markdown')
    .action(async (options) => {
        const spinner = ora('Building context...').start();

        try {
            const builder = await getContextBuilder();

            const result = await builder.build({
                goal: options.goal,
                maxTokens: parseInt(options.maxTokens),
            });

            spinner.text = 'Formatting...';

            let output: string;

            switch (options.format) {
                case 'json':
                    output = JSON.stringify({
                        goal: result.goal,
                        files: result.files.map(f => ({
                            path: f.path,
                            score: f.score.final,
                            content: f.chunks.map(c => c.content).join('\n'),
                        })),
                        rules: result.rules,
                        tokenCount: result.tokenCount,
                    }, null, 2);
                    break;
                case 'plain':
                    output = result.files
                        .map(f => `// ${f.path}\n${f.chunks.map(c => c.content).join('\n')}`)
                        .join('\n\n');
                    break;
                default:
                    output = builder.formatForLLM(result);
            }

            // Copy to clipboard
            const { default: clipboardy } = await import('clipboardy');
            await clipboardy.write(output);

            spinner.succeed('Copied to clipboard');

            console.log();
            console.log(chalk.gray('Context Details:'));
            console.log(chalk.white(`  📊 Tokens: ${chalk.cyan(result.tokenCount.toLocaleString())}`));
            console.log(chalk.white(`  📁 Files: ${chalk.cyan(result.files.length)}`));
            console.log(chalk.white(`  📝 Format: ${chalk.cyan(options.format)}`));
            console.log(chalk.white(`  💰 Savings: ${chalk.green(result.savings.percentage + '%')}`));
            console.log();
            console.log(chalk.green.bold('📋 Context copied to clipboard!\n'));
            console.log(chalk.gray('Paste into your AI assistant to get contextual help.\n'));

        } catch (error) {
            spinner.fail('Copy failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
