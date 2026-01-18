/**
 * Anthropic Model Adapter
 * Adapter for Claude 4.5 Opus and other models
 * Fixed: Added rate limiting to prevent API quota exhaustion
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: Record<string, string | undefined> };
declare const fetch: typeof globalThis.fetch;

import type { ModelAdapter, CompletionRequest, CompletionResponse } from './types.js';
import { getModelContextSize, estimateTokens } from './types.js';
import { RateLimiter, getDefaultRateLimit } from './rate-limiter.js';

/**
 * Anthropic Adapter for ContextOS RLM Engine
 */
export class AnthropicAdapter implements ModelAdapter {
    readonly name = 'anthropic';
    readonly maxContextTokens: number;

    private apiKey: string;
    private model: string;
    private baseUrl: string;
    private rateLimiter: RateLimiter;

    constructor(options: {
        apiKey?: string;
        model?: string;
        baseUrl?: string;
        requestsPerMinute?: number;
    } = {}) {
        this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.model = options.model || 'claude-4.5-opus-20260115';
        this.baseUrl = options.baseUrl || 'https://api.anthropic.com';
        this.maxContextTokens = getModelContextSize('anthropic', this.model);

        // Initialize rate limiter with Anthropic default limits
        const rateLimit = options.requestsPerMinute || getDefaultRateLimit('anthropic', this.model);
        this.rateLimiter = new RateLimiter({ requestsPerMinute: rateLimit });
    }

    async complete(request: CompletionRequest, retryCount: number = 0): Promise<CompletionResponse> {
        if (!this.apiKey) {
            return {
                content: '',
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                finishReason: 'error',
                error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.',
            };
        }

        // Wait for rate limiter slot
        await this.rateLimiter.waitForSlot();

        try {
            const response = await fetch(`${this.baseUrl}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: request.model ?? this.model,
                    max_tokens: request.maxTokens ?? 4000,
                    system: request.systemPrompt,
                    messages: [
                        { role: 'user', content: request.userMessage },
                    ],
                    temperature: request.temperature ?? 0.7,
                    stop_sequences: request.stopSequences,
                }),
            });

            // Handle rate limiting (429)
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;

                if (retryCount < 3) {
                    console.warn(`Anthropic rate limited. Waiting ${waitTime}ms before retry (${retryCount + 1}/3)...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return this.complete(request, retryCount + 1);
                }

                return {
                    content: '',
                    tokensUsed: { prompt: 0, completion: 0, total: 0 },
                    finishReason: 'error',
                    error: `Rate limit exceeded after ${retryCount} retries`,
                };
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    content: '',
                    tokensUsed: { prompt: 0, completion: 0, total: 0 },
                    finishReason: 'error',
                    error: `Anthropic API error: ${response.status} - ${JSON.stringify(errorData)}`,
                };
            }

            const data = await response.json() as {
                content?: Array<{ type: string; text?: string }>;
                usage?: { input_tokens?: number; output_tokens?: number };
                stop_reason?: string;
            };

            // Extract text content
            const content = data.content
                ?.filter((c) => c.type === 'text')
                ?.map((c) => c.text || '')
                ?.join('') || '';

            return {
                content,
                tokensUsed: {
                    prompt: data.usage?.input_tokens || 0,
                    completion: data.usage?.output_tokens || 0,
                    total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
                },
                finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
            };
        } catch (error) {
            return {
                content: '',
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                finishReason: 'error',
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async countTokens(text: string): Promise<number> {
        // Anthropic doesn't have a public tokenizer
        // This estimate works well for Claude
        return estimateTokens(text);
    }
}

/**
 * Check if Anthropic is available
 */
export function isAnthropicAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Create Anthropic adapter with default configuration
 */
export function createAnthropicAdapter(model?: string): AnthropicAdapter {
    return new AnthropicAdapter({ model });
}
