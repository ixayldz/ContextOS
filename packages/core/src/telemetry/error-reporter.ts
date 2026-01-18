/**
 * Error Reporter - Production Error Tracking
 * 
 * Provides a unified interface for error reporting that can be
 * integrated with services like Sentry, Rollbar, or custom backends.
 */

import { ContextOSError } from '../errors.js';

export interface ErrorContext {
    /** User-provided tags */
    tags?: Record<string, string>;
    /** Additional data */
    extra?: Record<string, unknown>;
    /** User information (anonymized) */
    user?: {
        id?: string;
        sessionId?: string;
    };
    /** Current operation/span */
    operation?: string;
    /** Breadcrumbs leading to error */
    breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
    type: 'navigation' | 'action' | 'console' | 'http' | 'error';
    category: string;
    message: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}

export interface ErrorReport {
    id: string;
    timestamp: Date;
    error: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
    };
    context: ErrorContext;
    environment: {
        nodeVersion: string;
        platform: string;
        arch: string;
        contextosVersion: string;
    };
}

export type ErrorReportHandler = (report: ErrorReport) => void | Promise<void>;

/**
 * Error Reporter for centralized error tracking
 */
export class ErrorReporter {
    private enabled: boolean;
    private handlers: ErrorReportHandler[] = [];
    private breadcrumbs: Breadcrumb[] = [];
    private maxBreadcrumbs: number = 50;
    private globalTags: Record<string, string> = {};
    private globalExtra: Record<string, unknown> = {};
    private version: string;

    constructor(options: {
        enabled?: boolean;
        version?: string;
        maxBreadcrumbs?: number;
        handlers?: ErrorReportHandler[];
    } = {}) {
        this.enabled = options.enabled ?? (process.env.CONTEXTOS_ERROR_REPORTING !== 'false');
        this.version = options.version || '2.0.0';
        this.maxBreadcrumbs = options.maxBreadcrumbs || 50;

        if (options.handlers) {
            this.handlers = options.handlers;
        }

        // Default console handler in development
        if (process.env.NODE_ENV === 'development') {
            this.addHandler((report) => {
                console.error('[ErrorReporter]', report.error.name, report.error.message);
            });
        }
    }

    /**
     * Add an error report handler
     */
    addHandler(handler: ErrorReportHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Set global tags for all reports
     */
    setTags(tags: Record<string, string>): void {
        Object.assign(this.globalTags, tags);
    }

    /**
     * Set global extra data for all reports
     */
    setExtra(extra: Record<string, unknown>): void {
        Object.assign(this.globalExtra, extra);
    }

    /**
     * Add a breadcrumb
     */
    addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
        this.breadcrumbs.push({
            ...breadcrumb,
            timestamp: new Date(),
        });

        // Keep only recent breadcrumbs
        if (this.breadcrumbs.length > this.maxBreadcrumbs) {
            this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
        }
    }

    /**
     * Capture and report an error
     */
    async captureException(
        error: Error,
        context?: ErrorContext
    ): Promise<string | null> {
        if (!this.enabled) return null;

        const report = this.createReport(error, context);

        // Send to all handlers
        for (const handler of this.handlers) {
            try {
                await handler(report);
            } catch (handlerError) {
                console.error('[ErrorReporter] Handler failed:', handlerError);
            }
        }

        return report.id;
    }

    /**
     * Capture a message as an error
     */
    async captureMessage(
        message: string,
        level: 'info' | 'warning' | 'error' = 'error',
        context?: ErrorContext
    ): Promise<string | null> {
        const error = new Error(message);
        error.name = `Message.${level}`;
        return this.captureException(error, context);
    }

    /**
     * Wrap a function to auto-capture errors
     */
    wrap<T extends (...args: unknown[]) => unknown>(
        fn: T,
        context?: ErrorContext
    ): T {
        const reporter = this;
        return ((...args: unknown[]) => {
            try {
                const result = fn(...args);
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        reporter.captureException(error, context);
                        throw error;
                    });
                }
                return result;
            } catch (error) {
                if (error instanceof Error) {
                    reporter.captureException(error, context);
                }
                throw error;
            }
        }) as T;
    }

    /**
     * Clear breadcrumbs
     */
    clearBreadcrumbs(): void {
        this.breadcrumbs = [];
    }

    /**
     * Get recent reports (for debugging)
     */
    getRecentBreadcrumbs(): Breadcrumb[] {
        return [...this.breadcrumbs];
    }

    private createReport(error: Error, context?: ErrorContext): ErrorReport {
        const isContextOSError = error instanceof ContextOSError;

        return {
            id: this.generateId(),
            timestamp: new Date(),
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: isContextOSError ? (error as ContextOSError).code : undefined,
            },
            context: {
                tags: { ...this.globalTags, ...context?.tags },
                extra: {
                    ...this.globalExtra,
                    ...context?.extra,
                    ...(isContextOSError ? (error as ContextOSError).context : {}),
                },
                user: context?.user,
                operation: context?.operation,
                breadcrumbs: [...this.breadcrumbs, ...(context?.breadcrumbs || [])],
            },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                contextosVersion: this.version,
            },
        };
    }

    private generateId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Sentry-compatible handler (example)
 */
export function createSentryHandler(dsn: string): ErrorReportHandler {
    // This is a placeholder - would need @sentry/node in production
    return async (report) => {
        // In production, this would send to Sentry:
        // Sentry.captureException(report.error, { extra: report.context });

        if (process.env.NODE_ENV === 'development') {
            console.log('[Sentry Mock] Would send to:', dsn);
            console.log('[Sentry Mock] Report:', JSON.stringify(report, null, 2));
        }
    };
}

/**
 * Console handler for development
 */
export function createConsoleHandler(): ErrorReportHandler {
    return (report) => {
        console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ERROR REPORT: ${report.id.padEnd(43)}║
╠══════════════════════════════════════════════════════════════╣
║  ${report.error.name}: ${report.error.message.substring(0, 50).padEnd(50)}║
║  Code: ${(report.error.code || 'N/A').padEnd(53)}║
║  Time: ${report.timestamp.toISOString().padEnd(53)}║
╚══════════════════════════════════════════════════════════════╝
`);
    };
}

/**
 * File handler for logging to disk
 */
export function createFileHandler(logPath: string): ErrorReportHandler {
    return async (report) => {
        const fs = await import('fs/promises');
        const line = JSON.stringify(report) + '\n';
        await fs.appendFile(logPath, line);
    };
}
