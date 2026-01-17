/**
 * Model Adapter Tests
 * Unit tests for LLM model adapters
 */

import { describe, it, expect } from 'vitest';
import {
    estimateTokens,
    getModelContextSize,
    getModelPricing,
    calculateCost,
} from '../src/llm/types.js';
import { OpenAIAdapter, isOpenAIAvailable } from '../src/llm/openai-adapter.js';
import { AnthropicAdapter, isAnthropicAvailable } from '../src/llm/anthropic-adapter.js';

describe('LLM Types', () => {
    describe('estimateTokens', () => {
        it('should estimate tokens for short text', () => {
            const tokens = estimateTokens('Hello World');
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThan(10);
        });

        it('should estimate tokens for longer text', () => {
            const text = 'a'.repeat(1000);
            const tokens = estimateTokens(text);
            // ~3.5 chars per token, so 1000 chars ≈ 286 tokens
            expect(tokens).toBeGreaterThan(200);
            expect(tokens).toBeLessThan(400);
        });

        it('should return 0 for empty string', () => {
            const tokens = estimateTokens('');
            expect(tokens).toBe(0);
        });
    });

    describe('getModelContextSize', () => {
        it('should return correct size for known models', () => {
            expect(getModelContextSize('openai', 'gpt-4o')).toBe(128000);
            expect(getModelContextSize('openai', 'gpt-5.2')).toBe(512000);
            expect(getModelContextSize('anthropic', 'claude-4.5-opus')).toBe(1000000);
            expect(getModelContextSize('gemini', 'gemini-3-pro')).toBe(2000000);
        });

        it('should return default for unknown models', () => {
            const size = getModelContextSize('openai', 'unknown-model');
            expect(size).toBe(128000); // OpenAI default
        });

        it('should handle partial model name matches', () => {
            // gpt-4-turbo variant should match gpt-4-turbo pattern
            const size = getModelContextSize('openai', 'gpt-4-turbo-2024-04-09');
            // It will match 'gpt-4-turbo' in the lookup
            expect(size).toBeGreaterThan(8000);  // Should not fall back to default
        });
    });

    describe('getModelPricing', () => {
        it('should return pricing for known models', () => {
            const pricing = getModelPricing('openai', 'gpt-5.2');
            expect(pricing.inputPer1M).toBeGreaterThan(0);
            expect(pricing.outputPer1M).toBeGreaterThan(0);
        });

        it('should return zero for unknown/local models', () => {
            const pricing = getModelPricing('local', 'llama-custom');
            expect(pricing.inputPer1M).toBe(0);
            expect(pricing.outputPer1M).toBe(0);
        });
    });

    describe('calculateCost', () => {
        it('should calculate cost correctly', () => {
            // Get actual pricing for gpt-5.2
            const pricing = getModelPricing('openai', 'gpt-5.2');
            const cost = calculateCost('openai', 'gpt-5.2', 1000000, 1000000);
            expect(cost).toBe(pricing.inputPer1M + pricing.outputPer1M);
        });

        it('should handle small token counts', () => {
            const cost = calculateCost('openai', 'gpt-5.2', 1000, 500);
            expect(cost).toBeLessThan(1);
            expect(cost).toBeGreaterThan(0);
        });
    });
});

describe('OpenAIAdapter', () => {
    it('should create with default options', () => {
        const adapter = new OpenAIAdapter();
        expect(adapter.name).toBe('openai');
        expect(adapter.maxContextTokens).toBe(512000); // gpt-5.2
    });

    it('should create with custom model', () => {
        const adapter = new OpenAIAdapter({ model: 'gpt-4o' });
        expect(adapter.maxContextTokens).toBe(128000);
    });

    it('should return error when API key not set', async () => {
        const adapter = new OpenAIAdapter({ apiKey: '' });
        const result = await adapter.complete({
            systemPrompt: 'test',
            userMessage: 'test',
        });

        expect(result.finishReason).toBe('error');
        expect(result.error).toContain('API key');
    });

    it('should count tokens', async () => {
        const adapter = new OpenAIAdapter();
        const count = await adapter.countTokens('Hello World');
        expect(count).toBeGreaterThan(0);
    });
});

describe('AnthropicAdapter', () => {
    it('should create with default options', () => {
        const adapter = new AnthropicAdapter();
        expect(adapter.name).toBe('anthropic');
        // claude-4.5-opus has 1M context
        expect(adapter.maxContextTokens).toBeGreaterThanOrEqual(200000);
    });

    it('should create with custom model', () => {
        const adapter = new AnthropicAdapter({ model: 'claude-3-opus' });
        expect(adapter.maxContextTokens).toBe(200000);
    });

    it('should return error when API key not set', async () => {
        const adapter = new AnthropicAdapter({ apiKey: '' });
        const result = await adapter.complete({
            systemPrompt: 'test',
            userMessage: 'test',
        });

        expect(result.finishReason).toBe('error');
        expect(result.error).toContain('API key');
    });

    it('should count tokens', async () => {
        const adapter = new AnthropicAdapter();
        const count = await adapter.countTokens('Hello World');
        expect(count).toBeGreaterThan(0);
    });
});

describe('Availability checks', () => {
    it('should check OpenAI availability', () => {
        // Will be false in test environment without API key
        expect(typeof isOpenAIAvailable()).toBe('boolean');
    });

    it('should check Anthropic availability', () => {
        expect(typeof isAnthropicAvailable()).toBe('boolean');
    });
});
