/**
 * ctx build - Build context (infer goal from git diff)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getContextBuilder } from '@contextos/core';

export const buildCommand = new Command('build')
    .description('Build context (infers goal from git diff)')
    .option('-m, --max-tokens <number>', 'Maximum tokens for context', '32000')
    .option('-f, --file <path>', 'Target file for context')
    .option('--no-rules', 'Exclude coding rules from context')
    .action(async (options) => {
        console.log(chalk.blue.bold('\n🔨 Building context...\n'));

        const spinner = ora('Analyzing project...').start();

        try {
            const builder = await getContextBuilder();

            spinner.text = 'Inferring goal from git diff...';

            const result = await builder.build({
                maxTokens: parseInt(options.maxTokens),
                targetFile: options.file,
                includeRules: options.rules,
            });

            spinner.succeed('Context built');

            // Display results
            console.log();
            console.log(chalk.gray('Goal: ') + chalk.white(result.goal));
            console.log();

            console.log(chalk.gray('Included Files:'));
            for (const file of result.files.slice(0, 10)) {
                const scoreStr = (file.score.final * 100).toFixed(0) + '%';
                console.log(chalk.white(`  📄 ${file.path} ${chalk.gray(`(${scoreStr} - ${file.reason})`)}`));
            }
            if (result.files.length > 10) {
                console.log(chalk.gray(`  ... and ${result.files.length - 10} more files`));
            }

            console.log();
            console.log(chalk.gray('Statistics:'));
            console.log(chalk.white(`  📊 Token count: ${chalk.cyan(result.tokenCount.toLocaleString())}`));
            console.log(chalk.white(`  💰 Token savings: ${chalk.green(result.savings.percentage + '%')}`));
            console.log(chalk.white(`  ⏱️  Build time: ${chalk.cyan(result.meta.buildTime + 'ms')}`));

            console.log();
            console.log(chalk.green('✅ Context ready. Run "ctx copy" to copy to clipboard.\n'));

        } catch (error) {
            spinner.fail('Build failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
