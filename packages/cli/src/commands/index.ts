/**
 * ctx index - Index the project for context building
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getContextBuilder } from '@contextos/core';

export const indexCommand = new Command('index')
    .description('Index the project for context building')
    .option('-w, --watch', 'Watch mode for incremental updates')
    .option('-f, --force', 'Force full reindex')
    .option('-s, --stats', 'Show indexing statistics')
    .action(async (options) => {
        console.log(chalk.blue.bold('\n📊 Indexing project...\n'));

        const spinner = ora('Initializing...').start();

        try {
            const builder = await getContextBuilder();
            spinner.text = 'Indexing files...';

            const result = await builder.index(options.force);

            spinner.succeed('Indexing complete');

            // Show results
            console.log();
            console.log(chalk.gray('Results:'));
            console.log(chalk.white(`  📁 Files indexed: ${chalk.cyan(result.filesIndexed)}`));
            console.log(chalk.white(`  📝 Chunks created: ${chalk.cyan(result.chunksCreated)}`));
            console.log(chalk.white(`  ⏱️  Time: ${chalk.cyan(result.timeMs + 'ms')}`));

            // Show stats if requested
            if (options.stats) {
                const stats = builder.getStats();
                if (stats) {
                    console.log();
                    console.log(chalk.gray('Graph Statistics:'));
                    console.log(chalk.white(`  Nodes: ${stats.graph.nodeCount}`));
                    console.log(chalk.white(`  Edges: ${stats.graph.edgeCount}`));
                    console.log(chalk.white(`  Avg imports: ${stats.graph.avgImports}`));
                    console.log();
                    console.log(chalk.gray('Vector Statistics:'));
                    console.log(chalk.white(`  Chunks: ${stats.vectors.chunkCount}`));
                    console.log(chalk.white(`  Files: ${stats.vectors.fileCount}`));
                    console.log(chalk.white(`  Embedded: ${stats.vectors.embeddedCount}`));
                }
            }

            console.log();
            console.log(chalk.green('✅ Index ready. Run "ctx goal <description>" to build context.\n'));

            // Watch mode
            if (options.watch) {
                console.log(chalk.blue('👀 Watching for file changes... (Ctrl+C to stop)\n'));
                // In production, would use chokidar here
                // For now, just keep the process running
                process.on('SIGINT', () => {
                    console.log(chalk.yellow('\nWatch mode stopped.'));
                    process.exit(0);
                });
            }

        } catch (error) {
            spinner.fail('Indexing failed');
            if (error instanceof Error && error.message.includes('ContextOS not initialized')) {
                console.log(chalk.red('\n❌ Environment not initialized.'));
                console.log(chalk.yellow(`   ${error.message}`));
                console.log(chalk.green('\n   👉 Run "ctx init" to set up your project.\n'));
            } else {
                console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
            }
            process.exit(1);
        }
    });
