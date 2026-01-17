/**
 * ContextOS SDK
 * Integration SDK for tool builders
 */

import {
    loadConfig,
    ContextBuilder,
    DependencyGraph,
    VectorStore,
    HybridRanker,
    TokenBudget,
    detectDrift,
    createGeminiClient,
    isGeminiAvailable,
    type LoadedConfig,
    type BuiltContext,
    type DriftReport,
    type GeminiClient,
} from '@contextos/core';

export interface ContextOSOptions {
    rootDir?: string;
    goal?: string;
    maxTokens?: number;
    targetModel?: string;
}

export interface ContextResult {
    content: string;
    files: Array<{
        path: string;
        score: number;
        tokens: number;
    }>;
    goal: string;
    tokenCount: number;
    truncated: boolean;
}

/**
 * ContextOS SDK - Main entry point for integrations
 */
export class ContextOS {
    private config: LoadedConfig | null = null;
    private builder: ContextBuilder | null = null;
    private gemini: GeminiClient | null = null;

    constructor(private options: ContextOSOptions = {}) { }

    /**
     * Initialize ContextOS SDK
     */
    async initialize(): Promise<void> {
        this.config = loadConfig(this.options.rootDir);
        this.builder = new ContextBuilder();
        await this.builder.initialize(this.config.rootDir);

        if (isGeminiAvailable()) {
            this.gemini = createGeminiClient();
        }
    }

    /**
     * Build context for a specific goal
     */
    async buildContext(goal: string): Promise<ContextResult> {
        if (!this.builder) {
            throw new Error('ContextOS not initialized. Call initialize() first.');
        }

        const result = await this.builder.build({
            goal,
            maxTokens: this.options.maxTokens,
            targetModel: this.options.targetModel,
        });

        return {
            content: result.content,
            files: result.files.map(f => ({
                path: f.path,
                score: f.score.final,
                tokens: f.tokens,
            })),
            goal: result.goal,
            tokenCount: result.tokenCount,
            truncated: result.truncated,
        };
    }

    /**
     * Auto-infer goal from git changes
     */
    async inferGoal(): Promise<string> {
        if (!this.builder) {
            throw new Error('ContextOS not initialized. Call initialize() first.');
        }

        const result = await this.builder.build({});
        return result.goal;
    }

    /**
     * Run health check
     */
    async doctor(): Promise<DriftReport> {
        return detectDrift(this.options.rootDir);
    }

    /**
     * Get AI-powered suggestions
     */
    async suggestRules(): Promise<Array<{ rule: string; severity: string; reason: string }>> {
        if (!this.gemini) {
            throw new Error('Gemini not available. Set GEMINI_API_KEY environment variable.');
        }

        // Get sample code
        const config = this.config || loadConfig(this.options.rootDir);
        const existingRules = config.context.constraints?.map(c => c.rule) || [];

        // Use Gemini to suggest rules
        return this.gemini.suggestConstraints('', existingRules);
    }

    /**
     * Check if ContextOS is initialized in directory
     */
    static isInitialized(dir?: string): boolean {
        try {
            loadConfig(dir);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get configuration
     */
    getConfig(): LoadedConfig | null {
        return this.config;
    }
}

// Re-export core types
export {
    type LoadedConfig,
    type BuiltContext,
    type DriftReport,
    type GeminiClient,
};

// Default export
export default ContextOS;
