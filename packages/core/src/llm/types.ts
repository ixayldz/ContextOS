/**
 * LLM Adapter Types
 * Unified interface for multiple LLM providers
 */

// Re-export from RLM types for consistency
export type {
    ModelAdapter,
    CompletionRequest,
    CompletionResponse,
} from '../rlm/types.js';

/**
 * Available model providers
 */
export type ModelProvider = 'openai' | 'anthropic' | 'gemini' | 'local';

/**
 * Model configuration
 */
export interface ModelConfig {
    /** Provider name */
    provider: ModelProvider;

    /** Model name/ID */
    model: string;

    /** API key (from env if not provided) */
    apiKey?: string;

    /** Base URL for API (for custom endpoints) */
    baseUrl?: string;

    /** Default temperature */
    defaultTemperature?: number;

    /** Default max tokens */
    defaultMaxTokens?: number;
}

/**
 * Token count estimate without API call
 */
export function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    // More accurate for code which tends to have shorter tokens
    return Math.ceil(text.length / 3.5);
}

/**
 * Get model's context window size
 */
export function getModelContextSize(provider: ModelProvider, model: string): number {
    const contextSizes: Record<string, number> = {
        // OpenAI
        'gpt-4': 8192,
        'gpt-4-turbo': 128000,
        'gpt-4o': 128000,
        'gpt-4o-mini': 128000,
        'gpt-5': 256000,
        'gpt-5.1': 256000,
        'gpt-5.2': 512000,
        'o1': 200000,
        'o1-mini': 128000,
        'o3': 200000,

        // Anthropic
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
        'claude-3-haiku': 200000,
        'claude-3.5-sonnet': 200000,
        'claude-4-opus': 500000,
        'claude-4.5-opus': 1000000,
        'claude-4-sonnet': 500000,

        // Google
        'gemini-pro': 32000,
        'gemini-1.5-pro': 1000000,
        'gemini-1.5-flash': 1000000,
        'gemini-2.0-flash': 1000000,
        'gemini-3-pro': 2000000,
        'gemini-3-pro-preview': 2000000,
        'gemini-3-flash': 2000000,

        // Local (conservative defaults)
        'llama-3': 8192,
        'mistral': 32000,
        'qwen': 32000,
    };

    // Try exact match
    if (contextSizes[model]) {
        return contextSizes[model];
    }

    // Try partial match
    for (const [key, size] of Object.entries(contextSizes)) {
        if (model.toLowerCase().includes(key.toLowerCase())) {
            return size;
        }
    }

    // Defaults by provider
    const providerDefaults: Record<ModelProvider, number> = {
        openai: 128000,
        anthropic: 200000,
        gemini: 1000000,
        local: 8192,
    };

    return providerDefaults[provider] || 8192;
}

/**
 * Pricing per 1M tokens (input/output)
 */
export interface ModelPricing {
    inputPer1M: number;
    outputPer1M: number;
}

export function getModelPricing(_provider: ModelProvider, model: string): ModelPricing {
    const pricing: Record<string, ModelPricing> = {
        // OpenAI (USD)
        'gpt-4-turbo': { inputPer1M: 10, outputPer1M: 30 },
        'gpt-4o': { inputPer1M: 5, outputPer1M: 15 },
        'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
        'gpt-5': { inputPer1M: 15, outputPer1M: 45 },
        'gpt-5.1': { inputPer1M: 12, outputPer1M: 36 },
        'gpt-5.2': { inputPer1M: 10, outputPer1M: 30 },
        'o1': { inputPer1M: 15, outputPer1M: 60 },

        // Anthropic (USD)
        'claude-3-opus': { inputPer1M: 15, outputPer1M: 75 },
        'claude-3-sonnet': { inputPer1M: 3, outputPer1M: 15 },
        'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
        'claude-4-opus': { inputPer1M: 20, outputPer1M: 100 },
        'claude-4.5-opus': { inputPer1M: 25, outputPer1M: 125 },

        // Google (USD)
        'gemini-1.5-pro': { inputPer1M: 3.5, outputPer1M: 10.5 },
        'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
        'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
        'gemini-3-pro': { inputPer1M: 5, outputPer1M: 15 },
        'gemini-3-pro-preview': { inputPer1M: 5, outputPer1M: 15 },
    };

    for (const [key, price] of Object.entries(pricing)) {
        if (model.toLowerCase().includes(key.toLowerCase())) {
            return price;
        }
    }

    // Default: assume free (local models)
    return { inputPer1M: 0, outputPer1M: 0 };
}

/**
 * Calculate cost for a request
 */
export function calculateCost(
    _provider: ModelProvider,
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const pricing = getModelPricing(_provider, model);
    return (
        (inputTokens / 1_000_000) * pricing.inputPer1M +
        (outputTokens / 1_000_000) * pricing.outputPer1M
    );
}
