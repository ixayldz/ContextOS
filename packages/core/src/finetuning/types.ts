/**
 * Fine-tuning Types
 * Training data collection and export for model fine-tuning
 */

/**
 * A single training example
 */
export interface TrainingExample {
    /**
     * Unique identifier
     */
    id: string;

    /**
     * The goal/prompt provided
     */
    goal: string;

    /**
     * Files that were selected for context
     */
    selectedFiles: string[];

    /**
     * The final context that was built
     */
    context: string;

    /**
     * Token count of the context
     */
    tokenCount: number;

    /**
     * User feedback (if any)
     */
    feedback?: {
        rating: 'good' | 'bad' | 'neutral';
        comment?: string;
    };

    /**
     * Metadata
     */
    meta: {
        projectName: string;
        language: string;
        framework?: string;
        timestamp: Date;
        model?: string;
    };
}

/**
 * Dataset configuration
 */
export interface DatasetConfig {
    /**
     * Minimum rating to include in training
     */
    minRating?: 'good' | 'neutral' | 'bad';

    /**
     * Maximum examples to export
     */
    maxExamples?: number;

    /**
     * Filter by project name
     */
    projectFilter?: string;

    /**
     * Filter by language
     */
    languageFilter?: string;

    /**
     * Include examples without feedback
     */
    includeUnrated?: boolean;

    /**
     * Shuffle examples
     */
    shuffle?: boolean;

    /**
     * Train/validation split ratio (0-1)
     */
    validationSplit?: number;
}

/**
 * Export format options
 */
export interface ExportFormat {
    /**
     * Target format
     */
    format: 'jsonl' | 'openai' | 'anthropic' | 'csv';

    /**
     * Fields to include
     */
    fields?: (keyof TrainingExample)[];

    /**
     * Custom template for formatting
     */
    template?: string;
}

/**
 * Fine-tuning job status
 */
export interface FineTuningJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    provider: 'openai' | 'anthropic' | 'local';
    model: string;
    datasetPath: string;
    createdAt: Date;
    completedAt?: Date;
    error?: string;
    metrics?: {
        trainLoss: number;
        validationLoss?: number;
        epochs: number;
    };
}

/**
 * Dataset statistics
 */
export interface DatasetStats {
    totalExamples: number;
    ratingDistribution: {
        good: number;
        neutral: number;
        bad: number;
        unrated: number;
    };
    languageDistribution: Record<string, number>;
    avgTokenCount: number;
    avgFilesPerExample: number;
    dateRange: {
        earliest: Date;
        latest: Date;
    };
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: Array<{
        line: number;
        field: string;
        message: string;
    }>;
    warnings: string[];
    stats: DatasetStats;
}
