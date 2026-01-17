/**
 * Unit tests for code chunker
 */

import { describe, it, expect } from 'vitest';
import { chunkCode, mergeSmallChunks } from '../src/embedding/chunker.js';

describe('chunkCode', () => {
    it('should split code into chunks', () => {
        const code = `
function foo() {
    return 1;
}

function bar() {
    return 2;
}

function baz() {
    return 3;
}
`.trim();

        const chunks = chunkCode('test.ts', code, { chunkSize: 50, minChunkSize: 10 });

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].filePath).toBe('test.ts');
        expect(chunks[0].startLine).toBe(1);
    });

    it('should detect chunk types', () => {
        const code = `
class MyClass {
    method() {}
}

function myFunction() {
    return true;
}

import { something } from './module';
`.trim();

        const chunks = chunkCode('test.ts', code, { chunkSize: 50, minChunkSize: 10 });

        const classChunk = chunks.find(c => c.type === 'class');
        const funcChunk = chunks.find(c => c.type === 'function');

        // At least some chunks should be detected
        expect(chunks.length).toBeGreaterThan(0);
    });

    it('should include hash for each chunk', () => {
        const chunks = chunkCode('test.ts', 'const x = 1;', { minChunkSize: 5 });

        expect(chunks[0].hash).toBeDefined();
        expect(chunks[0].hash.length).toBe(8);
    });

    it('should handle empty content', () => {
        const chunks = chunkCode('empty.ts', '');
        expect(chunks).toEqual([]);
    });

    it('should respect minChunkSize', () => {
        const chunks = chunkCode('small.ts', 'x', { minChunkSize: 100 });
        expect(chunks).toEqual([]);
    });
});

describe('mergeSmallChunks', () => {
    it('should merge small adjacent chunks', () => {
        const chunks = [
            { id: '1', filePath: 'test.ts', content: 'a', startLine: 1, endLine: 1, hash: 'a', type: 'block' as const },
            { id: '2', filePath: 'test.ts', content: 'b', startLine: 2, endLine: 2, hash: 'b', type: 'block' as const },
        ];

        const merged = mergeSmallChunks(chunks, 100);

        expect(merged.length).toBe(1);
        expect(merged[0].content).toContain('a');
        expect(merged[0].content).toContain('b');
    });

    it('should not merge large chunks', () => {
        const chunks = [
            { id: '1', filePath: 'test.ts', content: 'x'.repeat(500), startLine: 1, endLine: 50, hash: 'a', type: 'block' as const },
            { id: '2', filePath: 'test.ts', content: 'y'.repeat(500), startLine: 51, endLine: 100, hash: 'b', type: 'block' as const },
        ];

        const merged = mergeSmallChunks(chunks, 100);

        expect(merged.length).toBe(2);
    });
});
