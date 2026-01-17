/**
 * RLM Sandbox
 * Safe, isolated code execution environment for RLM agent
 * Implements the "REPL as Cognitive Workspace" concept from MIT CSAIL research
 */

import { createContext, runInContext, type Context } from 'node:vm';
import type { SandboxResult, SandboxContext } from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContextAPI } from './context-api.js';

export interface Sandbox {
    /** Execute code with given variables in sandbox */
    execute(code: string, variables: Record<string, unknown>): Promise<SandboxResult>;

    /** Reset sandbox state */
    reset(): void;

    /** Get current variables */
    getVariables(): Record<string, unknown>;
}

/**
 * Local sandbox using Node.js VM module
 * Suitable for development and trusted environments
 */
export class LocalSandbox implements Sandbox {
    private vmContext: Context;
    private variables: Record<string, unknown> = {};
    private readonly timeout: number;

    constructor(timeout: number = 10000) {
        this.timeout = timeout;
        this.vmContext = this.createSecureContext();
    }

    private createSecureContext(): Context {
        // Create a restricted context with no access to Node.js APIs
        const sandbox: Record<string, unknown> = {
            // Safe globals
            console: {
                log: (...args: unknown[]) => this.captureOutput('log', args),
                error: (...args: unknown[]) => this.captureOutput('error', args),
                warn: (...args: unknown[]) => this.captureOutput('warn', args),
            },
            JSON,
            Math,
            Date,
            String,
            Number,
            Boolean,
            Array,
            Object,
            Map,
            Set,
            RegExp,
            Error,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            encodeURIComponent,
            decodeURIComponent,

            // Explicitly blocked (set to undefined to prevent access)
            require: undefined,
            import: undefined,
            process: undefined,
            global: undefined,
            globalThis: undefined,
            Buffer: undefined,
            __dirname: undefined,
            __filename: undefined,
            module: undefined,
            exports: undefined,

            // Output capture
            __stdout__: [] as string[],
            __result__: undefined,
        };

        return createContext(sandbox, {
            name: 'RLM Sandbox',
            codeGeneration: {
                strings: false, // Disable eval()
                wasm: false,    // Disable WebAssembly
            },
        });
    }

    private outputBuffer: string[] = [];

    private captureOutput(level: string, args: unknown[]): void {
        const message = args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ');
        this.outputBuffer.push(`[${level}] ${message}`);
    }

    async execute(code: string, variables: Record<string, unknown>): Promise<SandboxResult> {
        const startTime = Date.now();
        this.outputBuffer = [];

        try {
            // Inject variables into context
            for (const [key, value] of Object.entries(variables)) {
                this.vmContext[key] = value;
            }

            // Wrap code to capture return value
            const wrappedCode = `
                (function() {
                    try {
                        ${code}
                    } catch (e) {
                        throw e;
                    }
                })();
            `;

            // Execute with timeout
            const result = runInContext(wrappedCode, this.vmContext, {
                timeout: this.timeout,
                displayErrors: true,
            });

            // Extract modified variables
            const modifiedVars: Record<string, unknown> = {};
            for (const key of Object.keys(variables)) {
                if (this.vmContext[key] !== variables[key]) {
                    modifiedVars[key] = this.vmContext[key];
                }
            }

            // Update stored variables
            Object.assign(this.variables, modifiedVars);

            return {
                success: true,
                output: result !== undefined ? String(result) : '',
                stdout: this.outputBuffer.join('\n'),
                durationMs: Date.now() - startTime,
                variables: modifiedVars,
            };
        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : String(error);

            return {
                success: false,
                output: '',
                stdout: this.outputBuffer.join('\n'),
                error: errorMessage,
                durationMs: Date.now() - startTime,
            };
        }
    }

    reset(): void {
        this.variables = {};
        this.outputBuffer = [];
        this.vmContext = this.createSecureContext();
    }

    getVariables(): Record<string, unknown> {
        return { ...this.variables };
    }
}

/**
 * Create a sandbox context with Context Query API injected
 */
export function createSandboxContext(rawContext: string): SandboxContext {
    const ctx = createContextAPI(rawContext);

    return {
        context: rawContext,
        ctx,
        // rlm will be injected by the engine
    };
}

/**
 * Prepare variables for sandbox execution including context API
 */
export function prepareSandboxVariables(
    rawContext: string,
    additionalVariables: Record<string, unknown> = {}
): Record<string, unknown> {
    const ctx = createContextAPI(rawContext);

    return {
        // The raw context string
        context: rawContext,

        // Context Query API methods
        ctx,

        // Shorthand for common operations
        find: ctx.find,
        findAll: ctx.findAll,
        grep: ctx.grep,
        slice: ctx.slice,
        lines: ctx.lines,
        getLines: ctx.getLines,
        head: ctx.head,
        tail: ctx.tail,
        getFunction: ctx.getFunction,
        getClass: ctx.getClass,
        getImports: ctx.getImports,
        getOutline: ctx.getOutline,

        // Additional user-provided variables
        ...additionalVariables,
    };
}

/**
 * Validate that code doesn't contain dangerous patterns
 * Returns array of detected issues
 */
export function validateCode(code: string): string[] {
    const issues: string[] = [];

    const dangerousPatterns = [
        { pattern: /\brequire\s*\(/, message: 'require() is not allowed' },
        { pattern: /\bimport\s*\(/, message: 'Dynamic import() is not allowed' },
        { pattern: /\bprocess\./, message: 'process access is not allowed' },
        { pattern: /\bglobal\./, message: 'global access is not allowed' },
        { pattern: /\bglobalThis\./, message: 'globalThis access is not allowed' },
        { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
        { pattern: /\bFunction\s*\(/, message: 'Function constructor is not allowed' },
        { pattern: /\bchild_process/, message: 'child_process is not allowed' },
        { pattern: /\bfs\./, message: 'fs module is not allowed' },
        { pattern: /\bexec\s*\(/, message: 'exec() is not allowed' },
        { pattern: /\bspawn\s*\(/, message: 'spawn() is not allowed' },
        { pattern: /\b__proto__/, message: '__proto__ access is not allowed' },
        { pattern: /\bconstructor\s*\[/, message: 'constructor access is not allowed' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(code)) {
            issues.push(message);
        }
    }

    return issues;
}

/**
 * Factory to create appropriate sandbox based on environment
 */
export function createSandbox(
    environment: 'local' | 'docker' | 'modal' = 'local',
    options: { timeout?: number } = {}
): Sandbox {
    switch (environment) {
        case 'local':
            return new LocalSandbox(options.timeout);

        case 'docker':
            // TODO: Implement DockerSandbox
            // Docker sandbox not yet implemented, falling back to local
            return new LocalSandbox(options.timeout);

        case 'modal':
            // TODO: Implement ModalSandbox
            // Modal sandbox not yet implemented, falling back to local
            return new LocalSandbox(options.timeout);

        default:
            return new LocalSandbox(options.timeout);
    }
}
