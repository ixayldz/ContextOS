/**
 * Training Data Collector
 * Collects successful context builds for fine-tuning
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { TrainingExample, DatasetStats } from './types.js';

/**
 * Training data collector
 */
export class TrainingDataCollector {
    private dataDir: string;
    private examples: TrainingExample[] = [];
    private loaded: boolean = false;

    constructor(projectRoot: string) {
        this.dataDir = join(projectRoot, '.contextos', 'training');

        // Ensure directory exists
        if (!existsSync(this.dataDir)) {
            mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Load existing training data
     */
    private load(): void {
        if (this.loaded) return;

        const dataFile = join(this.dataDir, 'examples.json');
        if (existsSync(dataFile)) {
            try {
                const data = JSON.parse(readFileSync(dataFile, 'utf-8'));
                this.examples = data.examples || [];
            } catch {
                this.examples = [];
            }
        }
        this.loaded = true;
    }

    /**
     * Save training data
     */
    private save(): void {
        const dataFile = join(this.dataDir, 'examples.json');
        writeFileSync(dataFile, JSON.stringify({
            version: '1.0',
            updatedAt: new Date().toISOString(),
            examples: this.examples,
        }, null, 2));
    }

    /**
     * Record a context build for training
     */
    record(
        goal: string,
        selectedFiles: string[],
        context: string,
        tokenCount: number,
        meta: TrainingExample['meta']
    ): TrainingExample {
        this.load();

        const example: TrainingExample = {
            id: this.generateId(goal, meta.timestamp),
            goal,
            selectedFiles,
            context,
            tokenCount,
            meta,
        };

        this.examples.push(example);
        this.save();

        return example;
    }

    /**
     * Add feedback to an existing example
     */
    addFeedback(
        exampleId: string,
        rating: 'good' | 'bad' | 'neutral',
        comment?: string
    ): boolean {
        this.load();

        const example = this.examples.find(e => e.id === exampleId);
        if (!example) return false;

        example.feedback = { rating, comment };
        this.save();

        return true;
    }

    /**
     * Get all examples
     */
    getAll(): TrainingExample[] {
        this.load();
        return [...this.examples];
    }

    /**
     * Get example by ID
     */
    get(id: string): TrainingExample | undefined {
        this.load();
        return this.examples.find(e => e.id === id);
    }

    /**
     * Get recent examples
     */
    getRecent(limit: number = 10): TrainingExample[] {
        this.load();
        return this.examples
            .sort((a, b) =>
                new Date(b.meta.timestamp).getTime() - new Date(a.meta.timestamp).getTime()
            )
            .slice(0, limit);
    }

    /**
     * Filter examples
     */
    filter(predicate: (example: TrainingExample) => boolean): TrainingExample[] {
        this.load();
        return this.examples.filter(predicate);
    }

    /**
     * Get dataset statistics
     */
    getStats(): DatasetStats {
        this.load();

        const stats: DatasetStats = {
            totalExamples: this.examples.length,
            ratingDistribution: {
                good: 0,
                neutral: 0,
                bad: 0,
                unrated: 0,
            },
            languageDistribution: {},
            avgTokenCount: 0,
            avgFilesPerExample: 0,
            dateRange: {
                earliest: new Date(),
                latest: new Date(0),
            },
        };

        if (this.examples.length === 0) {
            return stats;
        }

        let totalTokens = 0;
        let totalFiles = 0;

        for (const example of this.examples) {
            // Rating distribution
            if (example.feedback) {
                stats.ratingDistribution[example.feedback.rating]++;
            } else {
                stats.ratingDistribution.unrated++;
            }

            // Language distribution
            const lang = example.meta.language;
            stats.languageDistribution[lang] = (stats.languageDistribution[lang] || 0) + 1;

            // Totals for averages
            totalTokens += example.tokenCount;
            totalFiles += example.selectedFiles.length;

            // Date range
            const date = new Date(example.meta.timestamp);
            if (date < stats.dateRange.earliest) {
                stats.dateRange.earliest = date;
            }
            if (date > stats.dateRange.latest) {
                stats.dateRange.latest = date;
            }
        }

        stats.avgTokenCount = Math.round(totalTokens / this.examples.length);
        stats.avgFilesPerExample = Math.round((totalFiles / this.examples.length) * 10) / 10;

        return stats;
    }

    /**
     * Delete an example
     */
    delete(id: string): boolean {
        this.load();
        const index = this.examples.findIndex(e => e.id === id);
        if (index === -1) return false;

        this.examples.splice(index, 1);
        this.save();

        return true;
    }

    /**
     * Clear all examples
     */
    clear(): void {
        this.examples = [];
        this.save();
    }

    /**
     * Generate unique ID
     */
    private generateId(goal: string, timestamp: Date): string {
        const hash = createHash('sha256')
            .update(goal + timestamp.toISOString())
            .digest('hex')
            .substring(0, 12);
        return `ex_${hash}`;
    }
}

/**
 * Factory function
 */
export function createTrainingDataCollector(projectRoot: string): TrainingDataCollector {
    return new TrainingDataCollector(projectRoot);
}
