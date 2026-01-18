/**
 * OpenAI Model Adapter
 * Adapter for GPT-4, GPT-4o, o1, o3 models
 * Fixed: Added rate limiting to prevent API quota exhaustion
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: Record<string, string | undefined> };
declare const fetch: typeof globalThis.fetch;

import type { ModelAdapter, CompletionRequest, CompletionResponse } from './types.js';
import { getModelContextSize, estimateTokens } from './types.js';
import { RateLimiter, getDefaultRateLimit } from './rate-limiter.js';

/**
 * OpenAI Adapter for ContextOS RLM Engine
 */
export class OpenAIAdapter implements ModelAdapter {
    readonly name = 'openai';
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
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
        this.model = options.model || 'gpt-5.2';
        this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
        this.maxContextTokens = getModelContextSize('openai', this.model);

        // Initialize rate limiter with OpenAI default limits
        const rateLimit = options.requestsPerMinute || getDefaultRateLimit('openai', this.model);
        this.rateLimiter = new RateLimiter({ requestsPerMinute: rateLimit });

        if (!this.apiKey) {
            console.warn('OpenAI API key not set. Set OPENAI_API_KEY environment variable.');
        }
    }

    async complete(request: CompletionRequest, retryCount: number = 0): Promise<CompletionResponse> {
        if (!this.apiKey) {
            return {
                content: '',
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                finishReason: 'error',
                error: 'OpenAI API key not configured',
            };
        }

        // Wait for rate limiter slot
        await this.rateLimiter.waitForSlot();

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: request.systemPrompt },
                        { role: 'user', content: request.userMessage },
                    ],
                    temperature: request.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? 4000,
                    stop: request.stopSequences,
                }),
            });

            // Handle rate limiting (429)
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;

                if (retryCount < 3) {
                    console.warn(`OpenAI rate limited. Waiting ${waitTime}ms before retry (${retryCount + 1}/3)...`);
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
                    error: `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`,
                };
            }

            const data = await response.json() as {
                choices?: Array<{
                    message?: { content?: string };
                    finish_reason?: string;
                }>;
                usage?: {
                    prompt_tokens?: number;
                    completion_tokens?: number;
                    total_tokens?: number;
                };
            };
            const choice = data.choices?.[0];

            return {
                content: choice?.message?.content || '',
                tokensUsed: {
                    prompt: data.usage?.prompt_tokens || 0,
                    completion: data.usage?.completion_tokens || 0,
                    total: data.usage?.total_tokens || 0,
                },
                finishReason: choice?.finish_reason === 'stop' ? 'stop' : 'length',
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
        // For accurate counting, you'd use tiktoken
        // This is a reasonable estimate
        return estimateTokens(text);
    }
}

/**
 * Check if OpenAI is available
 */
export function isOpenAIAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * Create OpenAI adapter with default configuration
 */
export function createOpenAIAdapter(model?: string): OpenAIAdapter {
    return new OpenAIAdapter({ model });
}
