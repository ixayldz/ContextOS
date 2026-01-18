/**
 * ctx generate - Generate code using AI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createAIGenerator, isInitialized } from '@contextos/core';

export const generateCommand = new Command('generate')
    .description('Generate code using AI')
    .argument('<prompt>', 'What to generate')
    .option('--dry-run', 'Preview what would be generated without writing files')
    .option('--model <model>', 'AI model to use (gemini, openai)', 'auto')
    .option('--no-backup', 'Skip backup before overwriting files')
    .option('--max-files <n>', 'Maximum number of files to generate', '20')
    .action(async (prompt, options) => {
        console.log(chalk.cyan.bold('\n🤖 AI Code Generator\n'));

        // Check if initialized
        if (!isInitialized()) {
            console.log(chalk.yellow('⚠️  ContextOS not initialized. Run "ctx init" first.\n'));
            process.exit(1);
        }

        const spinner = ora('Initializing AI...').start();

        try {
            const generator = createAIGenerator();
            await generator.initialize();

            spinner.text = 'Generating code...';

            const result = await generator.generate(prompt, {
                dryRun: options.dryRun,
                model: options.model,
                backupBeforeOverwrite: options.backup !== false,
                maxFiles: parseInt(options.maxFiles),
            });

            if (!result.success) {
                spinner.fail('Generation failed');
                console.error(chalk.red('\nError:'), result.error);
                process.exit(1);
            }

            spinner.succeed('Generation complete');

            // Show results
            console.log();
            console.log(chalk.gray('Generated Files:'));

            if (result.files.length === 0) {
                console.log(chalk.yellow('  No files generated. AI may not have understood the request.'));
            } else {
                for (const file of result.files) {
                    const icon = file.isNew ? chalk.green('+ NEW') : chalk.yellow('~ MOD');
                    console.log(`  ${icon} ${chalk.white(file.path)}`);
                }
            }

            console.log();
            console.log(chalk.gray(`Tokens used: ${result.tokensUsed}`));

            if (options.dryRun) {
                console.log(chalk.yellow('\n⚠️  Dry run mode - no files were written.'));
                console.log(chalk.gray('Run without --dry-run to write files.\n'));
            } else {
                console.log(chalk.green(`\n✅ ${result.files.length} file(s) generated successfully!\n`));
            }

        } catch (error) {
            spinner.fail('Generation failed');
            console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

/**
 * ctx fix - Fix code issues using AI
 */
export const fixCommand = new Command('fix')
    .description('Fix code issues using AI')
    .argument('<prompt>', 'What to fix')
    .option('--file <path>', 'Specific file to fix')
    .option('--dry-run', 'Preview without applying changes')
    .action(async (prompt, options) => {
        console.log(chalk.cyan.bold('\n🔧 AI Code Fixer\n'));

        if (!isInitialized()) {
            console.log(chalk.yellow('⚠️  ContextOS not initialized. Run "ctx init" first.\n'));
            process.exit(1);
        }

        const spinner = ora('Analyzing and fixing...').start();

        try {
            const generator = createAIGenerator();
            await generator.initialize();

            // Enhanced prompt for fixing
            const fixPrompt = options.file
                ? `Fix this issue in ${options.file}: ${prompt}`
                : `Fix this issue in the codebase: ${prompt}`;

            const result = await generator.generate(fixPrompt, {
                dryRun: options.dryRun,
                backupBeforeOverwrite: true,
            });

            if (!result.success) {
                spinner.fail('Fix failed');
                console.error(chalk.red('\nError:'), result.error);
                process.exit(1);
            }

            spinner.succeed('Fix complete');

            console.log();
            for (const file of result.files) {
                console.log(`  ${chalk.green('✓')} ${file.path}`);
            }

            if (options.dryRun) {
                console.log(chalk.yellow('\n⚠️  Dry run - no changes applied.\n'));
            } else {
                console.log(chalk.green(`\n✅ Fixed ${result.files.length} file(s)!\n`));
            }

        } catch (error) {
            spinner.fail('Fix failed');
            console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    });

/**
 * Register generate commands
 */
export function registerGenerateCommands(program: Command): void {
    program.addCommand(generateCommand);
    program.addCommand(fixCommand);
}
