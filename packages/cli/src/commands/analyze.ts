/**
 * ctx analyze - RLM-powered deep analysis command
 * Uses Recursive Language Model engine for codebase analysis
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readdirSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, relative, resolve, normalize } from 'path';
import {
    getContextBuilder,
    RLMEngine,
    createGeminiClient,
    mergeFilesToContext,
} from '@contextos/core';

/**
 * Validate that a path doesn't escape project boundaries (prevents path traversal)
 */
function validatePath(userPath: string, projectRoot: string): string {
    const resolved = resolve(projectRoot, userPath);
    const normalized = normalize(resolved);
    const rootNormalized = normalize(projectRoot);

    if (!normalized.startsWith(rootNormalized)) {
        throw new Error(
            `Invalid path: "${userPath}" escapes project boundaries.\n` +
            `Path must be within: ${rootNormalized}`
        );
    }
    return normalized;
}

/**
 * Recursively collect all code files from a directory
 * Fixed: Added depth tracking to prevent stack overflow, async file I/O for non-blocking
 */
async function collectFiles(
    dir: string,
    extensions: string[] = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java'],
    maxFiles: number = 100,
    maxDepth: number = 20
): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    async function walk(currentDir: string, depth: number): Promise<void> {
        // Depth limit check to prevent stack overflow
        if (depth > maxDepth) {
            console.warn(`Maximum depth (${maxDepth}) reached at ${currentDir}. Skipping deeper directories.`);
            return;
        }

        if (files.length >= maxFiles) return;

        const entries = readdirSync(currentDir, { withFileTypes: true });

        // Process files concurrently (up to 10 at a time)
        const filePromises: Promise<void>[] = [];

        for (const entry of entries) {
            if (files.length >= maxFiles) break;

            const fullPath = join(currentDir, entry.name);

            // Skip common non-source directories
            if (entry.isDirectory()) {
                if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv'].includes(entry.name)) {
                    continue;
                }
                // Walk subdirectory sequentially to avoid too much concurrency
                await walk(fullPath, depth + 1);
            } else if (entry.isFile()) {
                const ext = entry.name.substring(entry.name.lastIndexOf('.'));
                if (extensions.includes(ext)) {
                    // Async file read (non-blocking)
                    const promise = (async () => {
                        try {
                            const content = await readFile(fullPath, 'utf-8');
                            files.push({
                                path: relative(dir, fullPath),
                                content,
                            });
                        } catch {
                            // Skip unreadable files
                        }
                    })();
                    filePromises.push(promise);

                    // Batch concurrent reads to avoid overwhelming the file system
                    if (filePromises.length >= 10) {
                        await Promise.all(filePromises);
                        filePromises.length = 0;
                    }
                }
            }
        }

        // Wait for remaining file reads
        if (filePromises.length > 0) {
            await Promise.all(filePromises);
        }
    }

    await walk(dir, 0);
    return files;
}

export const analyzeCommand = new Command('analyze')
    .description('RLM-powered deep analysis of your codebase')
    .argument('<goal>', 'Analysis goal or question (e.g., "Find all API endpoints")')
    .option('-d, --depth <number>', 'Maximum recursion depth for RLM', '3')
    .option('-b, --budget <tokens>', 'Token budget for analysis', '50000')
    .option('-p, --path <path>', 'Path to analyze (default: current directory)', '.')
    .option('--max-files <number>', 'Maximum files to include', '100')
    .option('--max-depth <number>', 'Maximum directory depth to traverse', '20')
    .option('--verbose', 'Show detailed execution trace')
    .action(async (goal, options) => {
        console.log(chalk.blue.bold('\n🔍 RLM Analysis Engine\n'));
        console.log(chalk.gray('Goal: ') + chalk.white(goal));
        console.log();

        const spinner = ora('Collecting codebase files...').start();

        try {
            // Validate path to prevent traversal attacks
            const safePath = validatePath(options.path, process.cwd());

            // Collect files (async, non-blocking)
            const files = await collectFiles(safePath, undefined, parseInt(options.maxFiles), parseInt(options.maxDepth));
            spinner.text = `Found ${files.length} files. Building context...`;

            if (files.length === 0) {
                spinner.fail('No source files found');
                console.log(chalk.yellow('\nMake sure you are in a project directory with source code.\n'));
                process.exit(1);
            }

            // Merge files into single context
            const context = mergeFilesToContext(files);
            const contextSizeKB = (context.length / 1024).toFixed(1);

            spinner.text = `Context: ${contextSizeKB}KB. Initializing RLM engine...`;

            // Create RLM engine
            const engine = new RLMEngine({
                maxDepth: parseInt(options.depth),
                maxTokenBudget: parseInt(options.budget),
                backend: 'gemini',
                verbose: options.verbose,
            });

            // Set up model adapter
            const gemini = createGeminiClient();
            if (!gemini) {
                spinner.fail('Gemini API key not configured');
                console.log(chalk.yellow('\nSet GEMINI_API_KEY environment variable to use RLM analysis.\n'));
                process.exit(1);
            }

            // Create a simple adapter wrapper
            engine.setModelAdapter({
                name: 'gemini',
                maxContextTokens: 2000000,
                async complete(request) {
                    try {
                        const response = await (gemini as any).request(
                            request.userMessage,
                            request.systemPrompt
                        );
                        return {
                            content: response,
                            tokensUsed: {
                                prompt: Math.ceil(request.userMessage.length / 4),
                                completion: Math.ceil(response.length / 4),
                                total: Math.ceil((request.userMessage.length + response.length) / 4),
                            },
                            finishReason: 'stop' as const,
                        };
                    } catch (error) {
                        return {
                            content: '',
                            tokensUsed: { prompt: 0, completion: 0, total: 0 },
                            finishReason: 'error' as const,
                            error: error instanceof Error ? error.message : String(error),
                        };
                    }
                },
                async countTokens(text) {
                    return Math.ceil(text.length / 4);
                },
            });

            spinner.text = 'Executing RLM analysis...';
            const startTime = Date.now();

            // Execute analysis
            const result = await engine.execute(goal, context);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            spinner.succeed(`Analysis complete (${duration}s)`);

            // Display results
            console.log();
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log(chalk.blue.bold('📊 Analysis Result'));
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log();
            console.log(result.answer);
            console.log();
            console.log(chalk.blue.bold('─'.repeat(60)));

            // Display stats
            console.log();
            console.log(chalk.gray('Statistics:'));
            console.log(chalk.white(`  🔢 Tokens used: ${chalk.cyan(result.totalTokens.toLocaleString())}`));
            console.log(chalk.white(`  🎯 Confidence: ${chalk.cyan((result.confidence * 100).toFixed(0) + '%')}`));
            console.log(chalk.white(`  📝 Execution steps: ${chalk.cyan(result.executionPath.length)}`));

            if (result.truncated) {
                console.log(chalk.yellow(`  ⚠️  Truncated: ${result.truncationReason}`));
            }

            // Show execution trace if verbose
            if (options.verbose && result.executionPath.length > 0) {
                console.log();
                console.log(chalk.gray('Execution Trace:'));
                for (const step of result.executionPath.slice(0, 10)) {
                    const icon = step.action === 'code' ? '💻' : step.action === 'recurse' ? '🔄' : '✅';
                    console.log(chalk.gray(`  ${icon} ${step.action}: ${step.input.slice(0, 60)}...`));
                }
                if (result.executionPath.length > 10) {
                    console.log(chalk.gray(`  ... and ${result.executionPath.length - 10} more steps`));
                }
            }

            console.log();

        } catch (error) {
            spinner.fail('Analysis failed');
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
