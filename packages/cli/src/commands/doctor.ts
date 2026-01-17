/**
 * ctx doctor - Check for drift between context.yaml and code reality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { detectDrift, isGeminiAvailable, createGeminiClient } from '@contextos/core';

export const doctorCommand = new Command('doctor')
    .description('Check for drift between context.yaml and code reality')
    .option('--fix', 'Attempt to auto-fix issues')
    .option('--json', 'Output as JSON for CI/CD')
    .option('--ci', 'Exit with code 1 if errors found')
    .option('--explain', 'Use Gemini to explain issues in detail')
    .action(async (options) => {
        if (!options.json) {
            console.log(chalk.blue.bold('\n🩺 ContextOS Health Check\n'));
        }

        const spinner = options.json ? null : ora('Analyzing project...').start();
        const gemini = options.explain && isGeminiAvailable() ? createGeminiClient() : null;

        try {
            const report = await detectDrift();

            if (spinner) spinner.stop();

            // JSON output for CI/CD
            if (options.json) {
                console.log(JSON.stringify(report, null, 2));
                if (options.ci && report.errors.length > 0) {
                    process.exit(1);
                }
                return;
            }

            // Visual output
            console.log(chalk.gray('╔' + '═'.repeat(68) + '╗'));
            console.log(chalk.gray('║') + chalk.white.bold(' 🩺 ContextOS Health Check').padEnd(77) + chalk.gray('║'));
            console.log(chalk.gray('╠' + '═'.repeat(68) + '╣'));

            // Errors
            if (report.errors.length > 0) {
                console.log(chalk.gray('║') + ' '.repeat(68) + chalk.gray('║'));
                console.log(chalk.gray('║') + chalk.red.bold(` ❌ ERRORS (${report.errors.length})`).padEnd(77) + chalk.gray('║'));
                console.log(chalk.gray('║') + ' '.repeat(68) + chalk.gray('║'));

                for (const error of report.errors) {
                    console.log(chalk.gray('║') + chalk.red(` [ERROR] ${error.message}`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                    console.log(chalk.gray('║') + chalk.gray(`    Expected: "${error.expected}"`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                    console.log(chalk.gray('║') + chalk.gray(`    Actual: "${error.actual}"`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                    if (error.location) {
                        console.log(chalk.gray('║') + chalk.gray(`    Location: ${error.location.file}${error.location.line ? ':' + error.location.line : ''}`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                    }
                    console.log(chalk.gray('║') + chalk.yellow(`    💡 Fix: ${error.suggestion}`).substring(0, 68).padEnd(68) + chalk.gray('║'));

                    // Gemini explanation
                    if (gemini) {
                        try {
                            const explanation = await gemini.explainDrift({
                                type: error.type,
                                expected: error.expected,
                                actual: error.actual,
                                location: error.location?.file,
                            });
                            console.log(chalk.gray('║') + ' '.repeat(68) + chalk.gray('║'));
                            console.log(chalk.gray('║') + chalk.cyan('    🤖 AI Explanation:').padEnd(68) + chalk.gray('║'));
                            const lines = explanation.split('\n').slice(0, 3);
                            for (const line of lines) {
                                console.log(chalk.gray('║') + chalk.white(`    ${line}`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                            }
                        } catch {
                            // Silently skip if Gemini fails
                        }
                    }
                    console.log(chalk.gray('║') + ' '.repeat(68) + chalk.gray('║'));
                }
            }

            // Warnings
            if (report.warnings.length > 0) {
                console.log(chalk.gray('║') + chalk.yellow.bold(` ⚠️  WARNINGS (${report.warnings.length})`).padEnd(77) + chalk.gray('║'));
                console.log(chalk.gray('║') + ' '.repeat(68) + chalk.gray('║'));

                for (const warning of report.warnings) {
                    console.log(chalk.gray('║') + chalk.yellow(` [WARNING] ${warning.message}`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                    console.log(chalk.gray('║') + chalk.yellow(`    💡 ${warning.suggestion}`).substring(0, 68).padEnd(68) + chalk.gray('║'));
                    console.log(chalk.gray('║') + ' '.repeat(68) + chalk.gray('║'));
                }
            }

            // Summary
            console.log(chalk.gray('╠' + '═'.repeat(68) + '╣'));

            const statusIcon = report.errors.length > 0 ? '❌' : report.warnings.length > 0 ? '⚠️' : '✅';
            const statusText = report.errors.length > 0
                ? 'Issues found - action required'
                : report.warnings.length > 0
                    ? 'Warnings detected'
                    : 'All checks passed';

            console.log(chalk.gray('║') + ` ${statusIcon} ${statusText}`.padEnd(68) + chalk.gray('║'));
            console.log(chalk.gray('║') + chalk.green(` ✅ ${report.passed} checks passed`).padEnd(77) + chalk.gray('║'));
            if (report.errors.length > 0) {
                console.log(chalk.gray('║') + chalk.red(` ❌ ${report.errors.length} errors`).padEnd(77) + chalk.gray('║'));
            }
            if (report.warnings.length > 0) {
                console.log(chalk.gray('║') + chalk.yellow(` ⚠️  ${report.warnings.length} warnings`).padEnd(77) + chalk.gray('║'));
            }

            console.log(chalk.gray('╚' + '═'.repeat(68) + '╝'));
            console.log();

            // Exit code for CI
            if (options.ci && report.errors.length > 0) {
                process.exit(1);
            }

        } catch (error) {
            if (spinner) spinner.fail('Health check failed');
            if (error instanceof Error && error.message.includes('not initialized')) {
                console.log(chalk.yellow('\nRun "ctx init" first to initialize ContextOS.\n'));
            } else {
                console.error(chalk.red('Error:'), error);
            }
            process.exit(1);
        }
    });
