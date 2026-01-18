/**
 * Dataset Formatter
 * Formats training data for various fine-tuning providers
 */

import { createReadStream, createWriteStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import type {
    TrainingExample,
    DatasetConfig,
    ExportFormat,
    ValidationResult,
} from './types.js';

/**
 * Dataset formatter for fine-tuning export
 */
export class DatasetFormatter {
    /**
     * Export examples to file
     */
    async export(
        examples: TrainingExample[],
        outputPath: string,
        format: ExportFormat,
        config: DatasetConfig = {}
    ): Promise<{ exported: number; path: string }> {
        // Filter examples based on config
        let filtered = this.filterExamples(examples, config);

        // Shuffle if requested
        if (config.shuffle) {
            filtered = this.shuffle(filtered);
        }

        // Limit if specified
        if (config.maxExamples && filtered.length > config.maxExamples) {
            filtered = filtered.slice(0, config.maxExamples);
        }

        // Format and write
        const stream = createWriteStream(outputPath);

        for (const example of filtered) {
            const formatted = this.formatExample(example, format);
            stream.write(formatted + '\n');
        }

        stream.end();

        return { exported: filtered.length, path: outputPath };
    }

    /**
     * Export with train/validation split
     */
    async exportWithSplit(
        examples: TrainingExample[],
        outputDir: string,
        format: ExportFormat,
        config: DatasetConfig = {}
    ): Promise<{ train: number; validation: number }> {
        const split = config.validationSplit || 0.1;
        let filtered = this.filterExamples(examples, config);

        if (config.shuffle) {
            filtered = this.shuffle(filtered);
        }

        const splitIndex = Math.floor(filtered.length * (1 - split));
        const trainExamples = filtered.slice(0, splitIndex);
        const validationExamples = filtered.slice(splitIndex);

        await this.export(trainExamples, `${outputDir}/train.jsonl`, format, {});
        await this.export(validationExamples, `${outputDir}/validation.jsonl`, format, {});

        return {
            train: trainExamples.length,
            validation: validationExamples.length
        };
    }

    /**
     * Validate a dataset file
     */
    async validate(filePath: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            stats: {
                totalExamples: 0,
                ratingDistribution: { good: 0, neutral: 0, bad: 0, unrated: 0 },
                languageDistribution: {},
                avgTokenCount: 0,
                avgFilesPerExample: 0,
                dateRange: { earliest: new Date(), latest: new Date(0) },
            },
        };

        if (!existsSync(filePath)) {
            result.valid = false;
            result.errors.push({
                line: 0,
                field: 'file',
                message: `File not found: ${filePath}`,
            });
            return result;
        }

        const fileStream = createReadStream(filePath);
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let lineNumber = 0;
        let totalTokens = 0;
        let totalFiles = 0;

        for await (const line of rl) {
            lineNumber++;

            if (!line.trim()) continue;

            try {
                const example = JSON.parse(line) as TrainingExample;

                // Validate required fields
                if (!example.goal) {
                    result.errors.push({
                        line: lineNumber,
                        field: 'goal',
                        message: 'Missing required field: goal',
                    });
                    result.valid = false;
                }

                if (!example.context) {
                    result.errors.push({
                        line: lineNumber,
                        field: 'context',
                        message: 'Missing required field: context',
                    });
                    result.valid = false;
                }

                // Update stats
                result.stats.totalExamples++;
                totalTokens += example.tokenCount || 0;
                totalFiles += example.selectedFiles?.length || 0;

                if (example.feedback) {
                    result.stats.ratingDistribution[example.feedback.rating]++;
                } else {
                    result.stats.ratingDistribution.unrated++;
                }

                if (example.meta?.language) {
                    const lang = example.meta.language;
                    result.stats.languageDistribution[lang] =
                        (result.stats.languageDistribution[lang] || 0) + 1;
                }

                if (example.meta?.timestamp) {
                    const date = new Date(example.meta.timestamp);
                    if (date < result.stats.dateRange.earliest) {
                        result.stats.dateRange.earliest = date;
                    }
                    if (date > result.stats.dateRange.latest) {
                        result.stats.dateRange.latest = date;
                    }
                }

            } catch (error) {
                result.errors.push({
                    line: lineNumber,
                    field: 'json',
                    message: `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
                });
                result.valid = false;
            }
        }

        if (result.stats.totalExamples > 0) {
            result.stats.avgTokenCount = Math.round(totalTokens / result.stats.totalExamples);
            result.stats.avgFilesPerExample =
                Math.round((totalFiles / result.stats.totalExamples) * 10) / 10;
        }

        // Warnings
        if (result.stats.totalExamples < 100) {
            result.warnings.push('Dataset has fewer than 100 examples. Consider collecting more data.');
        }

        if (result.stats.ratingDistribution.bad > result.stats.totalExamples * 0.2) {
            result.warnings.push('More than 20% of examples have negative ratings.');
        }

        return result;
    }

    /**
     * Filter examples based on config
     */
    private filterExamples(
        examples: TrainingExample[],
        config: DatasetConfig
    ): TrainingExample[] {
        return examples.filter(example => {
            // Rating filter
            if (config.minRating) {
                if (!example.feedback && !config.includeUnrated) {
                    return false;
                }
                if (example.feedback) {
                    const ratingOrder = { bad: 0, neutral: 1, good: 2 };
                    if (ratingOrder[example.feedback.rating] < ratingOrder[config.minRating]) {
                        return false;
                    }
                }
            }

            // Project filter
            if (config.projectFilter && example.meta.projectName !== config.projectFilter) {
                return false;
            }

            // Language filter
            if (config.languageFilter && example.meta.language !== config.languageFilter) {
                return false;
            }

            return true;
        });
    }

    /**
     * Format a single example
     */
    private formatExample(example: TrainingExample, format: ExportFormat): string {
        switch (format.format) {
            case 'openai':
                return JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a code context selection assistant. Given a goal, select the most relevant files from a codebase.',
                        },
                        {
                            role: 'user',
                            content: `Goal: ${example.goal}\n\nProject: ${example.meta.projectName} (${example.meta.language})`,
                        },
                        {
                            role: 'assistant',
                            content: `Selected files:\n${example.selectedFiles.map(f => `- ${f}`).join('\n')}\n\n${example.context}`,
                        },
                    ],
                });

            case 'anthropic':
                return JSON.stringify({
                    prompt: `\n\nHuman: Goal: ${example.goal}\n\nProject: ${example.meta.projectName} (${example.meta.language})\n\nAssistant:`,
                    completion: ` Selected files:\n${example.selectedFiles.map(f => `- ${f}`).join('\n')}\n\n${example.context}`,
                });

            case 'csv':
                const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
                return [
                    escapeCsv(example.id),
                    escapeCsv(example.goal),
                    escapeCsv(example.selectedFiles.join(';')),
                    example.tokenCount,
                    example.feedback?.rating || '',
                    escapeCsv(example.meta.language),
                ].join(',');

            case 'jsonl':
            default:
                return JSON.stringify(example);
        }
    }

    /**
     * Shuffle array
     */
    private shuffle<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

/**
 * Factory function
 */
export function createDatasetFormatter(): DatasetFormatter {
    return new DatasetFormatter();
}
