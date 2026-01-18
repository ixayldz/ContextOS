/**
 * ctx refactor - RLM-powered safe refactoring with impact analysis
 * Analyzes code changes and their potential impact before applying
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import {
    getContextBuilder,
    RLMEngine,
    createGeminiClient,
    mergeFilesToContext,
} from '@contextos/core';

interface RefactorPlan {
    description: string;
    files: Array<{
        path: string;
        action: 'modify' | 'create' | 'delete';
        changes: string;
        impact: 'low' | 'medium' | 'high';
    }>;
    risks: string[];
    testSuggestions: string[];
}

export const refactorCommand = new Command('refactor')
    .description('RLM-powered safe refactoring with impact analysis')
    .argument('<description>', 'Refactoring description (e.g., "Rename User to Account")')
    .option('-f, --file <path>', 'Target file to refactor')
    .option('-d, --depth <number>', 'Maximum analysis depth', '2')
    .option('--dry-run', 'Preview changes without applying')
    .option('--no-backup', 'Skip creating backup files')
    .option('--force', 'Apply changes without confirmation')
    .action(async (description, options) => {
        console.log(chalk.blue.bold('\n🔧 RLM Refactoring Engine\n'));
        console.log(chalk.gray('Description: ') + chalk.white(description));
        if (options.file) {
            console.log(chalk.gray('Target file: ') + chalk.white(options.file));
        }
        console.log();

        const spinner = ora('Analyzing codebase...').start();

        try {
            // Initialize context builder
            const builder = await getContextBuilder();

            // Build context for analysis
            spinner.text = 'Building context...';
            const buildResult = await builder.build({
                maxTokens: 50000,
                targetFile: options.file,
            });

            // Create context from files
            const files = buildResult.files.map(f => ({
                path: f.path,
                content: f.content || '',
            }));
            const context = mergeFilesToContext(files);

            // Set up RLM engine
            spinner.text = 'Initializing RLM engine...';
            const engine = new RLMEngine({
                maxDepth: parseInt(options.depth),
                maxTokenBudget: 30000,
                backend: 'gemini',
            });

            const gemini = createGeminiClient();
            if (!gemini) {
                spinner.fail('Gemini API key not configured');
                console.log(chalk.yellow('\nSet GEMINI_API_KEY environment variable.\n'));
                process.exit(1);
            }

            // Adapter wrapper
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

            // Analyze refactoring impact
            spinner.text = 'Analyzing refactoring impact...';
            const analysisGoal = `
Analyze the following refactoring request and provide a detailed impact analysis:

REFACTORING REQUEST: ${description}
${options.file ? `TARGET FILE: ${options.file}` : ''}

Please analyze:
1. Which files need to be modified
2. What specific changes are needed in each file
3. What are the potential risks
4. What tests should be run after the refactoring

Respond in JSON format:
{
    "description": "Summary of the refactoring",
    "files": [
        {
            "path": "path/to/file.ts",
            "action": "modify|create|delete",
            "changes": "Description of changes",
            "impact": "low|medium|high"
        }
    ],
    "risks": ["Risk 1", "Risk 2"],
    "testSuggestions": ["Test 1", "Test 2"]
}
            `.trim();

            const result = await engine.execute(analysisGoal, context);

            spinner.succeed('Impact analysis complete');

            // Parse the plan
            let plan: RefactorPlan;
            try {
                const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    // Fix N8: JSON.parse without try-catch
                    try {
                        plan = JSON.parse(jsonMatch[0]);
                    } catch (parseError) {
                        spinner.warn('Failed to parse refactoring plan JSON');
                        console.log();
                        console.log(chalk.blue.bold('Analysis Result:'));
                        console.log(result.answer);
                        console.log();
                        process.exit(0);
                    }
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch {
                // If parsing fails, show raw response
                console.log();
                console.log(chalk.blue.bold('Analysis Result:'));
                console.log(result.answer);
                console.log();
                process.exit(0);
            }

            // Display the plan
            console.log();
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log(chalk.blue.bold('📋 Refactoring Plan'));
            console.log(chalk.blue.bold('─'.repeat(60)));
            console.log();
            console.log(chalk.white(plan.description));
            console.log();

            // Files to be modified
            console.log(chalk.blue.bold('Files to modify:'));
            for (const file of plan.files) {
                const impactColor = file.impact === 'high' ? chalk.red : file.impact === 'medium' ? chalk.yellow : chalk.green;
                const actionIcon = file.action === 'create' ? '➕' : file.action === 'delete' ? '🗑️' : '📝';
                console.log(`  ${actionIcon} ${chalk.white(file.path)} ${impactColor(`[${file.impact}]`)}`);
                console.log(chalk.gray(`     ${file.changes}`));
            }
            console.log();

            // Risks
            if (plan.risks.length > 0) {
                console.log(chalk.yellow.bold('⚠️  Potential Risks:'));
                for (const risk of plan.risks) {
                    console.log(chalk.yellow(`  • ${risk}`));
                }
                console.log();
            }

            // Test suggestions
            if (plan.testSuggestions.length > 0) {
                console.log(chalk.cyan.bold('🧪 Recommended Tests:'));
                for (const test of plan.testSuggestions) {
                    console.log(chalk.cyan(`  • ${test}`));
                }
                console.log();
            }

            // Dry run mode
            if (options.dryRun) {
                console.log(chalk.gray('─'.repeat(60)));
                console.log(chalk.yellow('\n📋 Dry run mode - no changes applied.\n'));
                console.log(chalk.gray('Remove --dry-run flag to apply changes.\n'));
                process.exit(0);
            }

            // Confirmation
            if (!options.force) {
                console.log(chalk.gray('─'.repeat(60)));
                console.log(chalk.yellow('\n⚠️  This is a preview. Use --force to apply changes.'));
                console.log(chalk.gray('Or use --dry-run for analysis-only mode.\n'));
                process.exit(0);
            }

            // Apply changes (future implementation)
            console.log(chalk.green('\n✅ Refactoring plan generated successfully.\n'));
            console.log(chalk.gray('Note: Automatic code modification coming in a future release.'));
            console.log(chalk.gray('For now, use this analysis to manually apply the changes.\n'));

        } catch (error) {
            spinner.fail('Refactoring analysis failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
