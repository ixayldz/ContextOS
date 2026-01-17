/**
 * ctx preview - Preview context without copying
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getContextBuilder } from '@contextos/core';

export const previewCommand = new Command('preview')
    .description('Preview context without copying')
    .option('-g, --goal <description>', 'Override goal for preview')
    .option('-m, --max-tokens <number>', 'Maximum tokens', '32000')
    .action(async (options) => {
        console.log(chalk.blue.bold('\n👁️  Context Preview\n'));

        const spinner = ora('Loading context...').start();

        try {
            const builder = await getContextBuilder();

            const result = await builder.build({
                goal: options.goal,
                maxTokens: parseInt(options.maxTokens),
            });

            spinner.stop();

            // Header box
            console.log(chalk.gray('┌' + '─'.repeat(68) + '┐'));
            console.log(chalk.gray('│') + ` ${chalk.white.bold('Context Summary')}`.padEnd(77) + chalk.gray('│'));
            console.log(chalk.gray('├' + '─'.repeat(68) + '┤'));

            // Goal
            const goalLine = ` Goal: ${result.goal}`;
            console.log(chalk.gray('│') + chalk.white(goalLine.substring(0, 68).padEnd(68)) + chalk.gray('│'));

            console.log(chalk.gray('├' + '─'.repeat(68) + '┤'));

            // Token breakdown
            const tokenBudget = parseInt(options.maxTokens);
            const usedPercent = Math.round((result.tokenCount / tokenBudget) * 100);
            const barLength = 40;
            const filledLength = Math.round((usedPercent / 100) * barLength);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

            console.log(chalk.gray('│') + ` Tokens: ${result.tokenCount.toLocaleString()} / ${tokenBudget.toLocaleString()}`.padEnd(68) + chalk.gray('│'));
            console.log(chalk.gray('│') + ` [${bar}] ${usedPercent}%`.padEnd(68) + chalk.gray('│'));

            console.log(chalk.gray('├' + '─'.repeat(68) + '┤'));

            // Files section
            console.log(chalk.gray('│') + chalk.white.bold(' 📁 Included Files (' + result.files.length + ')').padEnd(77) + chalk.gray('│'));
            console.log(chalk.gray('│') + ' '.repeat(68) + chalk.gray('│'));

            for (const file of result.files.slice(0, 6)) {
                const score = (file.score.final * 100).toFixed(0);
                const line = `   ${file.path}`;
                const scorePart = ` ${score}%`;
                const paddedLine = line.substring(0, 58).padEnd(58) + chalk.gray(scorePart);
                console.log(chalk.gray('│') + paddedLine.padEnd(77) + chalk.gray('│'));
            }

            if (result.files.length > 6) {
                console.log(chalk.gray('│') + chalk.gray(`   ... and ${result.files.length - 6} more files`).padEnd(68) + chalk.gray('│'));
            }

            console.log(chalk.gray('├' + '─'.repeat(68) + '┤'));

            // Rules section
            if (result.rules.length > 0) {
                console.log(chalk.gray('│') + chalk.white.bold(' 📋 Active Rules (' + result.rules.length + ')').padEnd(77) + chalk.gray('│'));
                for (const rule of result.rules.slice(0, 3)) {
                    const icon = rule.severity === 'error' ? '🚫' : '⚠️';
                    const line = `   ${icon} ${rule.rule}`;
                    console.log(chalk.gray('│') + line.substring(0, 68).padEnd(68) + chalk.gray('│'));
                }
                console.log(chalk.gray('├' + '─'.repeat(68) + '┤'));
            }

            // Savings
            console.log(chalk.gray('│') + chalk.green.bold(` 💰 Token Savings: ${result.savings.percentage}%`).padEnd(77) + chalk.gray('│'));
            console.log(chalk.gray('│') + chalk.gray(`    Original: ${result.savings.original.toLocaleString()} → Optimized: ${result.savings.optimized.toLocaleString()}`).padEnd(68) + chalk.gray('│'));

            console.log(chalk.gray('└' + '─'.repeat(68) + '┘'));

            console.log();
            console.log(chalk.blue('Run "ctx copy" to copy this context to clipboard.\n'));

        } catch (error) {
            spinner.fail('Preview failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
