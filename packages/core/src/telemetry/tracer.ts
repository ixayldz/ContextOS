/**
 * Tracer - Operation Tracing for ContextOS
 * 
 * Provides distributed tracing capabilities for tracking
 * operations across the system.
 */

export interface SpanContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
}

export interface SpanAttributes {
    [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
    name: string;
    timestamp: Date;
    attributes?: SpanAttributes;
}

export type SpanStatus = 'ok' | 'error' | 'unset';

/**
 * Span represents a single operation within a trace
 */
export class Span {
    readonly context: SpanContext;
    readonly name: string;
    readonly startTime: Date;
    private endTime?: Date;
    private status: SpanStatus = 'unset';
    private statusMessage?: string;
    private attributes: SpanAttributes = {};
    private events: SpanEvent[] = [];
    private children: Span[] = [];

    constructor(
        name: string,
        parentContext?: SpanContext,
        attributes?: SpanAttributes
    ) {
        this.name = name;
        this.startTime = new Date();
        this.context = {
            traceId: parentContext?.traceId || this.generateId(32),
            spanId: this.generateId(16),
            parentSpanId: parentContext?.spanId,
        };
        if (attributes) {
            this.attributes = { ...attributes };
        }
    }

    /**
     * Set an attribute on the span
     */
    setAttribute(key: string, value: string | number | boolean): this {
        this.attributes[key] = value;
        return this;
    }

    /**
     * Set multiple attributes
     */
    setAttributes(attributes: SpanAttributes): this {
        Object.assign(this.attributes, attributes);
        return this;
    }

    /**
     * Add an event to the span
     */
    addEvent(name: string, attributes?: SpanAttributes): this {
        this.events.push({
            name,
            timestamp: new Date(),
            attributes,
        });
        return this;
    }

    /**
     * Set the span status
     */
    setStatus(status: SpanStatus, message?: string): this {
        this.status = status;
        this.statusMessage = message;
        return this;
    }

    /**
     * Record an exception
     */
    recordException(error: Error): this {
        this.addEvent('exception', {
            'exception.type': error.name,
            'exception.message': error.message,
            'exception.stacktrace': error.stack,
        });
        this.setStatus('error', error.message);
        return this;
    }

    /**
     * End the span
     */
    end(): this {
        if (!this.endTime) {
            this.endTime = new Date();
            if (this.status === 'unset') {
                this.status = 'ok';
            }
        }
        return this;
    }

    /**
     * Get span duration in milliseconds
     */
    getDuration(): number {
        const end = this.endTime || new Date();
        return end.getTime() - this.startTime.getTime();
    }

    /**
     * Check if span has ended
     */
    isEnded(): boolean {
        return !!this.endTime;
    }

    /**
     * Create a child span
     */
    startChild(name: string, attributes?: SpanAttributes): Span {
        const child = new Span(name, this.context, attributes);
        this.children.push(child);
        return child;
    }

    /**
     * Convert to JSON for logging/export
     */
    toJSON(): Record<string, unknown> {
        return {
            traceId: this.context.traceId,
            spanId: this.context.spanId,
            parentSpanId: this.context.parentSpanId,
            name: this.name,
            startTime: this.startTime.toISOString(),
            endTime: this.endTime?.toISOString(),
            duration: this.getDuration(),
            status: this.status,
            statusMessage: this.statusMessage,
            attributes: this.attributes,
            events: this.events.map(e => ({
                name: e.name,
                timestamp: e.timestamp.toISOString(),
                attributes: e.attributes,
            })),
            children: this.children.map(c => c.toJSON()),
        };
    }

    private generateId(length: number): string {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }
}

/**
 * Tracer for creating and managing spans
 */
export class Tracer {
    private readonly name: string;
    private readonly version: string;
    private activeSpan: Span | null = null;
    private spans: Span[] = [];
    private enabled: boolean;
    private onSpanEnd?: (span: Span) => void;

    constructor(options: {
        name: string;
        version?: string;
        enabled?: boolean;
        onSpanEnd?: (span: Span) => void;
    }) {
        this.name = options.name;
        this.version = options.version || '1.0.0';
        this.enabled = options.enabled ?? (process.env.CONTEXTOS_TRACING !== 'false');
        this.onSpanEnd = options.onSpanEnd;
    }

    /**
     * Start a new span
     */
    startSpan(name: string, attributes?: SpanAttributes): Span {
        const parentContext = this.activeSpan?.context;
        const span = new Span(name, parentContext, {
            'service.name': this.name,
            'service.version': this.version,
            ...attributes,
        });

        if (this.enabled) {
            this.spans.push(span);
            this.activeSpan = span;
        }

        return span;
    }

    /**
     * End a span and optionally export it
     */
    endSpan(span: Span): void {
        span.end();

        if (this.enabled && this.onSpanEnd) {
            this.onSpanEnd(span);
        }

        // Reset active span to parent if exists
        if (this.activeSpan === span && span.context.parentSpanId) {
            this.activeSpan = this.spans.find(
                s => s.context.spanId === span.context.parentSpanId
            ) || null;
        }
    }

    /**
     * Execute a function within a span
     */
    async withSpan<T>(
        name: string,
        fn: (span: Span) => Promise<T>,
        attributes?: SpanAttributes
    ): Promise<T> {
        const span = this.startSpan(name, attributes);
        try {
            const result = await fn(span);
            span.setStatus('ok');
            return result;
        } catch (error) {
            if (error instanceof Error) {
                span.recordException(error);
            }
            throw error;
        } finally {
            this.endSpan(span);
        }
    }

    /**
     * Execute a sync function within a span
     */
    withSpanSync<T>(
        name: string,
        fn: (span: Span) => T,
        attributes?: SpanAttributes
    ): T {
        const span = this.startSpan(name, attributes);
        try {
            const result = fn(span);
            span.setStatus('ok');
            return result;
        } catch (error) {
            if (error instanceof Error) {
                span.recordException(error);
            }
            throw error;
        } finally {
            this.endSpan(span);
        }
    }

    /**
     * Get all recorded spans
     */
    getSpans(): Span[] {
        return [...this.spans];
    }

    /**
     * Clear recorded spans
     */
    clear(): void {
        this.spans = [];
        this.activeSpan = null;
    }

    /**
     * Get active span
     */
    getActiveSpan(): Span | null {
        return this.activeSpan;
    }
}

// Pre-defined span names for ContextOS operations
export const SPAN_NAMES = {
    // CLI operations
    CLI_INIT: 'cli.init',
    CLI_INDEX: 'cli.index',
    CLI_BUILD: 'cli.build',
    CLI_ANALYZE: 'cli.analyze',

    // Core operations
    PARSE_FILE: 'core.parse_file',
    BUILD_GRAPH: 'core.build_graph',
    COMPUTE_EMBEDDINGS: 'core.compute_embeddings',
    RANK_FILES: 'core.rank_files',
    BUILD_CONTEXT: 'core.build_context',

    // RLM operations
    RLM_EXECUTE: 'rlm.execute',
    RLM_SPAWN_AGENT: 'rlm.spawn_agent',
    RLM_SANDBOX_RUN: 'rlm.sandbox_run',

    // API operations
    API_COMPLETION: 'api.completion',
    API_EMBEDDING: 'api.embedding',

    // MCP operations
    MCP_TOOL_CALL: 'mcp.tool_call',
    MCP_RESOURCE_READ: 'mcp.resource_read',
} as const;
