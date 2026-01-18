/**
 * Telemetry - Performance Metrics Collection
 * 
 * Collects and reports performance metrics for ContextOS operations.
 * Designed to be lightweight and opt-in.
 */

export interface MetricValue {
    value: number;
    timestamp: Date;
    labels?: Record<string, string>;
}

export interface MetricDefinition {
    name: string;
    description: string;
    unit: 'ms' | 'bytes' | 'count' | 'percent';
    type: 'counter' | 'gauge' | 'histogram';
}

/**
 * Histogram bucket boundaries for timing metrics
 */
const TIMING_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Metrics collector for performance monitoring
 */
export class MetricsCollector {
    private counters: Map<string, number> = new Map();
    private gauges: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();
    private enabled: boolean;
    private flushInterval: NodeJS.Timeout | null = null;
    private onFlush?: (metrics: MetricSnapshot) => void;

    constructor(options: { enabled?: boolean; flushIntervalMs?: number; onFlush?: (metrics: MetricSnapshot) => void } = {}) {
        this.enabled = options.enabled ?? (process.env.CONTEXTOS_TELEMETRY !== 'false');
        this.onFlush = options.onFlush;

        if (options.flushIntervalMs && options.flushIntervalMs > 0) {
            this.flushInterval = setInterval(() => {
                this.flush();
            }, options.flushIntervalMs);
        }
    }

    /**
     * Increment a counter
     */
    increment(name: string, value: number = 1, labels?: Record<string, string>): void {
        if (!this.enabled) return;

        const key = this.makeKey(name, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
    }

    /**
     * Set a gauge value
     */
    gauge(name: string, value: number, labels?: Record<string, string>): void {
        if (!this.enabled) return;

        const key = this.makeKey(name, labels);
        this.gauges.set(key, value);
    }

    /**
     * Record a histogram value (typically timing)
     */
    histogram(name: string, value: number, labels?: Record<string, string>): void {
        if (!this.enabled) return;

        const key = this.makeKey(name, labels);
        const values = this.histograms.get(key) || [];
        values.push(value);
        this.histograms.set(key, values);
    }

    /**
     * Time a function execution
     */
    async time<T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
        const start = performance.now();
        try {
            return await fn();
        } finally {
            const duration = performance.now() - start;
            this.histogram(name, duration, labels);
        }
    }

    /**
     * Time a synchronous function execution
     */
    timeSync<T>(name: string, fn: () => T, labels?: Record<string, string>): T {
        const start = performance.now();
        try {
            return fn();
        } finally {
            const duration = performance.now() - start;
            this.histogram(name, duration, labels);
        }
    }

    /**
     * Get current snapshot of all metrics
     */
    getSnapshot(): MetricSnapshot {
        const snapshot: MetricSnapshot = {
            timestamp: new Date(),
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: {},
        };

        for (const [key, values] of this.histograms) {
            if (values.length === 0) continue;

            const sorted = [...values].sort((a, b) => a - b);
            snapshot.histograms[key] = {
                count: values.length,
                sum: values.reduce((a, b) => a + b, 0),
                min: sorted[0],
                max: sorted[sorted.length - 1],
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                p50: this.percentile(sorted, 50),
                p90: this.percentile(sorted, 90),
                p99: this.percentile(sorted, 99),
            };
        }

        return snapshot;
    }

    /**
     * Flush metrics and reset
     */
    flush(): MetricSnapshot {
        const snapshot = this.getSnapshot();

        if (this.onFlush) {
            this.onFlush(snapshot);
        }

        this.counters.clear();
        // Keep gauges as they represent current state
        this.histograms.clear();

        return snapshot;
    }

    /**
     * Stop the flush interval
     */
    stop(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    private makeKey(name: string, labels?: Record<string, string>): string {
        if (!labels || Object.keys(labels).length === 0) {
            return name;
        }
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${labelStr}}`;
    }

    private percentile(sorted: number[], p: number): number {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
}

export interface MetricSnapshot {
    timestamp: Date;
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, HistogramStats>;
}

export interface HistogramStats {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p99: number;
}

// Predefined metrics for ContextOS
export const METRICS = {
    // Indexing
    INDEX_FILES_TOTAL: 'contextos_index_files_total',
    INDEX_DURATION_MS: 'contextos_index_duration_ms',
    INDEX_ERRORS: 'contextos_index_errors_total',

    // Context building
    CONTEXT_BUILD_DURATION_MS: 'contextos_context_build_duration_ms',
    CONTEXT_FILES_INCLUDED: 'contextos_context_files_included',
    CONTEXT_TOKENS: 'contextos_context_tokens',

    // API calls
    API_CALLS_TOTAL: 'contextos_api_calls_total',
    API_DURATION_MS: 'contextos_api_duration_ms',
    API_ERRORS: 'contextos_api_errors_total',
    API_TOKENS_USED: 'contextos_api_tokens_used',

    // RLM
    RLM_EXECUTIONS: 'contextos_rlm_executions_total',
    RLM_DURATION_MS: 'contextos_rlm_duration_ms',
    RLM_DEPTH: 'contextos_rlm_depth',
    RLM_WATCHDOG_TERMINATIONS: 'contextos_rlm_watchdog_terminations',

    // Cache
    CACHE_HITS: 'contextos_cache_hits_total',
    CACHE_MISSES: 'contextos_cache_misses_total',
    CACHE_SIZE_BYTES: 'contextos_cache_size_bytes',

    // Memory
    MEMORY_HEAP_USED: 'contextos_memory_heap_used_bytes',
    MEMORY_HEAP_TOTAL: 'contextos_memory_heap_total_bytes',
} as const;
