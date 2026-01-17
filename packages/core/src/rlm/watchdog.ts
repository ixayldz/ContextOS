/**
 * Watchdog - Process Safety Mechanism
 * 
 * Implements the expert recommendation for aggressive circuit breaker:
 * - Monitors repeated file access
 * - Detects stuck loops
 * - Enforces time limits
 * - Kills zombie processes
 */

export interface WatchdogConfig {
    maxFileReads: number;          // Max times same file can be read
    maxStepsWithoutProgress: number; // Max steps without new output
    timeoutMs: number;             // Total execution timeout
    checkIntervalMs: number;       // How often to check
}

export interface WatchdogState {
    fileReadCounts: Map<string, number>;
    stepCount: number;
    lastProgressStep: number;
    startTime: number;
    outputLength: number;
    terminated: boolean;
    terminationReason?: string;
}

export interface WatchdogReport {
    healthy: boolean;
    warnings: string[];
    metrics: {
        elapsedMs: number;
        totalSteps: number;
        uniqueFilesAccessed: number;
        maxFileReads: number;
        stepsWithoutProgress: number;
    };
}

const DEFAULT_CONFIG: WatchdogConfig = {
    maxFileReads: 5,
    maxStepsWithoutProgress: 10,
    timeoutMs: 300000, // 5 minutes
    checkIntervalMs: 1000,
};

/**
 * Watchdog monitors long-running processes and terminates them if stuck
 */
export class Watchdog {
    private config: WatchdogConfig;
    private state: WatchdogState;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private onTerminate: (() => void) | null = null;

    constructor(config: Partial<WatchdogConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = this.createInitialState();
    }

    /**
     * Start watching
     */
    start(onTerminate?: () => void): void {
        this.state = this.createInitialState();
        this.onTerminate = onTerminate || null;

        this.intervalId = setInterval(() => {
            this.check();
        }, this.config.checkIntervalMs);
    }

    /**
     * Stop watching
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Record a file read
     */
    recordFileRead(path: string): boolean {
        const count = (this.state.fileReadCounts.get(path) || 0) + 1;
        this.state.fileReadCounts.set(path, count);

        if (count > this.config.maxFileReads) {
            this.terminate(`File "${path}" read ${count} times (limit: ${this.config.maxFileReads})`);
            return false;
        }

        return true;
    }

    /**
     * Record a step (iteration)
     */
    recordStep(hasNewOutput: boolean = false): boolean {
        this.state.stepCount++;

        if (hasNewOutput) {
            this.state.lastProgressStep = this.state.stepCount;
        }

        const stepsWithoutProgress = this.state.stepCount - this.state.lastProgressStep;

        if (stepsWithoutProgress > this.config.maxStepsWithoutProgress) {
            this.terminate(`No progress for ${stepsWithoutProgress} steps (limit: ${this.config.maxStepsWithoutProgress})`);
            return false;
        }

        return true;
    }

    /**
     * Record output (to track progress)
     */
    recordOutput(length: number): void {
        if (length > this.state.outputLength) {
            this.state.outputLength = length;
            this.state.lastProgressStep = this.state.stepCount;
        }
    }

    /**
     * Check for timeout and other conditions
     */
    check(): WatchdogReport {
        const elapsed = Date.now() - this.state.startTime;

        if (elapsed > this.config.timeoutMs) {
            this.terminate(`Execution timeout (${this.config.timeoutMs}ms)`);
        }

        const warnings: string[] = [];

        // Check for high file read counts
        for (const [path, count] of this.state.fileReadCounts) {
            if (count >= this.config.maxFileReads * 0.8) {
                warnings.push(`File "${path}" read ${count}/${this.config.maxFileReads} times`);
            }
        }

        // Check for stagnation
        const stepsWithoutProgress = this.state.stepCount - this.state.lastProgressStep;
        if (stepsWithoutProgress >= this.config.maxStepsWithoutProgress * 0.7) {
            warnings.push(`No progress for ${stepsWithoutProgress} steps`);
        }

        // Check time
        if (elapsed >= this.config.timeoutMs * 0.8) {
            warnings.push(`Approaching timeout: ${Math.round(elapsed / 1000)}s / ${this.config.timeoutMs / 1000}s`);
        }

        let maxFileReads = 0;
        for (const count of this.state.fileReadCounts.values()) {
            maxFileReads = Math.max(maxFileReads, count);
        }

        return {
            healthy: !this.state.terminated,
            warnings,
            metrics: {
                elapsedMs: elapsed,
                totalSteps: this.state.stepCount,
                uniqueFilesAccessed: this.state.fileReadCounts.size,
                maxFileReads,
                stepsWithoutProgress: this.state.stepCount - this.state.lastProgressStep,
            },
        };
    }

    /**
     * Check if terminated
     */
    isTerminated(): boolean {
        return this.state.terminated;
    }

    /**
     * Get termination reason
     */
    getTerminationReason(): string | undefined {
        return this.state.terminationReason;
    }

    /**
     * Reset the watchdog
     */
    reset(): void {
        this.state = this.createInitialState();
    }

    // Private methods
    private createInitialState(): WatchdogState {
        return {
            fileReadCounts: new Map(),
            stepCount: 0,
            lastProgressStep: 0,
            startTime: Date.now(),
            outputLength: 0,
            terminated: false,
        };
    }

    private terminate(reason: string): void {
        if (this.state.terminated) return;

        this.state.terminated = true;
        this.state.terminationReason = reason;
        this.stop();

        if (this.onTerminate) {
            this.onTerminate();
        }
    }
}

/**
 * Factory function
 */
export function createWatchdog(config?: Partial<WatchdogConfig>): Watchdog {
    return new Watchdog(config);
}
