/**
 * OpenAI Model Adapter
 * Adapter for GPT-4, GPT-4o, o1, o3 models
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: Record<string, string | undefined> };
declare const fetch: typeof globalThis.fetch;

import type { ModelAdapter, CompletionRequest, CompletionResponse } from './types.js';
import { getModelContextSize, estimateTokens } from './types.js';

/**
 * OpenAI Adapter for ContextOS RLM Engine
 */
export class OpenAIAdapter implements ModelAdapter {
    readonly name = 'openai';
    readonly maxContextTokens: number;

    private apiKey: string;
    private model: string;
    private baseUrl: string;

    constructor(options: {
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    } = {}) {
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
        this.model = options.model || 'gpt-5.2';
        this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
        this.maxContextTokens = getModelContextSize('openai', this.model);

        if (!this.apiKey) {
            console.warn('OpenAI API key not set. Set OPENAI_API_KEY environment variable.');
        }
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        if (!this.apiKey) {
            return {
                content: '',
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                finishReason: 'error',
                error: 'OpenAI API key not configured',
            };
        }

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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`
                );
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
