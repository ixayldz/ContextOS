/**
 * Sandbox Tests
 * Unit tests for RLM sandbox execution environment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    LocalSandbox,
    createSandbox,
    prepareSandboxVariables,
    validateCode,
} from '../src/rlm/sandbox.js';

describe('LocalSandbox', () => {
    let sandbox: LocalSandbox;

    beforeEach(() => {
        sandbox = new LocalSandbox(5000);
    });

    describe('Basic Execution', () => {
        it('should execute simple expressions', async () => {
            const result = await sandbox.execute('return 1 + 1', {});

            expect(result.success).toBe(true);
            expect(result.output).toBe('2');
        });

        it('should access provided variables', async () => {
            const result = await sandbox.execute('return x + y', { x: 10, y: 20 });

            expect(result.success).toBe(true);
            expect(result.output).toBe('30');
        });

        it('should capture console output', async () => {
            const result = await sandbox.execute('console.log("hello"); console.log("world");', {});

            expect(result.success).toBe(true);
            expect(result.stdout).toContain('hello');
            expect(result.stdout).toContain('world');
        });

        it('should return undefined for statements', async () => {
            const result = await sandbox.execute('const x = 5;', {});

            expect(result.success).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should catch and return errors', async () => {
            const result = await sandbox.execute('throw new Error("test error")', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('test error');
        });

        it('should handle syntax errors', async () => {
            const result = await sandbox.execute('const x = {', {});

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle undefined variable access', async () => {
            const result = await sandbox.execute('undefinedVar', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('undefinedVar');
        });
    });

    describe('Context API Integration', () => {
        it('should work with context API variables', async () => {
            const context = 'Hello World';
            const vars = prepareSandboxVariables(context);

            const result = await sandbox.execute('return ctx.length()', vars);

            expect(result.success).toBe(true);
            expect(result.output).toBe('11');
        });

        it('should find text in context', async () => {
            const context = 'The quick brown fox';
            const vars = prepareSandboxVariables(context);

            const result = await sandbox.execute('return ctx.find("fox")', vars);

            expect(result.success).toBe(true);
            expect(result.output).toBe('16');
        });

        it('should count lines', async () => {
            const context = 'line1\nline2\nline3';
            const vars = prepareSandboxVariables(context);

            const result = await sandbox.execute('return ctx.lines()', vars);

            expect(result.success).toBe(true);
            expect(result.output).toBe('3');
        });
    });

    describe('Reset', () => {
        it('should clear state on reset', async () => {
            await sandbox.execute('const x = 42;', {});
            sandbox.reset();

            // After reset, x should not exist
            const result = await sandbox.execute('x', {});
            expect(result.success).toBe(false);
        });
    });
});

describe('validateCode', () => {
    it('should allow safe code', () => {
        const issues = validateCode('const x = ctx.find("test");');
        expect(issues).toHaveLength(0);
    });

    it('should block require()', () => {
        const issues = validateCode('const fs = require("fs");');
        expect(issues.some(i => i.includes('require'))).toBe(true);
    });

    it('should block dynamic import()', () => {
        const issues = validateCode('const mod = import("./module");');
        expect(issues.some(i => i.includes('import'))).toBe(true);
    });

    it('should block eval()', () => {
        const issues = validateCode('eval("malicious code");');
        expect(issues.some(i => i.includes('eval'))).toBe(true);
    });

    it('should block process access', () => {
        const issues = validateCode('process.exit(1);');
        expect(issues.some(i => i.includes('process'))).toBe(true);
    });

    it('should block fs module', () => {
        const issues = validateCode('fs.readFile("test.txt");');
        expect(issues.some(i => i.includes('fs'))).toBe(true);
    });
});

describe('createSandbox factory', () => {
    it('should create local sandbox by default', () => {
        const sandbox = createSandbox();
        expect(sandbox).toBeInstanceOf(LocalSandbox);
    });

    it('should create local sandbox for docker (fallback)', () => {
        const sandbox = createSandbox('docker');
        expect(sandbox).toBeInstanceOf(LocalSandbox);
    });

    it('should respect timeout option', () => {
        const sandbox = createSandbox('local', { timeout: 1000 });
        expect(sandbox).toBeInstanceOf(LocalSandbox);
    });
});
