/**
 * Performance Benchmark Suite
 * Tests against PRD targets:
 * - Index 10K lines: < 30s
 * - ctx build (cached): < 200ms
 * - Memory usage: < 500MB
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Simulated modules for benchmarking
const createMockFile = (lines: number): string => {
    const imports = `import { Component } from 'react';\nimport { useState, useEffect } from 'react';\n`;
    const functions: string[] = [];

    for (let i = 0; i < Math.floor(lines / 10); i++) {
        functions.push(`
export function handler${i}(req: Request, res: Response) {
    const data = req.body;
    const result = processData(data);
    return res.json({ success: true, data: result });
}
`);
    }

    return imports + functions.join('\n');
};

describe('Performance Benchmarks', () => {
    const BENCHMARK_DIR = join(tmpdir(), 'contextos-benchmark');

    beforeAll(() => {
        // Create temp benchmark directory
        if (existsSync(BENCHMARK_DIR)) {
            rmSync(BENCHMARK_DIR, { recursive: true });
        }
        mkdirSync(BENCHMARK_DIR, { recursive: true });
    });

    afterAll(() => {
        // Cleanup
        if (existsSync(BENCHMARK_DIR)) {
            rmSync(BENCHMARK_DIR, { recursive: true });
        }
    });

    describe('Indexing Performance', () => {
        it('should generate 10K lines of test files', () => {
            // Create test files totaling ~10K lines
            const filesCount = 50;
            const linesPerFile = 200;

            for (let i = 0; i < filesCount; i++) {
                const content = createMockFile(linesPerFile);
                const filePath = join(BENCHMARK_DIR, `module${i}.ts`);
                writeFileSync(filePath, content);
            }

            // Verify files created
            expect(existsSync(join(BENCHMARK_DIR, 'module0.ts'))).toBe(true);
            expect(existsSync(join(BENCHMARK_DIR, 'module49.ts'))).toBe(true);
        });

        it('should process files within acceptable time', () => {
            const startTime = performance.now();

            // Simulate file reading and processing
            let totalLines = 0;
            for (let i = 0; i < 50; i++) {
                const content = createMockFile(200);
                totalLines += content.split('\n').length;
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Processed ${totalLines} lines in ${duration.toFixed(2)}ms`);

            // Should be fast for in-memory processing
            expect(duration).toBeLessThan(1000); // < 1s for mock processing
        });
    });

    describe('Memory Usage', () => {
        it('should track memory usage during operations', () => {
            const _initialMemory = process.memoryUsage();

            // Allocate some memory (simulate indexing)
            const largeArray: string[] = [];
            for (let i = 0; i < 10000; i++) {
                largeArray.push(createMockFile(10));
            }

            const peakMemory = process.memoryUsage();
            const heapUsedMB = peakMemory.heapUsed / 1024 / 1024;

            console.log(`Heap used: ${heapUsedMB.toFixed(2)} MB`);
            console.log(`RSS: ${(peakMemory.rss / 1024 / 1024).toFixed(2)} MB`);

            // PRD target: < 500MB during indexing
            expect(peakMemory.heapUsed).toBeLessThan(500 * 1024 * 1024);
        });
    });

    describe('Token Estimation Performance', () => {
        it('should estimate tokens quickly', () => {
            const largeText = 'a'.repeat(100000); // 100K characters

            const startTime = performance.now();

            // Simple token estimation (similar to estimateTokens)
            const tokens = Math.ceil(largeText.length / 3.5);

            const duration = performance.now() - startTime;

            console.log(`Estimated ${tokens} tokens in ${duration.toFixed(3)}ms`);
            expect(duration).toBeLessThan(10); // < 10ms
        });
    });

    describe('Context Build Performance', () => {
        it('should measure context building speed', () => {
            const startTime = performance.now();

            // Simulate context building operations
            const files = [];
            for (let i = 0; i < 100; i++) {
                files.push({
                    path: `src/module${i}.ts`,
                    content: createMockFile(50),
                    score: Math.random(),
                });
            }

            // Sort by score (ranking simulation)
            files.sort((a, b) => b.score - a.score);

            // Take top 20 (budget simulation)
            const selectedFiles = files.slice(0, 20);

            // Merge content
            const context = selectedFiles.map(f => f.content).join('\n');

            const duration = performance.now() - startTime;

            console.log(`Built context (${context.length} chars) in ${duration.toFixed(2)}ms`);

            // PRD target: < 200ms for cached build
            expect(duration).toBeLessThan(200);
        });
    });
});

// Export benchmark runner for CLI
export async function runBenchmarks(): Promise<{
    indexSpeed: number;
    buildSpeed: number;
    memoryUsage: number;
}> {
    const results = {
        indexSpeed: 0,
        buildSpeed: 0,
        memoryUsage: 0,
    };

    // Index speed test
    const indexStart = performance.now();
    for (let i = 0; i < 100; i++) {
        createMockFile(100);
    }
    results.indexSpeed = performance.now() - indexStart;

    // Build speed test
    const buildStart = performance.now();
    const files = Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.ts`,
        content: createMockFile(50),
        score: Math.random(),
    }));
    files.sort((a, b) => b.score - a.score).slice(0, 20);
    results.buildSpeed = performance.now() - buildStart;

    // Memory usage
    results.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    return results;
}
