/**
 * Anthropic Model Adapter
 * Adapter for Claude 4.5 Opus and other models
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: Record<string, string | undefined> };
declare const fetch: typeof globalThis.fetch;

import type { ModelAdapter, CompletionRequest, CompletionResponse } from './types.js';
import { getModelContextSize, estimateTokens } from './types.js';

/**
 * Anthropic Adapter for ContextOS RLM Engine
 */
export class AnthropicAdapter implements ModelAdapter {
    readonly name = 'anthropic';
    readonly maxContextTokens: number;

    private apiKey: string;
    private model: string;
    private baseUrl: string;

    constructor(options: {
        apiKey?: string;
        model?: string;
        baseUrl?: string;
    } = {}) {
        this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.model = options.model || 'claude-4.5-opus-20260115';
        this.baseUrl = options.baseUrl || 'https://api.anthropic.com';
        this.maxContextTokens = getModelContextSize('anthropic', this.model);
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        if (!this.apiKey) {
            return {
                content: '',
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                finishReason: 'error',
                error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.',
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: request.maxTokens ?? 4000,
                    system: request.systemPrompt,
                    messages: [
                        { role: 'user', content: request.userMessage },
                    ],
                    temperature: request.temperature ?? 0.7,
                    stop_sequences: request.stopSequences,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `Anthropic API error: ${response.status} - ${JSON.stringify(errorData)}`
                );
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
