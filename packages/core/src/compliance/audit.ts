/**
 * Audit Logging Module
 * Comprehensive audit trail for compliance (SOC2, GDPR, etc.)
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

export type AuditAction =
    | 'context.build'
    | 'context.copy'
    | 'config.read'
    | 'config.write'
    | 'rules.add'
    | 'rules.remove'
    | 'sync.push'
    | 'sync.pull'
    | 'user.login'
    | 'user.logout'
    | 'user.create'
    | 'user.delete'
    | 'role.assign'
    | 'role.remove'
    | 'export.analytics'
    | 'export.context';

export type AuditLevel = 'info' | 'warning' | 'critical';

export interface AuditEntry {
    id: string;
    timestamp: string;
    action: AuditAction;
    level: AuditLevel;
    userId: string;
    userEmail?: string;
    resource?: string;
    details: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
    checksum: string;
}

export interface AuditFilter {
    startDate?: string;
    endDate?: string;
    actions?: AuditAction[];
    userId?: string;
    level?: AuditLevel;
    success?: boolean;
}

/**
 * Audit Logger
 * Immutable, tamper-evident audit logging
 */
export class AuditLogger {
    private auditDir: string;
    private currentLogFile: string;
    private indexFile: string;

    constructor(rootDir: string) {
        this.auditDir = join(rootDir, '.contextos', 'audit');
        this.indexFile = join(this.auditDir, 'index.json');

        if (!existsSync(this.auditDir)) {
            mkdirSync(this.auditDir, { recursive: true });
        }

        // Use date-based log files for rotation
        const today = new Date().toISOString().split('T')[0];
        this.currentLogFile = join(this.auditDir, `audit-${today}.jsonl`);
    }

    /**
     * Calculate checksum for entry integrity
     */
    private calculateChecksum(entry: Omit<AuditEntry, 'checksum'>): string {
        const data = JSON.stringify(entry);
        return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
    }

    /**
     * Log an audit event
     */
    log(
        action: AuditAction,
        userId: string,
        details: Record<string, unknown> = {},
        options: {
            level?: AuditLevel;
            resource?: string;
            userEmail?: string;
            ipAddress?: string;
            userAgent?: string;
            success?: boolean;
            errorMessage?: string;
        } = {}
    ): AuditEntry {
        const entryWithoutChecksum = {
            id: crypto.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            action,
            level: options.level || 'info',
            userId,
            userEmail: options.userEmail,
            resource: options.resource,
            details,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            success: options.success ?? true,
            errorMessage: options.errorMessage,
        };

        const entry: AuditEntry = {
            ...entryWithoutChecksum,
            checksum: this.calculateChecksum(entryWithoutChecksum),
        };

        // Append to log file (JSONL format)
        appendFileSync(this.currentLogFile, JSON.stringify(entry) + '\n', 'utf-8');

        // Update index
        this.updateIndex(entry);

        return entry;
    }

    private updateIndex(entry: AuditEntry): void {
        const index = this.loadIndex();
        index.lastEntry = entry.id;
        index.lastTimestamp = entry.timestamp;
        index.totalEntries = (index.totalEntries || 0) + 1;

        if (!index.actionCounts) index.actionCounts = {} as Record<string, number>;
        const actionCounts = index.actionCounts as Record<string, number>;
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;

        writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
    }

    private loadIndex(): {
        lastEntry?: string;
        lastTimestamp?: string;
        totalEntries?: number;
        actionCounts?: Record<string, number>;
    } {
        if (existsSync(this.indexFile)) {
            try {
                return JSON.parse(readFileSync(this.indexFile, 'utf-8'));
            } catch {
                return {};
            }
        }
        return {};
    }

    /**
     * Query audit logs
     */
    query(filter: AuditFilter = {}, limit: number = 100): AuditEntry[] {
        const entries: AuditEntry[] = [];

        // Get all log files
        const fs = require('fs');
        const logFiles = fs.readdirSync(this.auditDir)
            .filter((f: string) => f.startsWith('audit-') && f.endsWith('.jsonl'))
            .sort()
            .reverse(); // Most recent first

        for (const logFile of logFiles) {
            if (entries.length >= limit) break;

            const filePath = join(this.auditDir, logFile);
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);

            for (const line of lines.reverse()) {
                if (entries.length >= limit) break;

                try {
                    const entry: AuditEntry = JSON.parse(line);

                    if (this.matchesFilter(entry, filter)) {
                        entries.push(entry);
                    }
                } catch {
                    // Skip malformed entries
                }
            }
        }

        return entries;
    }

    private matchesFilter(entry: AuditEntry, filter: AuditFilter): boolean {
        if (filter.startDate && entry.timestamp < filter.startDate) return false;
        if (filter.endDate && entry.timestamp > filter.endDate) return false;
        if (filter.actions && !filter.actions.includes(entry.action)) return false;
        if (filter.userId && entry.userId !== filter.userId) return false;
        if (filter.level && entry.level !== filter.level) return false;
        if (filter.success !== undefined && entry.success !== filter.success) return false;
        return true;
    }

    /**
     * Verify entry integrity
     */
    verifyEntry(entry: AuditEntry): boolean {
        const { checksum, ...entryWithoutChecksum } = entry;
        const expectedChecksum = this.calculateChecksum(entryWithoutChecksum);
        return checksum === expectedChecksum;
    }

    /**
     * Verify all entries in a log file
     */
    verifyLogFile(filename: string): { valid: number; invalid: number; entries: AuditEntry[] } {
        const filePath = join(this.auditDir, filename);
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        const result = { valid: 0, invalid: 0, entries: [] as AuditEntry[] };

        for (const line of lines) {
            try {
                const entry: AuditEntry = JSON.parse(line);
                if (this.verifyEntry(entry)) {
                    result.valid++;
                } else {
                    result.invalid++;
                    result.entries.push(entry);
                }
            } catch {
                result.invalid++;
            }
        }

        return result;
    }

    /**
     * Export audit logs for compliance reporting
     */
    export(filter: AuditFilter = {}): string {
        const entries = this.query(filter, 10000);
        return JSON.stringify({
            exportDate: new Date().toISOString(),
            filter,
            entryCount: entries.length,
            entries,
        }, null, 2);
    }

    /**
     * Get log summary statistics
     */
    getSummary(): Record<string, unknown> {
        return this.loadIndex();
    }

    /**
     * Log common actions (helpers)
     */
    logContextBuild(userId: string, goal: string, fileCount: number): AuditEntry {
        return this.log('context.build', userId, { goal, fileCount });
    }

    logConfigChange(userId: string, key: string, oldValue: unknown, newValue: unknown): AuditEntry {
        return this.log('config.write', userId, { key, oldValue, newValue }, { level: 'warning' });
    }

    logUserAction(userId: string, action: 'user.login' | 'user.logout', ipAddress?: string): AuditEntry {
        return this.log(action, userId, {}, { level: 'info', ipAddress });
    }

    logSecurityEvent(userId: string, action: AuditAction, details: Record<string, unknown>, success: boolean): AuditEntry {
        return this.log(action, userId, details, { level: 'critical', success });
    }
}

export default AuditLogger;
