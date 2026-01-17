/**
 * Tests for Watchdog, Errors, and Logger modules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    Watchdog,
    createWatchdog,
} from '../src/rlm/watchdog.js';
import {
    ContextOSError,
    ErrorCode,
    Errors,
} from '../src/errors.js';
import {
    Logger,
    LogLevel,
    createLogger,
    getLogger,
} from '../src/logger.js';

describe('Watchdog', () => {
    let watchdog: Watchdog;

    beforeEach(() => {
        watchdog = createWatchdog({
            maxFileReads: 3,
            maxStepsWithoutProgress: 5,
            timeoutMs: 5000,
            checkIntervalMs: 100,
        });
    });

    describe('file read tracking', () => {
        it('should allow reads under limit', () => {
            expect(watchdog.recordFileRead('file1.ts')).toBe(true);
            expect(watchdog.recordFileRead('file1.ts')).toBe(true);
            expect(watchdog.recordFileRead('file1.ts')).toBe(true);
        });

        it('should terminate on excessive reads', () => {
            watchdog.recordFileRead('file1.ts');
            watchdog.recordFileRead('file1.ts');
            watchdog.recordFileRead('file1.ts');
            const result = watchdog.recordFileRead('file1.ts');

            expect(result).toBe(false);
            expect(watchdog.isTerminated()).toBe(true);
            expect(watchdog.getTerminationReason()).toContain('file1.ts');
        });
    });

    describe('step tracking', () => {
        it('should track progress', () => {
            expect(watchdog.recordStep(true)).toBe(true);
            expect(watchdog.recordStep(true)).toBe(true);
        });

        it('should terminate on no progress', () => {
            for (let i = 0; i < 5; i++) {
                watchdog.recordStep(false);
            }
            const result = watchdog.recordStep(false);

            expect(result).toBe(false);
            expect(watchdog.isTerminated()).toBe(true);
        });
    });

    describe('check', () => {
        it('should return healthy status', () => {
            const report = watchdog.check();

            expect(report.healthy).toBe(true);
            expect(report.warnings).toHaveLength(0);
        });

        it('should warn on approaching limits', () => {
            for (let i = 0; i < 3; i++) {
                watchdog.recordFileRead('test.ts');
            }

            const report = watchdog.check();
            expect(report.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('reset', () => {
        it('should reset state', () => {
            watchdog.recordFileRead('file.ts');
            watchdog.recordStep(true);
            watchdog.reset();

            const report = watchdog.check();
            expect(report.metrics.totalSteps).toBe(0);
            expect(report.metrics.uniqueFilesAccessed).toBe(0);
        });
    });
});

describe('ContextOSError', () => {
    describe('construction', () => {
        it('should create error with code and message', () => {
            const error = new ContextOSError({
                code: ErrorCode.CONFIG_NOT_FOUND,
                message: 'Config file not found',
            });

            expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
            expect(error.message).toBe('Config file not found');
            expect(error.name).toBe('ContextOSError');
        });

        it('should include context and suggestions', () => {
            const error = new ContextOSError({
                code: ErrorCode.API_KEY_MISSING,
                message: 'API key missing',
                context: { provider: 'openai' },
                suggestions: [{ action: 'Set API key' }],
            });

            expect(error.context.provider).toBe('openai');
            expect(error.suggestions).toHaveLength(1);
        });
    });

    describe('toCliString', () => {
        it('should format error for CLI', () => {
            const error = new ContextOSError({
                code: ErrorCode.FILE_NOT_FOUND,
                message: 'File not found: test.ts',
                suggestions: [
                    { action: 'Check path', command: 'ls -la' },
                ],
            });

            const output = error.toCliString();
            expect(output).toContain('E5001');
            expect(output).toContain('File not found');
            expect(output).toContain('Check path');
            expect(output).toContain('ls -la');
        });
    });

    describe('toJSON', () => {
        it('should serialize to JSON', () => {
            const error = new ContextOSError({
                code: ErrorCode.RLM_TIMEOUT,
                message: 'Timeout',
            });

            const json = error.toJSON();
            expect(json.code).toBe(ErrorCode.RLM_TIMEOUT);
            expect(json.message).toBe('Timeout');
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('factory functions', () => {
        it('should create configNotFound error', () => {
            const error = Errors.configNotFound('/path/to/config');
            expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
            expect(error.suggestions.length).toBeGreaterThan(0);
        });

        it('should create apiKeyMissing error', () => {
            const error = Errors.apiKeyMissing('gemini');
            expect(error.code).toBe(ErrorCode.API_KEY_MISSING);
            expect(error.context.provider).toBe('gemini');
        });

        it('should create rlmDepthExceeded error', () => {
            const error = Errors.rlmDepthExceeded(5, 3);
            expect(error.code).toBe(ErrorCode.RLM_DEPTH_EXCEEDED);
        });
    });
});

describe('Logger', () => {
    let logger: Logger;

    beforeEach(() => {
        logger = createLogger({ level: LogLevel.DEBUG, colors: false });
    });

    describe('logging', () => {
        it('should log at different levels', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            logger.debug('Debug message');
            logger.info('Info message');

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should respect log level', () => {
            const silentLogger = createLogger({ level: LogLevel.ERROR });
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            silentLogger.debug('Should not appear');
            silentLogger.info('Should not appear');

            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('child logger', () => {
        it('should create child with module prefix', () => {
            const child = logger.child('auth');
            expect(child).toBeInstanceOf(Logger);
        });
    });

    describe('timers', () => {
        it('should track time', async () => {
            logger.time('test');
            await new Promise(r => setTimeout(r, 10));
            const duration = logger.timeEnd('test');

            expect(duration).toBeGreaterThanOrEqual(10);
        });
    });

    describe('getEntries', () => {
        it('should return log entries', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            logger.info('Test 1');
            logger.info('Test 2');

            const entries = logger.getEntries();
            expect(entries).toHaveLength(2);

            consoleSpy.mockRestore();
        });
    });

    describe('global logger', () => {
        it('should provide singleton', () => {
            const logger1 = getLogger();
            const logger2 = getLogger();
            expect(logger1).toBe(logger2);
        });
    });
});
