/**
 * Unit tests for Telemetry module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    MetricsCollector,
    Tracer,
    ErrorReporter,
    getTelemetry,
    shutdownTelemetry,
    METRICS,
    SPAN_NAMES,
} from '../src/telemetry/index.js';

describe('MetricsCollector', () => {
    let metrics: MetricsCollector;

    beforeEach(() => {
        metrics = new MetricsCollector({ enabled: true });
    });

    describe('increment', () => {
        it('should increment counter', () => {
            metrics.increment('test_counter');
            metrics.increment('test_counter');
            metrics.increment('test_counter', 5);

            const snapshot = metrics.getSnapshot();
            expect(snapshot.counters['test_counter']).toBe(7);
        });

        it('should support labels', () => {
            metrics.increment('api_calls', 1, { provider: 'openai' });
            metrics.increment('api_calls', 1, { provider: 'gemini' });

            const snapshot = metrics.getSnapshot();
            expect(snapshot.counters['api_calls{provider=openai}']).toBe(1);
            expect(snapshot.counters['api_calls{provider=gemini}']).toBe(1);
        });
    });

    describe('gauge', () => {
        it('should set gauge value', () => {
            metrics.gauge('memory_usage', 1024);
            metrics.gauge('memory_usage', 2048);

            const snapshot = metrics.getSnapshot();
            expect(snapshot.gauges['memory_usage']).toBe(2048);
        });
    });

    describe('histogram', () => {
        it('should record histogram values', () => {
            metrics.histogram('response_time', 100);
            metrics.histogram('response_time', 200);
            metrics.histogram('response_time', 150);

            const snapshot = metrics.getSnapshot();
            const stats = snapshot.histograms['response_time'];

            expect(stats.count).toBe(3);
            expect(stats.min).toBe(100);
            expect(stats.max).toBe(200);
            expect(stats.avg).toBe(150);
        });

        it('should calculate percentiles', () => {
            for (let i = 1; i <= 100; i++) {
                metrics.histogram('latency', i);
            }

            const snapshot = metrics.getSnapshot();
            const stats = snapshot.histograms['latency'];

            expect(stats.p50).toBe(50);
            expect(stats.p90).toBe(90);
            expect(stats.p99).toBe(99);
        });
    });

    describe('time', () => {
        it('should time async function', async () => {
            const result = await metrics.time('operation', async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                return 'done';
            });

            expect(result).toBe('done');

            const snapshot = metrics.getSnapshot();
            const stats = snapshot.histograms['operation'];
            expect(stats.count).toBe(1);
            expect(stats.min).toBeGreaterThanOrEqual(50);
        });
    });

    describe('flush', () => {
        it('should clear counters and histograms but keep gauges', () => {
            metrics.increment('counter', 5);
            metrics.gauge('gauge', 100);
            metrics.histogram('hist', 50);

            const snapshot = metrics.flush();

            expect(snapshot.counters['counter']).toBe(5);
            expect(snapshot.gauges['gauge']).toBe(100);

            const afterFlush = metrics.getSnapshot();
            expect(afterFlush.counters['counter']).toBeUndefined();
            expect(afterFlush.gauges['gauge']).toBe(100); // Gauges persist
        });
    });

    describe('disabled mode', () => {
        it('should not collect when disabled', () => {
            const disabled = new MetricsCollector({ enabled: false });
            disabled.increment('counter');
            disabled.gauge('gauge', 100);

            const snapshot = disabled.getSnapshot();
            expect(Object.keys(snapshot.counters).length).toBe(0);
            expect(Object.keys(snapshot.gauges).length).toBe(0);
        });
    });
});

describe('Tracer', () => {
    let tracer: Tracer;

    beforeEach(() => {
        tracer = new Tracer({ name: 'test', enabled: true });
    });

    describe('startSpan', () => {
        it('should create a span with context', () => {
            const span = tracer.startSpan('test_operation');

            expect(span.name).toBe('test_operation');
            expect(span.context.traceId).toBeDefined();
            expect(span.context.spanId).toBeDefined();
            expect(span.isEnded()).toBe(false);
        });

        it('should support attributes', () => {
            const span = tracer.startSpan('operation', {
                'file.path': '/src/index.ts',
                'file.size': 1024,
            });

            const json = span.toJSON();
            expect(json.attributes).toMatchObject({
                'file.path': '/src/index.ts',
                'file.size': 1024,
            });
        });
    });

    describe('Span', () => {
        it('should record events', () => {
            const span = tracer.startSpan('operation');
            span.addEvent('file_read', { path: '/test.ts' });
            span.addEvent('file_parsed');

            const json = span.toJSON();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((json as any).events).toHaveLength(2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((json as any).events[0].name).toBe('file_read');
        });

        it('should record exceptions', () => {
            const span = tracer.startSpan('operation');
            const error = new Error('Test error');
            span.recordException(error);

            const json = span.toJSON();
            expect(json.status).toBe('error');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((json as any).events[0].name).toBe('exception');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((json as any).events[0].attributes?.['exception.message']).toBe('Test error');
        });

        it('should calculate duration', () => {
            const span = tracer.startSpan('operation');

            // Simulate some time passing
            const duration = span.getDuration();
            expect(duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('withSpan', () => {
        it('should execute function within span', async () => {
            const result = await tracer.withSpan('operation', async (span) => {
                span.setAttribute('key', 'value');
                return Promise.resolve(42);
            });

            expect(result).toBe(42);
        });

        it('should capture exceptions', async () => {
            await expect(
                tracer.withSpan('failing_operation', async () => {
                    throw new Error('Test failure');
                })
            ).rejects.toThrow('Test failure');
        });
    });
});

describe('ErrorReporter', () => {
    let reporter: ErrorReporter;
    let capturedReports: unknown[];

    beforeEach(() => {
        capturedReports = [];
        reporter = new ErrorReporter({
            enabled: true,
            handlers: [(report) => capturedReports.push(report)],
        });
    });

    describe('captureException', () => {
        it('should capture and report errors', async () => {
            const error = new Error('Test error');
            const id = await reporter.captureException(error);

            expect(id).toBeDefined();
            expect(capturedReports).toHaveLength(1);

            const report = capturedReports[0] as { error: { message: string } };
            expect(report.error.message).toBe('Test error');
        });

        it('should include context', async () => {
            const error = new Error('Test error');
            await reporter.captureException(error, {
                tags: { component: 'parser' },
                extra: { file: '/test.ts' },
            });

            const report = capturedReports[0] as { context: { tags: Record<string, string> } };
            expect(report.context.tags.component).toBe('parser');
        });
    });

    describe('breadcrumbs', () => {
        it('should track breadcrumbs', async () => {
            reporter.addBreadcrumb({
                type: 'action',
                category: 'user',
                message: 'Clicked button',
            });

            reporter.addBreadcrumb({
                type: 'navigation',
                category: 'route',
                message: 'Navigated to /settings',
            });

            await reporter.captureException(new Error('Crash'));

            const report = capturedReports[0] as { context: { breadcrumbs: unknown[] } };
            expect(report.context.breadcrumbs).toHaveLength(2);
        });
    });

    describe('wrap', () => {
        it('should wrap functions to auto-capture errors', async () => {
            const riskyFn = reporter.wrap(async () => {
                throw new Error('Wrapped error');
            });

            await expect(riskyFn()).rejects.toThrow('Wrapped error');
            expect(capturedReports).toHaveLength(1);
        });
    });
});

describe('Telemetry (unified)', () => {
    afterEach(() => {
        shutdownTelemetry();
    });

    it('should provide unified access to all modules', () => {
        const telemetry = getTelemetry({
            enabled: true,
            serviceName: 'test-service',
        });

        expect(telemetry.metrics).toBeDefined();
        expect(telemetry.tracer).toBeDefined();
        expect(telemetry.errors).toBeDefined();
    });

    it('should execute traced operations', async () => {
        const telemetry = getTelemetry({ enabled: true });

        const result = await telemetry.traced('test_operation', async (span) => {
            span.setAttribute('test', true);
            return 'success';
        });

        expect(result).toBe('success');
    });

    it('should record memory usage', () => {
        const telemetry = getTelemetry({ enabled: true });
        telemetry.recordMemoryUsage();

        const snapshot = telemetry.flush();
        expect(snapshot.gauges[METRICS.MEMORY_HEAP_USED]).toBeGreaterThan(0);
    });
});

describe('Constants', () => {
    it('should export METRICS constants', () => {
        expect(METRICS.API_CALLS_TOTAL).toBe('contextos_api_calls_total');
        expect(METRICS.CONTEXT_BUILD_DURATION_MS).toBe('contextos_context_build_duration_ms');
    });

    it('should export SPAN_NAMES constants', () => {
        expect(SPAN_NAMES.CLI_BUILD).toBe('cli.build');
        expect(SPAN_NAMES.RLM_EXECUTE).toBe('rlm.execute');
    });
});
