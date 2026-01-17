/**
 * Enhanced Error Types for ContextOS
 * Provides structured, actionable error messages
 */

export enum ErrorCode {
    // Configuration errors (1xxx)
    CONFIG_NOT_FOUND = 'E1001',
    CONFIG_INVALID = 'E1002',
    CONFIG_SCHEMA_MISMATCH = 'E1003',

    // Index errors (2xxx)
    INDEX_NOT_FOUND = 'E2001',
    INDEX_CORRUPTED = 'E2002',
    INDEX_OUTDATED = 'E2003',

    // API errors (3xxx)
    API_KEY_MISSING = 'E3001',
    API_RATE_LIMITED = 'E3002',
    API_TIMEOUT = 'E3003',
    API_INVALID_RESPONSE = 'E3004',

    // RLM errors (4xxx)
    RLM_DEPTH_EXCEEDED = 'E4001',
    RLM_BUDGET_EXCEEDED = 'E4002',
    RLM_TIMEOUT = 'E4003',
    RLM_LOOP_DETECTED = 'E4004',
    RLM_SANDBOX_ERROR = 'E4005',
    RLM_WATCHDOG_TERMINATED = 'E4006',

    // File system errors (5xxx)
    FILE_NOT_FOUND = 'E5001',
    FILE_READ_ERROR = 'E5002',
    FILE_WRITE_ERROR = 'E5003',

    // General errors (9xxx)
    UNKNOWN = 'E9999',
}

export interface ErrorSuggestion {
    action: string;
    command?: string;
    link?: string;
}

export interface ContextOSErrorOptions {
    code: ErrorCode;
    message: string;
    cause?: Error;
    context?: Record<string, unknown>;
    suggestions?: ErrorSuggestion[];
}

/**
 * Base error class for ContextOS
 */
export class ContextOSError extends Error {
    readonly code: ErrorCode;
    readonly context: Record<string, unknown>;
    readonly suggestions: ErrorSuggestion[];
    readonly timestamp: Date;

    constructor(options: ContextOSErrorOptions) {
        super(options.message);
        this.name = 'ContextOSError';
        this.code = options.code;
        this.context = options.context || {};
        this.suggestions = options.suggestions || [];
        this.timestamp = new Date();

        if (options.cause) {
            this.cause = options.cause;
        }

        // Capture stack trace
        Error.captureStackTrace?.(this, this.constructor);
    }

    /**
     * Get formatted error message for CLI display
     */
    toCliString(): string {
        const lines: string[] = [
            ``,
            `❌ Error [${this.code}]: ${this.message}`,
        ];

        if (Object.keys(this.context).length > 0) {
            lines.push(`   Context: ${JSON.stringify(this.context)}`);
        }

        if (this.suggestions.length > 0) {
            lines.push(``, `💡 Suggestions:`);
            for (const suggestion of this.suggestions) {
                lines.push(`   • ${suggestion.action}`);
                if (suggestion.command) {
                    lines.push(`     Command: ${suggestion.command}`);
                }
                if (suggestion.link) {
                    lines.push(`     See: ${suggestion.link}`);
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * Get JSON representation for logging
     */
    toJSON(): Record<string, unknown> {
        return {
            code: this.code,
            message: this.message,
            context: this.context,
            suggestions: this.suggestions,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
        };
    }
}

// Error factory functions for common errors
export const Errors = {
    configNotFound: (path: string) => new ContextOSError({
        code: ErrorCode.CONFIG_NOT_FOUND,
        message: `Configuration file not found: ${path}`,
        context: { path },
        suggestions: [
            { action: 'Initialize ContextOS in this directory', command: 'ctx init' },
            { action: 'Check if you are in the correct directory' },
        ],
    }),

    apiKeyMissing: (provider: string) => new ContextOSError({
        code: ErrorCode.API_KEY_MISSING,
        message: `API key not configured for ${provider}`,
        context: { provider },
        suggestions: [
            {
                action: `Set the ${provider.toUpperCase()}_API_KEY environment variable`,
                command: `export ${provider.toUpperCase()}_API_KEY="your-key-here"`,
            },
            {
                action: 'Get an API key from the provider',
                link: provider === 'gemini'
                    ? 'https://makersuite.google.com/app/apikey'
                    : provider === 'openai'
                        ? 'https://platform.openai.com/api-keys'
                        : 'https://console.anthropic.com/account/keys',
            },
        ],
    }),

    rlmDepthExceeded: (depth: number, maxDepth: number) => new ContextOSError({
        code: ErrorCode.RLM_DEPTH_EXCEEDED,
        message: `Maximum recursion depth exceeded: ${depth} > ${maxDepth}`,
        context: { depth, maxDepth },
        suggestions: [
            { action: 'Increase max depth if needed', command: 'ctx analyze --depth 5' },
            { action: 'Simplify your goal into smaller tasks' },
        ],
    }),

    rlmBudgetExceeded: (used: number, budget: number) => new ContextOSError({
        code: ErrorCode.RLM_BUDGET_EXCEEDED,
        message: `Token budget exceeded: ${used} > ${budget}`,
        context: { used, budget },
        suggestions: [
            { action: 'Increase token budget', command: 'ctx analyze --budget 100000' },
            { action: 'Reduce context scope with more specific goal' },
        ],
    }),

    rlmWatchdogTerminated: (reason: string) => new ContextOSError({
        code: ErrorCode.RLM_WATCHDOG_TERMINATED,
        message: `Process terminated by watchdog: ${reason}`,
        context: { reason },
        suggestions: [
            { action: 'Check if your goal is too broad' },
            { action: 'Look for circular dependencies in your code' },
            { action: 'Try with a smaller codebase subset' },
        ],
    }),

    indexNotFound: () => new ContextOSError({
        code: ErrorCode.INDEX_NOT_FOUND,
        message: 'Project index not found',
        suggestions: [
            { action: 'Build the index first', command: 'ctx index' },
        ],
    }),

    fileNotFound: (path: string) => new ContextOSError({
        code: ErrorCode.FILE_NOT_FOUND,
        message: `File not found: ${path}`,
        context: { path },
        suggestions: [
            { action: 'Check if the file path is correct' },
            { action: 'Use absolute path if relative path fails' },
        ],
    }),
};
