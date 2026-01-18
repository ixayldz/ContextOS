/**
 * ctx explain - RLM-powered code explanation
 * Provides context-aware explanations of code, functions, or modules
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, basename, resolve, normalize } from 'path';
import {
    RLMEngine,
    createGeminiClient,
    mergeFilesToContext,
} from '@contextos/core';

/**
 * Validate path doesn't escape project boundaries (Fix N2: Path Traversal)
 */
function validatePath(userPath: string, projectRoot: string): string {
    const resolved = resolve(projectRoot, userPath);
    const normalized = normalize(resolved);
    const rootNormalized = normalize(projectRoot);

    if (!normalized.startsWith(rootNormalized)) {
        throw new Error(`Path traversal detected: "${userPath}" escapes project boundaries`);
    }
    return normalized;
}

export const explainCommand = new Command('explain')
    .description('Get AI-powered explanation of code')
    .argument('<target>', 'File path, function name, or module to explain')
    .option('-d, --depth <number>', 'Include dependencies up to depth', '1')
    .option('-f, --format <format>', 'Output format: text, markdown, json', 'markdown')
    .option('--no-examples', 'Skip usage examples in explanation')
    .option('--technical', 'Include technical implementation details')
    .action(async (target, options) => {
        console.log(chalk.blue.bold('\n📚 ContextOS Code Explainer\n'));

        const spinner = ora('Analyzing target...').start();

        try {
            let targetContent = '';
            let targetPath = '';
            let contextFiles: Array<{ path: string; content: string }> = [];

            // Validate path before accessing (Fix N2: Path Traversal)
            let safePath: string;
            try {
                safePath = validatePath(target, process.cwd());
            } catch (error) {
                if (error instanceof Error && error.message.includes('Path traversal')) {
                    spinner.fail('Invalid path');
                    console.log(chalk.red('Error:'), error.message);
                    process.exit(1);
                }
                throw error;
            }

            // Determine if target is a file path or symbol name
            const possiblePath = join(process.cwd(), target);

            if (existsSync(possiblePath) && statSync(possiblePath).isFile()) {
                // Target is a file
                targetPath = target;
                targetContent = readFileSync(possiblePath, 'utf-8');
                contextFiles.push({ path: target, content: targetContent });
                spinner.text = `Found file: ${target}`;
            } else if (existsSync(safePath) && statSync(safePath).isFile()) {
                // Absolute path (validated)
                targetPath = target;
                targetContent = readFileSync(safePath, 'utf-8');
                contextFiles.push({ path: basename(target), content: targetContent });
                spinner.text = `Found file: ${target}`;
            } else {
                // Target might be a function/class name - search in current directory
                spinner.text = `Searching for "${target}"...`;

                // Simple search in common source directories
                const searchDirs = ['src', 'lib', 'app', '.'];
                const _found = false;

                for (const dir of searchDirs) {
                    const searchPath = join(process.cwd(), dir);
                    if (!existsSync(searchPath)) continue;

                    // Would need glob here - for now just indicate what to do
                    spinner.fail(`Symbol "${target}" not found as a file.`);
                    console.log(chalk.yellow(`\nTip: Provide a file path instead, e.g.:`));
                    console.log(chalk.gray(`  ctx explain src/auth/service.ts`));
                    console.log(chalk.gray(`  ctx explain ./utils/helpers.js`));
                    process.exit(1);
                }
            }

            spinner.text = 'Initializing RLM engine...';

            // Set up RLM engine
            const engine = new RLMEngine({
                maxDepth: parseInt(options.depth),
                maxTokenBudget: 20000,
                backend: 'gemini',
            });

            const gemini = createGeminiClient();
            if (!gemini) {
                spinner.fail('Gemini API key not configured');
                console.log(chalk.yellow('\nSet GEMINI_API_KEY environment variable.\n'));
                process.exit(1);
            }

            // Create adapter
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

            spinner.text = 'Generating explanation...';

            // Build explanation prompt
            const technicalNote = options.technical
                ? 'Include implementation details, algorithms used, and performance considerations.'
                : '';
            const examplesNote = options.examples
                ? 'Include practical usage examples.'
                : '';

            const explainGoal = `
Explain the following code in a clear, educational manner.

FILE: ${targetPath}

Please provide:
1. **Overview**: What this code does at a high level
2. **Key Components**: Main functions, classes, or exports
3. **How It Works**: Step-by-step explanation of the logic
4. **Dependencies**: What this code imports/relies on
${examplesNote ? '5. **Usage Examples**: How to use this code' : ''}
${technicalNote ? '6. **Technical Details**: Implementation specifics' : ''}

Format the response in ${options.format === 'json' ? 'JSON' : 'Markdown'}.
            `.trim();

            const context = mergeFilesToContext(contextFiles);
            const result = await engine.execute(explainGoal, context);

            spinner.succeed('Explanation generated');

            // Display result
            console.log();
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log(chalk.blue.bold(`📖 Explanation: ${targetPath}`));
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log();

            if (options.format === 'json') {
                try {
                    const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        console.log(JSON.stringify(JSON.parse(jsonMatch[0]), null, 2));
                    } else {
                        console.log(result.answer);
                    }
                } catch {
                    console.log(result.answer);
                }
            } else {
                console.log(result.answer);
            }

            console.log();
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log(chalk.gray(`Tokens used: ${result.totalTokens} | Confidence: ${(result.confidence * 100).toFixed(0)}%`));
            console.log();

        } catch (error) {
            spinner.fail('Explanation failed');
            console.error(chalk.red('Error:'), error);
            process.exit(1);
        }
    });
