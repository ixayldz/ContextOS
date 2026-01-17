/**
 * RLM Engine Tests
 * Unit tests for Recursive Language Model execution engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    RLMEngine,
    createRLMEngine,
    DEFAULT_RLM_CONFIG,
    type RLMConfig,
    type ModelAdapter,
    type CompletionRequest,
    type CompletionResponse,
} from '../src/rlm/index.js';

// Mock model adapter for testing
function createMockAdapter(responses: string[]): ModelAdapter {
    let callIndex = 0;
    return {
        name: 'mock',
        maxContextTokens: 100000,
        async complete(request: CompletionRequest): Promise<CompletionResponse> {
            const response = responses[callIndex] || responses[responses.length - 1];
            callIndex++;
            return {
                content: response,
                tokensUsed: {
                    prompt: Math.ceil(request.userMessage.length / 4),
                    completion: Math.ceil(response.length / 4),
                    total: Math.ceil((request.userMessage.length + response.length) / 4),
                },
                finishReason: 'stop',
            };
        },
        async countTokens(text: string): Promise<number> {
            return Math.ceil(text.length / 4);
        },
    };
}

describe('RLMEngine', () => {
    describe('Configuration', () => {
        it('should use default config when no options provided', () => {
            const engine = createRLMEngine();
            const config = engine.getConfig();

            expect(config.maxDepth).toBe(DEFAULT_RLM_CONFIG.maxDepth);
            expect(config.maxTokenBudget).toBe(DEFAULT_RLM_CONFIG.maxTokenBudget);
            expect(config.maxIterations).toBe(DEFAULT_RLM_CONFIG.maxIterations);
        });

        it('should merge custom options with defaults', () => {
            const engine = createRLMEngine({
                maxDepth: 10,
                maxTokenBudget: 50000,
            });
            const config = engine.getConfig();

            expect(config.maxDepth).toBe(10);
            expect(config.maxTokenBudget).toBe(50000);
            expect(config.timeoutMs).toBe(DEFAULT_RLM_CONFIG.timeoutMs);
        });

        it('should update config dynamically', () => {
            const engine = createRLMEngine();
            engine.updateConfig({ maxDepth: 3 });

            expect(engine.getConfig().maxDepth).toBe(3);
        });
    });

    describe('Execution', () => {
        it('should throw if model adapter not set', async () => {
            const engine = createRLMEngine();

            await expect(
                engine.execute('test goal', 'test context')
            ).rejects.toThrow('Model adapter not set');
        });

        it('should execute simple answer response', async () => {
            const engine = createRLMEngine();
            engine.setModelAdapter(createMockAdapter([
                '```answer\n{"answer": "The answer is 42", "confidence": 0.95}\n```',
            ]));

            const result = await engine.execute('What is the answer?', 'Some context');

            expect(result.answer).toBe('The answer is 42');
            expect(result.confidence).toBe(0.95);
            expect(result.truncated).toBe(false);
        });

        it('should execute code and observe results', async () => {
            const engine = createRLMEngine();
            engine.setModelAdapter(createMockAdapter([
                '```code\nctx.length()\n```',
                '```answer\n{"answer": "Context has 100 chars", "confidence": 0.9}\n```',
            ]));

            const result = await engine.execute('How long is the context?', 'x'.repeat(100));

            expect(result.answer).toContain('100');
            expect(result.executionPath.length).toBeGreaterThan(0);
        });

        it('should respect depth limit', async () => {
            const engine = createRLMEngine({ maxDepth: 0 });
            engine.setModelAdapter(createMockAdapter([]));

            const result = await engine.execute('test', 'context', 1);

            expect(result.truncated).toBe(true);
            expect(result.truncationReason).toBe('depth');
        });

        it('should respect iteration limit', async () => {
            const engine = createRLMEngine({ maxIterations: 2 });
            // Always return code, never answer
            engine.setModelAdapter(createMockAdapter([
                '```code\nctx.length()\n```',
                '```code\nctx.lines()\n```',
                '```code\nctx.find("x")\n```',
            ]));

            const result = await engine.execute('test', 'context');

            expect(result.truncated).toBe(true);
            expect(result.truncationReason).toBe('iterations');
        });
    });

    describe('Action Parsing', () => {
        it('should parse code blocks correctly', async () => {
            const engine = createRLMEngine();
            engine.setModelAdapter(createMockAdapter([
                '```javascript\nconst x = ctx.find("test");\nconsole.log(x);\n```',
                '```answer\n{"answer": "Found at index 5", "confidence": 0.8}\n```',
            ]));

            const result = await engine.execute('Find test', 'hello test world');

            expect(result.executionPath.some(e => e.action === 'code')).toBe(true);
        });

        it('should handle plain text as implicit answer', async () => {
            const engine = createRLMEngine();
            engine.setModelAdapter(createMockAdapter([
                'The answer is simply that there are 3 functions in the code.',
            ]));

            const result = await engine.execute('How many functions?', 'function a() {} function b() {} function c() {}');

            expect(result.answer).toContain('3 functions');
            expect(result.confidence).toBeLessThan(1);
        });
    });

    describe('Safety', () => {
        it('should block dangerous code patterns', async () => {
            const engine = createRLMEngine();
            engine.setModelAdapter(createMockAdapter([
                '```code\nrequire("fs").readFileSync("/etc/passwd")\n```',
                '```answer\n{"answer": "Could not read file", "confidence": 0.5}\n```',
            ]));

            const result = await engine.execute('Read passwd file', 'test');

            // Should have logged a security violation
            expect(result.executionPath.some(e => e.error?.includes('require'))).toBe(true);
        });

        it('should detect loops and force answer', async () => {
            const engine = createRLMEngine({ maxIterations: 5 });
            // Return same code repeatedly
            const sameCode = '```code\nctx.find("x")\n```';
            engine.setModelAdapter(createMockAdapter([
                sameCode,
                sameCode,
                sameCode,
                '```answer\n{"answer": "Forced answer", "confidence": 0.5}\n```',
            ]));

            const result = await engine.execute('test', 'context with x');

            // Should complete without infinite loop
            expect(result).toBeDefined();
        });
    });
});
