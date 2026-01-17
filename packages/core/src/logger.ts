/**
 * Logger - Structured Logging for ContextOS
 * Provides consistent, configurable logging across all modules
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4,
}

export interface LogEntry {
    level: LogLevel;
    timestamp: Date;
    module: string;
    message: string;
    data?: Record<string, unknown>;
    duration?: number;
}

export interface LoggerConfig {
    level: LogLevel;
    json: boolean;          // Output as JSON
    timestamps: boolean;    // Include timestamps
    colors: boolean;        // Use ANSI colors
    module?: string;        // Module name prefix
}

const DEFAULT_CONFIG: LoggerConfig = {
    level: LogLevel.INFO,
    json: false,
    timestamps: true,
    colors: true,
};

const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

const LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.SILENT]: 'SILENT',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: COLORS.gray,
    [LogLevel.INFO]: COLORS.blue,
    [LogLevel.WARN]: COLORS.yellow,
    [LogLevel.ERROR]: COLORS.red,
    [LogLevel.SILENT]: COLORS.reset,
};

/**
 * Logger class for structured logging
 */
export class Logger {
    private config: LoggerConfig;
    private entries: LogEntry[] = [];
    private timers: Map<string, number> = new Map();

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Create a child logger with module name
     */
    child(module: string): Logger {
        return new Logger({
            ...this.config,
            module: this.config.module
                ? `${this.config.module}:${module}`
                : module,
        });
    }

    debug(message: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    info(message: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, message, data);
    }

    warn(message: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.WARN, message, data);
    }

    error(message: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.ERROR, message, data);
    }

    /**
     * Start a timer
     */
    time(label: string): void {
        this.timers.set(label, Date.now());
    }

    /**
     * End a timer and log duration
     */
    timeEnd(label: string, message?: string): number {
        const start = this.timers.get(label);
        if (!start) {
            this.warn(`Timer "${label}" not found`);
            return 0;
        }

        const duration = Date.now() - start;
        this.timers.delete(label);

        const msg = message || `${label} completed`;
        this.log(LogLevel.DEBUG, msg, { duration: `${duration}ms` });

        return duration;
    }

    /**
     * Log with level
     */
    log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
        if (level < this.config.level) return;

        const entry: LogEntry = {
            level,
            timestamp: new Date(),
            module: this.config.module || 'app',
            message,
            data,
        };

        this.entries.push(entry);
        this.output(entry);
    }

    /**
     * Get all log entries
     */
    getEntries(): LogEntry[] {
        return [...this.entries];
    }

    /**
     * Clear log entries
     */
    clear(): void {
        this.entries = [];
    }

    /**
     * Set log level
     */
    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    // Private methods
    private output(entry: LogEntry): void {
        if (this.config.json) {
            console.log(JSON.stringify({
                level: LEVEL_NAMES[entry.level],
                timestamp: entry.timestamp.toISOString(),
                module: entry.module,
                message: entry.message,
                ...entry.data,
            }));
            return;
        }

        const parts: string[] = [];

        if (this.config.timestamps) {
            const time = entry.timestamp.toISOString().substring(11, 19);
            parts.push(this.color(time, COLORS.dim));
        }

        const levelName = LEVEL_NAMES[entry.level].padEnd(5);
        parts.push(this.color(levelName, LEVEL_COLORS[entry.level]));

        if (entry.module) {
            parts.push(this.color(`[${entry.module}]`, COLORS.cyan));
        }

        parts.push(entry.message);

        if (entry.data && Object.keys(entry.data).length > 0) {
            const dataStr = Object.entries(entry.data)
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(' ');
            parts.push(this.color(dataStr, COLORS.dim));
        }

        const output = parts.join(' ');

        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(output);
                break;
            case LogLevel.WARN:
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }

    private color(text: string, color: string): string {
        if (!this.config.colors) return text;
        return `${color}${text}${COLORS.reset}`;
    }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function getLogger(): Logger {
    if (!globalLogger) {
        globalLogger = new Logger();
    }
    return globalLogger;
}

export function createLogger(config?: Partial<LoggerConfig>): Logger {
    return new Logger(config);
}

export function setGlobalLogger(logger: Logger): void {
    globalLogger = logger;
}
