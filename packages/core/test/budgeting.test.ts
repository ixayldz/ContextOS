/**
 * Unit tests for token budgeting module
 */

import { describe, it, expect } from 'vitest';
import { TokenBudget } from '../src/budgeting/token-budget.js';

describe('TokenBudget', () => {
    describe('constructor', () => {
        it('should use default model', () => {
            const budget = new TokenBudget();
            expect(budget.getModelLimit()).toBe(128000); // gpt-4-turbo default
        });

        it('should accept custom model', () => {
            const budget = new TokenBudget('gpt-4');
            expect(budget.getModelLimit()).toBe(8192);
        });

        it('should accept custom max tokens', () => {
            const budget = new TokenBudget('gpt-4', 4000);
            expect(budget.getModelLimit()).toBe(4000);
        });
    });

    describe('count', () => {
        it('should estimate token count', () => {
            const budget = new TokenBudget();

            // ~4 chars per token
            expect(budget.count('hello')).toBe(2); // 5 chars / 4 = 1.25 -> 2
            expect(budget.count('a'.repeat(100))).toBe(25); // 100 / 4 = 25
        });
    });

    describe('getAllocation', () => {
        it('should return small context allocation for 8k', () => {
            const budget = new TokenBudget('gpt-4');
            const allocation = budget.getAllocation(8000);

            expect(allocation.immutableCore).toBe(0.15);
            expect(allocation.activeFocus).toBe(0.45);
            expect(allocation.buffer).toBe(0.25);
        });

        it('should return medium allocation for 32k', () => {
            const budget = new TokenBudget();
            const allocation = budget.getAllocation(32000);

            expect(allocation.immutableCore).toBe(0.10);
            expect(allocation.activeFocus).toBe(0.50);
        });

        it('should return large allocation for 128k+', () => {
            const budget = new TokenBudget('gpt-4-turbo');
            const allocation = budget.getAllocation(128000);

            expect(allocation.immutableCore).toBe(0.05);
            expect(allocation.activeFocus).toBe(0.55);
            expect(allocation.strategicContext).toBe(0.25);
        });
    });

    describe('packContext', () => {
        it('should pack files within budget', () => {
            const budget = new TokenBudget('gpt-4', 1000);

            const rankedFiles = [
                {
                    path: 'src/main.ts',
                    score: { vector: 0.9, graph: 0.8, manual: 0, final: 0.85 },
                    chunks: [{ chunkId: '1', filePath: 'src/main.ts', content: 'const x = 1;', score: 0.9, lines: [1, 10] as [number, number] }],
                    reason: 'semantic match',
                },
            ];

            const coreContent = 'project: test';
            const rules: { rule: string; severity: 'warning' | 'error' | 'info' }[] = [
                { rule: 'No console.log', severity: 'warning' },
            ];

            const result = budget.packContext(rankedFiles, coreContent, rules, 1000);

            expect(result.totalTokens).toBeLessThan(1000);
            expect(result.files.length).toBeGreaterThan(0);
            expect(result.allocation).toBeDefined();
        });

        it('should calculate savings', () => {
            const budget = new TokenBudget('gpt-4', 500);

            const rankedFiles = [
                {
                    path: 'big.ts',
                    score: { vector: 0.9, graph: 0.8, manual: 0, final: 0.85 },
                    chunks: [{ chunkId: '1', filePath: 'big.ts', content: 'x'.repeat(2000), score: 0.9, lines: [1, 100] as [number, number] }],
                    reason: 'test',
                },
            ];

            const result = budget.packContext(rankedFiles, '', [], 500);

            expect(result.savings.percentage).toBeGreaterThan(0);
            expect(result.truncated).toBe(true);
        });
    });

    describe('setModel', () => {
        it('should update model and limit', () => {
            const budget = new TokenBudget('gpt-4');
            expect(budget.getModelLimit()).toBe(8192);

            budget.setModel('claude-3-opus');
            expect(budget.getModelLimit()).toBe(200000);
        });
    });
});
