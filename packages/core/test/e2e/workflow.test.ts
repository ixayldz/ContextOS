/**
 * E2E Test: Full Workflow
 * 
 * Tests the complete ContextOS workflow:
 * 1. Initialize project
 * 2. Index files
 * 3. Build context
 * 4. Verify output quality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test project setup
const TEST_PROJECT_DIR = join(tmpdir(), 'contextos-e2e-test');
const CLI_PATH = join(__dirname, '..', '..', '..', 'cli', 'dist', 'index.js');

function runCLI(command: string, cwd: string = TEST_PROJECT_DIR): { stdout: string; stderr: string; code: number } {
    try {
        const stdout = execSync(`node "${CLI_PATH}" ${command}`, {
            cwd,
            encoding: 'utf-8',
            timeout: 60000,
            env: { ...process.env, NO_COLOR: '1' },
        });
        return { stdout, stderr: '', code: 0 };
    } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        return {
            stdout: execError.stdout || '',
            stderr: execError.stderr || '',
            code: execError.status || 1,
        };
    }
}

describe('E2E: Full Workflow', () => {
    beforeAll(() => {
        // Clean up any existing test directory
        if (existsSync(TEST_PROJECT_DIR)) {
            rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
        }

        // Create test project structure
        mkdirSync(TEST_PROJECT_DIR, { recursive: true });
        mkdirSync(join(TEST_PROJECT_DIR, 'src'), { recursive: true });
        mkdirSync(join(TEST_PROJECT_DIR, 'src', 'auth'), { recursive: true });
        mkdirSync(join(TEST_PROJECT_DIR, 'src', 'api'), { recursive: true });

        // Create test files
        writeFileSync(
            join(TEST_PROJECT_DIR, 'package.json'),
            JSON.stringify({
                name: 'e2e-test-project',
                version: '1.0.0',
                type: 'module',
            }, null, 2)
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'auth', 'AuthController.ts'),
            `
import { AuthService } from './AuthService';
import { RateLimiter } from '../api/RateLimiter';

export class AuthController {
    private authService: AuthService;
    private rateLimiter: RateLimiter;

    constructor() {
        this.authService = new AuthService();
        this.rateLimiter = new RateLimiter();
    }

    async login(username: string, password: string): Promise<string> {
        if (!this.rateLimiter.checkLimit(username)) {
            throw new Error('Rate limit exceeded');
        }
        return this.authService.authenticate(username, password);
    }

    async logout(token: string): Promise<void> {
        await this.authService.invalidateToken(token);
    }
}
`
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'auth', 'AuthService.ts'),
            `
export class AuthService {
    private tokens: Map<string, string> = new Map();

    async authenticate(username: string, password: string): Promise<string> {
        // Validate credentials
        const token = this.generateToken();
        this.tokens.set(token, username);
        return token;
    }

    async invalidateToken(token: string): Promise<void> {
        this.tokens.delete(token);
    }

    private generateToken(): string {
        return Math.random().toString(36).substring(2);
    }
}
`
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'api', 'RateLimiter.ts'),
            `
export class RateLimiter {
    private requests: Map<string, number[]> = new Map();
    private maxRequests: number = 100;
    private windowMs: number = 60000;

    checkLimit(key: string): boolean {
        const now = Date.now();
        const requests = this.requests.get(key) || [];
        
        // Filter to requests within window
        const recentRequests = requests.filter(t => now - t < this.windowMs);
        
        if (recentRequests.length >= this.maxRequests) {
            return false;
        }

        recentRequests.push(now);
        this.requests.set(key, recentRequests);
        return true;
    }

    reset(key: string): void {
        this.requests.delete(key);
    }
}
`
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'index.ts'),
            `
export { AuthController } from './auth/AuthController';
export { AuthService } from './auth/AuthService';
export { RateLimiter } from './api/RateLimiter';
`
        );
    });

    afterAll(() => {
        // Clean up test directory
        if (existsSync(TEST_PROJECT_DIR)) {
            rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
        }
    });

    it('should initialize a new project', () => {
        const result = runCLI('init -y');

        expect(result.code).toBe(0);
        expect(existsSync(join(TEST_PROJECT_DIR, '.contextos'))).toBe(true);
        expect(existsSync(join(TEST_PROJECT_DIR, '.contextos', 'context.yaml'))).toBe(true);
    });

    it('should detect project language as TypeScript', () => {
        const contextYaml = readFileSync(
            join(TEST_PROJECT_DIR, '.contextos', 'context.yaml'),
            'utf-8'
        );

        expect(contextYaml).toContain('typescript');
    });

    it('should index the project', () => {
        const result = runCLI('index');

        expect(result.code).toBe(0);
        // Check that index files were created
        expect(existsSync(join(TEST_PROJECT_DIR, '.contextos', 'db'))).toBe(true);
    });

    it('should set a goal', () => {
        const result = runCLI('goal "Add rate limiting to AuthController"');

        expect(result.code).toBe(0);
    });

    it('should build context with relevant files', () => {
        const result = runCLI('build');

        expect(result.code).toBe(0);

        // Context should include AuthController and RateLimiter
        const contextFile = join(TEST_PROJECT_DIR, '.contextos', 'cache', 'last-context.md');
        if (existsSync(contextFile)) {
            const context = readFileSync(contextFile, 'utf-8');
            expect(context).toContain('AuthController');
            expect(context).toContain('RateLimiter');
        }
    });

    it('should copy context to clipboard format', () => {
        const result = runCLI('preview');

        expect(result.code).toBe(0);
        expect(result.stdout).toBeTruthy();
    });

    it('should run doctor check', () => {
        const result = runCLI('doctor');

        // Doctor should pass (no drift)
        expect([0, 1]).toContain(result.code); // May have warnings
    });

    it('should trace dependencies correctly', () => {
        const result = runCLI('trace src/auth/AuthController.ts');

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('AuthService');
        expect(result.stdout).toContain('RateLimiter');
    });
});

describe('E2E: Error Handling', () => {
    const EMPTY_DIR = join(tmpdir(), 'contextos-e2e-empty');

    beforeAll(() => {
        if (existsSync(EMPTY_DIR)) {
            rmSync(EMPTY_DIR, { recursive: true, force: true });
        }
        mkdirSync(EMPTY_DIR, { recursive: true });
    });

    afterAll(() => {
        if (existsSync(EMPTY_DIR)) {
            rmSync(EMPTY_DIR, { recursive: true, force: true });
        }
    });

    it('should fail gracefully when not initialized', () => {
        const result = runCLI('build', EMPTY_DIR);

        expect(result.code).not.toBe(0);
        expect(result.stderr || result.stdout).toContain('init');
    });

    it('should suggest running init', () => {
        const result = runCLI('index', EMPTY_DIR);

        expect(result.code).not.toBe(0);
    });
});

describe('E2E: Performance', () => {
    it('should complete indexing within timeout', async () => {
        const startTime = Date.now();
        const result = runCLI('index');
        const duration = Date.now() - startTime;

        expect(result.code).toBe(0);
        expect(duration).toBeLessThan(30000); // 30 seconds max
    });

    it('should complete context building within timeout', async () => {
        const startTime = Date.now();
        const result = runCLI('build');
        const duration = Date.now() - startTime;

        expect(result.code).toBe(0);
        expect(duration).toBeLessThan(10000); // 10 seconds max
    });
});
