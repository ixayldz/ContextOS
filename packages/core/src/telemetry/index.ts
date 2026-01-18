/**
 * Telemetry Module - Unified Observability for ContextOS
 * 
 * Provides metrics, tracing, and error reporting capabilities.
 * All telemetry is opt-in and respects user privacy.
 * 
 * @example
 * ```typescript
 * import { getTelemetry } from '@contextos/core';
 * 
 * const telemetry = getTelemetry();
 * 
 * // Metrics
 * telemetry.metrics.increment('api_calls', 1, { provider: 'openai' });
 * telemetry.metrics.histogram('response_time', 150);
 * 
 * // Tracing
 * await telemetry.tracer.withSpan('build_context', async (span) => {
 *     span.setAttribute('file_count', 42);
 *     // ... do work
 * });
 * 
 * // Error reporting
 * try {
 *     // ... risky operation
 * } catch (error) {
 *     telemetry.errors.captureException(error);
 * }
 * ```
 */

export {
    MetricsCollector,
    METRICS,
    type MetricSnapshot,
    type HistogramStats,
} from './metrics.js';

export {
    Tracer,
    Span,
    SPAN_NAMES,
    type SpanContext,
    type SpanAttributes,
    type SpanEvent,
    type SpanStatus,
} from './tracer.js';

export {
    ErrorReporter,
    createSentryHandler,
    createConsoleHandler,
    createFileHandler,
    type ErrorContext,
    type ErrorReport,
    type ErrorReportHandler,
    type Breadcrumb,
} from './error-reporter.js';

import { MetricsCollector, METRICS } from './metrics.js';
import { Tracer } from './tracer.js';
import { ErrorReporter, createConsoleHandler } from './error-reporter.js';

/**
 * Unified telemetry configuration
 */
export interface TelemetryConfig {
    /** Enable/disable all telemetry */
    enabled?: boolean;
    /** Service name for tracing */
    serviceName?: string;
    /** Service version */
    serviceVersion?: string;
    /** Metrics flush interval in ms (0 to disable auto-flush) */
    metricsFlushIntervalMs?: number;
    /** Error reporter handlers */
    errorHandlers?: ((report: import('./error-reporter.js').ErrorReport) => void)[];
    /** Custom metrics handler */
    onMetricsFlush?: (snapshot: import('./metrics.js').MetricSnapshot) => void;
    /** Custom span handler */
    onSpanEnd?: (span: import('./tracer.js').Span) => void;
}

/**
 * Unified telemetry instance
 */
export class Telemetry {
    readonly metrics: MetricsCollector;
    readonly tracer: Tracer;
    readonly errors: ErrorReporter;
    private readonly config: TelemetryConfig;

    constructor(config: TelemetryConfig = {}) {
        this.config = {
            enabled: true,
            serviceName: 'contextos',
            serviceVersion: '2.0.0',
            metricsFlushIntervalMs: 60000, // 1 minute
            ...config,
        };

        // Initialize metrics
        this.metrics = new MetricsCollector({
            enabled: this.config.enabled,
            flushIntervalMs: this.config.metricsFlushIntervalMs,
            onFlush: this.config.onMetricsFlush,
        });

        // Initialize tracer
        this.tracer = new Tracer({
            name: this.config.serviceName!,
            version: this.config.serviceVersion,
            enabled: this.config.enabled,
            onSpanEnd: this.config.onSpanEnd,
        });

        // Initialize error reporter
        this.errors = new ErrorReporter({
            enabled: this.config.enabled,
            version: this.config.serviceVersion,
            handlers: this.config.errorHandlers || [createConsoleHandler()],
        });

        // Set up process-level error handling
        if (this.config.enabled) {
            this.setupGlobalHandlers();
        }
    }

    /**
     * Execute an operation with full telemetry
     */
    async traced<T>(
        name: string,
        operation: (span: import('./tracer.js').Span) => Promise<T>,
        options?: {
            attributes?: Record<string, string | number | boolean>;
            errorContext?: import('./error-reporter.js').ErrorContext;
        }
    ): Promise<T> {
        const span = this.tracer.startSpan(name, options?.attributes);
        const startTime = performance.now();

        try {
            const result = await operation(span);
            span.setStatus('ok');
            this.metrics.histogram(`${name}_duration_ms`, performance.now() - startTime);
            this.metrics.increment(`${name}_success`);
            return result;
        } catch (error) {
            if (error instanceof Error) {
                span.recordException(error);
                await this.errors.captureException(error, options?.errorContext);
            }
            this.metrics.increment(`${name}_error`);
            throw error;
        } finally {
            this.tracer.endSpan(span);
        }
    }

    /**
     * Record memory usage
     */
    recordMemoryUsage(): void {
        const usage = process.memoryUsage();
        this.metrics.gauge(METRICS.MEMORY_HEAP_USED, usage.heapUsed);
        this.metrics.gauge(METRICS.MEMORY_HEAP_TOTAL, usage.heapTotal);
    }

    /**
     * Flush all metrics
     */
    flush(): import('./metrics.js').MetricSnapshot {
        return this.metrics.flush();
    }

    /**
     * Shutdown telemetry
     */
    shutdown(): void {
        this.metrics.stop();
        this.tracer.clear();
    }

    private setupGlobalHandlers(): void {
        // Catch unhandled promise rejections
        process.on('unhandledRejection', (reason) => {
            if (reason instanceof Error) {
                this.errors.captureException(reason, {
                    tags: { type: 'unhandledRejection' },
                });
            }
        });

        // Catch uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.errors.captureException(error, {
                tags: { type: 'uncaughtException' },
            });
        });
    }
}

// Global telemetry instance
let globalTelemetry: Telemetry | null = null;

/**
 * Get or create the global telemetry instance
 */
export function getTelemetry(config?: TelemetryConfig): Telemetry {
    if (!globalTelemetry) {
        globalTelemetry = new Telemetry(config);
    }
    return globalTelemetry;
}

/**
 * Initialize telemetry with custom config
 */
export function initTelemetry(config: TelemetryConfig): Telemetry {
    if (globalTelemetry) {
        globalTelemetry.shutdown();
    }
    globalTelemetry = new Telemetry(config);
    return globalTelemetry;
}

/**
 * Shutdown global telemetry
 */
export function shutdownTelemetry(): void {
    if (globalTelemetry) {
        globalTelemetry.shutdown();
        globalTelemetry = null;
    }
}
