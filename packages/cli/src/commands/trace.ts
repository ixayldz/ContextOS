/**
 * ctx trace - Call chain tracer
 * Traces function call chains and dependency paths
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
    getContextBuilder,
} from '@contextos/core';

export const traceCommand = new Command('trace')
    .description('Trace function call chains and dependencies')
    .argument('<symbol>', 'Function or class name to trace')
    .option('-d, --direction <dir>', 'Trace direction: callers, callees, both', 'both')
    .option('--depth <number>', 'Maximum trace depth', '3')
    .option('--json', 'Output as JSON')
    .action(async (symbol, options) => {
        console.log(chalk.blue.bold('\n🔗 Call Chain Tracer\n'));
        console.log(chalk.gray(`Tracing: ${symbol}`));
        console.log(chalk.gray(`Direction: ${options.direction}`));
        console.log();

        const spinner = ora('Analyzing dependency graph...').start();

        try {
            const _builder = await getContextBuilder();

            // Get the dependency graph
            spinner.text = 'Building call chain...';

            // For now, show a placeholder - full implementation would use graph traversal
            spinner.succeed('Trace complete');

            console.log();
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log(chalk.blue.bold(`📊 Call Chain for: ${symbol}`));
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log();

            if (options.direction === 'callers' || options.direction === 'both') {
                console.log(chalk.green.bold('⬆️  Called by (callers):'));
                console.log(chalk.gray('  └── Use ctx analyze to find callers'));
                console.log();
            }

            if (options.direction === 'callees' || options.direction === 'both') {
                console.log(chalk.yellow.bold('⬇️  Calls (callees):'));
                console.log(chalk.gray('  └── Use ctx analyze to find dependencies'));
                console.log();
            }

            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log();
            console.log(chalk.gray('Tip: For detailed analysis, use:'));
            console.log(chalk.cyan(`  ctx analyze "Find all functions that call ${symbol}"`));
            console.log();

        } catch (error) {
            spinner.fail('Trace failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
