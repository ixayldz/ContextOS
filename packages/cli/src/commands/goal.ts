/**
 * ctx goal - Set explicit goal and build context
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getContextBuilder } from '@contextos/core';

export const goalCommand = new Command('goal')
    .description('Set explicit goal and build context')
    .argument('<description>', 'Goal description')
    .option('-m, --max-tokens <number>', 'Maximum tokens for context', '32000')
    .option('-f, --file <path>', 'Target file for context')
    .option('--no-rules', 'Exclude coding rules from context')
    .option('-c, --copy', 'Copy to clipboard after building')
    .action(async (description, options) => {
        console.log(chalk.blue.bold('\n🎯 Building context for goal...\n'));
        console.log(chalk.gray('Goal: ') + chalk.white(description));
        console.log();

        const spinner = ora('Analyzing relevance...').start();

        try {
            const builder = await getContextBuilder();

            spinner.text = 'Ranking files...';

            const result = await builder.build({
                goal: description,
                maxTokens: parseInt(options.maxTokens),
                targetFile: options.file,
                includeRules: options.rules,
            });

            spinner.succeed('Context built');

            // Display top files
            console.log();
            console.log(chalk.gray('Top Relevant Files:'));
            for (const file of result.files.slice(0, 8)) {
                const scoreStr = (file.score.final * 100).toFixed(0) + '%';
                console.log(chalk.white(`  📄 ${file.path}`));
                console.log(chalk.gray(`     Score: ${scoreStr} | ${file.reason}`));
            }

            // Display rules if included
            if (result.rules.length > 0) {
                console.log();
                console.log(chalk.gray('Applied Rules:'));
                for (const rule of result.rules.slice(0, 3)) {
                    const icon = rule.severity === 'error' ? '🚫' : '⚠️';
                    console.log(chalk.white(`  ${icon} ${rule.rule}`));
                }
            }

            console.log();
            console.log(chalk.gray('Summary:'));
            console.log(chalk.white(`  📊 Tokens: ${chalk.cyan(result.tokenCount.toLocaleString())} / ${options.maxTokens}`));
            console.log(chalk.white(`  📁 Files: ${chalk.cyan(result.files.length)} included`));
            console.log(chalk.white(`  💰 Savings: ${chalk.green(result.savings.percentage + '%')} token reduction`));

            // Copy to clipboard if requested
            if (options.copy) {
                const { default: clipboardy } = await import('clipboardy');
                const formatted = builder.formatForLLM(result);
                await clipboardy.write(formatted);
                console.log();
                console.log(chalk.green('📋 Copied to clipboard!'));
            }

            console.log();
            if (!options.copy) {
                console.log(chalk.blue('Run "ctx copy" to copy to clipboard, or "ctx preview" for details.\n'));
            }

        } catch (error) {
            spinner.fail('Goal building failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
