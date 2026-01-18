/**
 * Fine-tune CLI Command
 * Export and validate training data for model fine-tuning
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
    createTrainingDataCollector,
    createDatasetFormatter
} from '@contextos/core';
import type { ExportFormat, DatasetConfig } from '@contextos/core';

/**
 * Register finetune command
 */
export function registerFinetuneCommand(program: Command): void {
    const finetune = program
        .command('finetune')
        .description('Training data management for model fine-tuning');

    // Export command
    finetune
        .command('export')
        .description('Export training data to file')
        .option('-o, --output <path>', 'Output file path', './training-data.jsonl')
        .option('-f, --format <format>', 'Output format (jsonl, openai, anthropic, csv)', 'jsonl')
        .option('-m, --max <count>', 'Maximum examples to export', parseInt)
        .option('-r, --min-rating <rating>', 'Minimum rating (good, neutral, bad)')
        .option('-l, --language <lang>', 'Filter by language')
        .option('--shuffle', 'Shuffle examples')
        .option('--split <ratio>', 'Train/validation split ratio', parseFloat)
        .action(async (options) => {
            const cwd = process.cwd();
            const spinner = ora('Exporting training data...').start();

            try {
                const collector = createTrainingDataCollector(cwd);
                const formatter = createDatasetFormatter();
                const examples = collector.getAll();

                if (examples.length === 0) {
                    spinner.warn('No training data found');
                    console.log(chalk.gray('\nTraining data is collected automatically when you use ctx goal/build commands.'));
                    return;
                }

                const format: ExportFormat = {
                    format: options.format as ExportFormat['format'],
                };

                const config: DatasetConfig = {
                    maxExamples: options.max,
                    minRating: options.minRating,
                    languageFilter: options.language,
                    shuffle: options.shuffle,
                    validationSplit: options.split,
                };

                if (options.split) {
                    const outputDir = options.output.replace(/\.[^.]+$/, '');
                    const result = await formatter.exportWithSplit(
                        examples,
                        outputDir,
                        format,
                        config
                    );
                    spinner.succeed('Export complete');
                    console.log(`\n  Train: ${chalk.cyan(result.train)} examples → ${outputDir}/train.jsonl`);
                    console.log(`  Validation: ${chalk.cyan(result.validation)} examples → ${outputDir}/validation.jsonl`);
                } else {
                    const result = await formatter.export(
                        examples,
                        options.output,
                        format,
                        config
                    );
                    spinner.succeed(`Exported ${chalk.cyan(result.exported)} examples to ${chalk.cyan(result.path)}`);
                }

            } catch (error) {
                spinner.fail('Export failed');
                console.error(chalk.red(error instanceof Error ? error.message : String(error)));
                process.exit(1);
            }
        });

    // Validate command
    finetune
        .command('validate <file>')
        .description('Validate a training data file')
        .action(async (file) => {
            const spinner = ora('Validating dataset...').start();

            try {
                const formatter = createDatasetFormatter();
                const result = await formatter.validate(file);

                if (result.valid) {
                    spinner.succeed('Dataset is valid');
                } else {
                    spinner.fail('Dataset has errors');
                }

                console.log(`\n${chalk.bold('Statistics:')}`);
                console.log(`  Total examples: ${chalk.cyan(result.stats.totalExamples)}`);
                console.log(`  Avg tokens: ${chalk.cyan(result.stats.avgTokenCount)}`);
                console.log(`  Avg files/example: ${chalk.cyan(result.stats.avgFilesPerExample)}`);

                console.log(`\n${chalk.bold('Rating Distribution:')}`);
                console.log(`  ${chalk.green('Good')}: ${result.stats.ratingDistribution.good}`);
                console.log(`  ${chalk.yellow('Neutral')}: ${result.stats.ratingDistribution.neutral}`);
                console.log(`  ${chalk.red('Bad')}: ${result.stats.ratingDistribution.bad}`);
                console.log(`  ${chalk.gray('Unrated')}: ${result.stats.ratingDistribution.unrated}`);

                if (Object.keys(result.stats.languageDistribution).length > 0) {
                    console.log(`\n${chalk.bold('Languages:')}`);
                    for (const [lang, count] of Object.entries(result.stats.languageDistribution)) {
                        console.log(`  ${lang}: ${count}`);
                    }
                }

                if (result.errors.length > 0) {
                    console.log(`\n${chalk.red.bold('Errors:')}`);
                    for (const error of result.errors.slice(0, 10)) {
                        console.log(`  Line ${error.line}: ${error.message}`);
                    }
                    if (result.errors.length > 10) {
                        console.log(chalk.gray(`  ... and ${result.errors.length - 10} more`));
                    }
                }

                if (result.warnings.length > 0) {
                    console.log(`\n${chalk.yellow.bold('Warnings:')}`);
                    for (const warning of result.warnings) {
                        console.log(`  ⚠ ${warning}`);
                    }
                }

            } catch (error) {
                spinner.fail('Validation failed');
                console.error(chalk.red(error instanceof Error ? error.message : String(error)));
                process.exit(1);
            }
        });

    // Stats command
    finetune
        .command('stats')
        .description('Show training data statistics')
        .action(async () => {
            const cwd = process.cwd();
            const collector = createTrainingDataCollector(cwd);
            const stats = collector.getStats();

            console.log(chalk.cyan.bold('\n📊 Training Data Statistics\n'));

            if (stats.totalExamples === 0) {
                console.log(chalk.yellow('No training data collected yet.'));
                console.log(chalk.gray('\nTraining data is collected when you use ctx goal/build commands.\n'));
                return;
            }

            console.log(`${chalk.bold('Total Examples:')} ${stats.totalExamples}`);
            console.log(`${chalk.bold('Avg Token Count:')} ${stats.avgTokenCount}`);
            console.log(`${chalk.bold('Avg Files/Example:')} ${stats.avgFilesPerExample}`);

            console.log(`\n${chalk.bold('Rating Distribution:')}`);
            const total = stats.totalExamples;
            const pct = (n: number) => ((n / total) * 100).toFixed(1);
            console.log(`  ${chalk.green('●')} Good: ${stats.ratingDistribution.good} (${pct(stats.ratingDistribution.good)}%)`);
            console.log(`  ${chalk.yellow('●')} Neutral: ${stats.ratingDistribution.neutral} (${pct(stats.ratingDistribution.neutral)}%)`);
            console.log(`  ${chalk.red('●')} Bad: ${stats.ratingDistribution.bad} (${pct(stats.ratingDistribution.bad)}%)`);
            console.log(`  ${chalk.gray('○')} Unrated: ${stats.ratingDistribution.unrated} (${pct(stats.ratingDistribution.unrated)}%)`);

            console.log(`\n${chalk.bold('Languages:')}`);
            for (const [lang, count] of Object.entries(stats.languageDistribution)) {
                console.log(`  ${lang}: ${count} (${pct(count)}%)`);
            }

            console.log(`\n${chalk.bold('Date Range:')}`);
            console.log(`  From: ${stats.dateRange.earliest.toLocaleDateString()}`);
            console.log(`  To: ${stats.dateRange.latest.toLocaleDateString()}`);
            console.log();
        });

    // Feedback command
    finetune
        .command('feedback <id> <rating>')
        .description('Add feedback to a training example (good/bad/neutral)')
        .option('-c, --comment <comment>', 'Optional comment')
        .action(async (id, rating, options) => {
            const validRatings = ['good', 'bad', 'neutral'];
            if (!validRatings.includes(rating)) {
                console.error(chalk.red(`Invalid rating. Use: ${validRatings.join(', ')}`));
                process.exit(1);
            }

            const cwd = process.cwd();
            const collector = createTrainingDataCollector(cwd);

            const success = collector.addFeedback(
                id,
                rating as 'good' | 'bad' | 'neutral',
                options.comment
            );

            if (success) {
                console.log(chalk.green(`✓ Feedback added for ${id}`));
            } else {
                console.error(chalk.red(`Example not found: ${id}`));
                process.exit(1);
            }
        });

    // Recent command
    finetune
        .command('recent')
        .description('Show recent training examples')
        .option('-n, --limit <count>', 'Number of examples', parseInt, 5)
        .action(async (options) => {
            const cwd = process.cwd();
            const collector = createTrainingDataCollector(cwd);
            const recent = collector.getRecent(options.limit);

            if (recent.length === 0) {
                console.log(chalk.yellow('\nNo training data collected yet.\n'));
                return;
            }

            console.log(chalk.cyan.bold('\n📋 Recent Training Examples\n'));

            for (const example of recent) {
                const rating = example.feedback?.rating;
                const ratingIcon = rating === 'good' ? '👍' : rating === 'bad' ? '👎' : '•';
                const date = new Date(example.meta.timestamp).toLocaleString();

                console.log(`${chalk.bold(example.id)} ${ratingIcon}`);
                console.log(`  Goal: ${chalk.white(example.goal.substring(0, 60))}${example.goal.length > 60 ? '...' : ''}`);
                console.log(`  Files: ${example.selectedFiles.length} | Tokens: ${example.tokenCount}`);
                console.log(`  ${chalk.gray(date)}\n`);
            }
        });
}
