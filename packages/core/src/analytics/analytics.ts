/**
 * Analytics Module
 * Usage analytics and insights dashboard data
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface UsageEvent {
    timestamp: string;
    event: string;
    data: Record<string, unknown>;
    userId?: string;
}

export interface AnalyticsSummary {
    totalContextBuilds: number;
    averageTokensPerContext: number;
    topFiles: Array<{ path: string; accessCount: number }>;
    topGoals: Array<{ goal: string; count: number }>;
    tokensSaved: number;
    lastActivity: string;
}

export interface DailyStats {
    date: string;
    contextBuilds: number;
    tokensUsed: number;
    tokensSaved: number;
    filesAccessed: number;
}

/**
 * Analytics Collector
 * Collects and stores usage analytics locally
 */
export class AnalyticsCollector {
    private analyticsDir: string;
    private eventsFile: string;
    private statsFile: string;

    constructor(rootDir: string) {
        this.analyticsDir = join(rootDir, '.contextos', 'analytics');
        this.eventsFile = join(this.analyticsDir, 'events.json');
        this.statsFile = join(this.analyticsDir, 'stats.json');

        if (!existsSync(this.analyticsDir)) {
            mkdirSync(this.analyticsDir, { recursive: true });
        }
    }

    /**
     * Track an event
     */
    track(event: string, data: Record<string, unknown> = {}, userId?: string): void {
        const usageEvent: UsageEvent = {
            timestamp: new Date().toISOString(),
            event,
            data,
            userId,
        };

        const events = this.loadEvents();
        events.push(usageEvent);

        // Keep only last 1000 events
        const trimmedEvents = events.slice(-1000);
        writeFileSync(this.eventsFile, JSON.stringify(trimmedEvents, null, 2), 'utf-8');
    }

    /**
     * Track context build
     */
    trackContextBuild(goal: string, files: string[], tokens: number, tokensSaved: number): void {
        this.track('context_build', {
            goal,
            fileCount: files.length,
            files: files.slice(0, 10), // Top 10 files
            tokens,
            tokensSaved,
        });

        // Update daily stats
        this.updateDailyStats({
            contextBuilds: 1,
            tokensUsed: tokens,
            tokensSaved,
            filesAccessed: files.length,
        });
    }

    private loadEvents(): UsageEvent[] {
        if (existsSync(this.eventsFile)) {
            try {
                return JSON.parse(readFileSync(this.eventsFile, 'utf-8'));
            } catch {
                return [];
            }
        }
        return [];
    }

    private updateDailyStats(update: Partial<DailyStats>): void {
        const stats = this.loadDailyStats();
        const today = new Date().toISOString().split('T')[0];

        const todayStats = stats.find(s => s.date === today) || {
            date: today,
            contextBuilds: 0,
            tokensUsed: 0,
            tokensSaved: 0,
            filesAccessed: 0,
        };

        todayStats.contextBuilds += update.contextBuilds || 0;
        todayStats.tokensUsed += update.tokensUsed || 0;
        todayStats.tokensSaved += update.tokensSaved || 0;
        todayStats.filesAccessed += update.filesAccessed || 0;

        const otherStats = stats.filter(s => s.date !== today);
        const updatedStats = [...otherStats, todayStats].slice(-30); // Keep 30 days

        writeFileSync(this.statsFile, JSON.stringify(updatedStats, null, 2), 'utf-8');
    }

    private loadDailyStats(): DailyStats[] {
        if (existsSync(this.statsFile)) {
            try {
                return JSON.parse(readFileSync(this.statsFile, 'utf-8'));
            } catch {
                return [];
            }
        }
        return [];
    }

    /**
     * Get analytics summary
     */
    getSummary(): AnalyticsSummary {
        const events = this.loadEvents();
        const buildEvents = events.filter(e => e.event === 'context_build');

        // Calculate top files
        const fileCounter: Record<string, number> = {};
        for (const event of buildEvents) {
            const files = (event.data.files as string[]) || [];
            for (const file of files) {
                fileCounter[file] = (fileCounter[file] || 0) + 1;
            }
        }

        const topFiles = Object.entries(fileCounter)
            .map(([path, accessCount]) => ({ path, accessCount }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 10);

        // Calculate top goals
        const goalCounter: Record<string, number> = {};
        for (const event of buildEvents) {
            const goal = event.data.goal as string;
            if (goal) {
                goalCounter[goal] = (goalCounter[goal] || 0) + 1;
            }
        }

        const topGoals = Object.entries(goalCounter)
            .map(([goal, count]) => ({ goal, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate totals
        const totalTokens = buildEvents.reduce((sum, e) => sum + ((e.data.tokens as number) || 0), 0);
        const totalSaved = buildEvents.reduce((sum, e) => sum + ((e.data.tokensSaved as number) || 0), 0);

        return {
            totalContextBuilds: buildEvents.length,
            averageTokensPerContext: buildEvents.length > 0 ? Math.round(totalTokens / buildEvents.length) : 0,
            topFiles,
            topGoals,
            tokensSaved: totalSaved,
            lastActivity: events.length > 0 ? events[events.length - 1].timestamp : '',
        };
    }

    /**
     * Get daily stats for dashboard
     */
    getDailyStats(days: number = 30): DailyStats[] {
        return this.loadDailyStats().slice(-days);
    }

    /**
     * Export analytics data
     */
    export(): { events: UsageEvent[]; stats: DailyStats[]; summary: AnalyticsSummary } {
        return {
            events: this.loadEvents(),
            stats: this.loadDailyStats(),
            summary: this.getSummary(),
        };
    }

    /**
     * Clear all analytics data
     */
    clear(): void {
        writeFileSync(this.eventsFile, '[]', 'utf-8');
        writeFileSync(this.statsFile, '[]', 'utf-8');
    }
}

export default AnalyticsCollector;
