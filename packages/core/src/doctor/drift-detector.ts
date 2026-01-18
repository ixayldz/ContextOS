/**
 * Drift Detector
 * Compares context.yaml with actual code to detect mismatches
 */

import { readFileSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';
import type {
    DriftIssue,
    DriftReport,
    ContextYaml,
    SupportedLanguage,
} from '../types.js';
import { loadConfig } from '../config/loader.js';
import { getLanguageExtensions } from '../parser/detector.js';

// Known patterns for detecting technologies
const TECH_PATTERNS: { [key: string]: RegExp[] } = {
    // Databases
    postgresql: [/pg|postgres|postgresql/i, /@prisma\/client.*postgresql/],
    mysql: [/mysql|mysql2/i],
    mongodb: [/mongoose|mongodb/i],
    sqlite: [/better-sqlite3|sqlite/i],

    // Cache
    redis: [/ioredis|redis/i],
    memcached: [/memcached/i],

    // Messaging
    rabbitmq: [/amqplib|rabbitmq/i],
    kafka: [/kafkajs|kafka/i],

    // Monitoring
    prometheus: [/prom-client|prometheus/i],
    datadog: [/dd-trace|datadog/i],

    // Frameworks
    express: [/express/i],
    nestjs: [/@nestjs/i],
    fastify: [/fastify/i],
    nextjs: [/next/i],
    django: [/django/i],
    flask: [/flask/i],
    fastapi: [/fastapi/i],
};

export class DriftDetector {
    private rootDir: string;
    private context: ContextYaml;
    private sourceFiles: string[] = [];

    constructor(rootDir: string, context: ContextYaml) {
        this.rootDir = rootDir;
        this.context = context;
    }

    /**
     * Run full drift detection
     */
    async detect(): Promise<DriftReport> {
        const issues: DriftIssue[] = [];

        // Load source files
        await this.loadSourceFiles();

        // Run all checks
        issues.push(...await this.checkDatabaseDrift());
        issues.push(...await this.checkStackDrift());
        issues.push(...await this.checkFrameworkDrift());
        issues.push(...await this.checkConstraintViolations());

        // Categorize issues
        const errors = issues.filter(i => i.severity === 'error');
        const warnings = issues.filter(i => i.severity === 'warning');
        const info = issues.filter(i => i.severity === 'info');

        return {
            errors,
            warnings,
            info,
            passed: this.calculatePassedChecks(issues),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Load all source files for analysis
     */
    private async loadSourceFiles(): Promise<void> {
        const extensions = getLanguageExtensions(this.context.project.language);
        const patterns = extensions.map(ext => `**/*${ext}`);

        this.sourceFiles = await glob(patterns, {
            cwd: this.rootDir,
            ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
            absolute: true,
        });
    }

    /**
     * Check for database mismatches
     */
    private async checkDatabaseDrift(): Promise<DriftIssue[]> {
        const issues: DriftIssue[] = [];
        const declaredDb = this.context.stack?.database?.toLowerCase();

        if (!declaredDb) return issues;

        // Scan for database imports
        const detectedDbs = await this.detectTechnologies(['postgresql', 'mysql', 'mongodb', 'sqlite']);

        for (const [detected, locations] of detectedDbs) {
            if (detected !== declaredDb && locations.length > 0) {
                issues.push({
                    type: 'database',
                    severity: 'error',
                    message: 'Database mismatch detected',
                    expected: declaredDb,
                    actual: detected,
                    location: locations[0],
                    suggestion: `Update context.yaml to use "${detected}" or refactor code to use "${declaredDb}"`,
                });
            }
        }

        // Check if declared DB is not found
        const declaredPatterns = TECH_PATTERNS[declaredDb];
        if (declaredPatterns) {
            const found = await this.findPatternInFiles(declaredPatterns);
            if (found.length === 0) {
                issues.push({
                    type: 'database',
                    severity: 'warning',
                    message: `Declared database "${declaredDb}" not found in code`,
                    expected: declaredDb,
                    actual: 'not found',
                    suggestion: `Verify that ${declaredDb} is actually used or update context.yaml`,
                });
            }
        }

        return issues;
    }

    /**
     * Check for stack technology mismatches
     */
    private async checkStackDrift(): Promise<DriftIssue[]> {
        const issues: DriftIssue[] = [];
        const stack = this.context.stack || {};

        // Check cache
        if (stack.cache) {
            const cacheIssues = await this.compareStackItem('cache', stack.cache, ['redis', 'memcached']);
            issues.push(...cacheIssues);
        }

        // Check messaging
        if (stack.messaging) {
            const msgIssues = await this.compareStackItem('messaging', stack.messaging, ['rabbitmq', 'kafka']);
            issues.push(...msgIssues);
        }

        // Detect undeclared technologies
        const undeclared = await this.findUndeclaredTechnologies();
        for (const tech of undeclared) {
            issues.push({
                type: 'dependency',
                severity: 'warning',
                message: `Technology "${tech.name}" found in code but not declared in context.yaml`,
                expected: 'declared in stack',
                actual: tech.name,
                location: tech.location,
                suggestion: `Add to context.yaml: stack.${tech.category}: "${tech.name}"`,
            });
        }

        return issues;
    }

    /**
     * Check framework declaration
     */
    private async checkFrameworkDrift(): Promise<DriftIssue[]> {
        const issues: DriftIssue[] = [];
        const declaredFramework = this.context.project.framework?.toLowerCase();

        if (!declaredFramework) return issues;

        const patterns = TECH_PATTERNS[declaredFramework];
        if (patterns) {
            const found = await this.findPatternInFiles(patterns);
            if (found.length === 0) {
                issues.push({
                    type: 'framework',
                    severity: 'warning',
                    message: `Declared framework "${declaredFramework}" not detected in imports`,
                    expected: declaredFramework,
                    actual: 'not found',
                    suggestion: 'Verify framework declaration or update context.yaml',
                });
            }
        }

        return issues;
    }

    /**
     * Check for constraint violations in code
     */
    private async checkConstraintViolations(): Promise<DriftIssue[]> {
        const issues: DriftIssue[] = [];
        const constraints = this.context.constraints || [];

        for (const constraint of constraints) {
            const violations = await this.checkConstraint(constraint.rule);
            for (const violation of violations) {
                issues.push({
                    type: 'constraint',
                    severity: constraint.severity,
                    message: `Constraint violation: ${constraint.rule}`,
                    expected: 'constraint respected',
                    actual: 'violation found',
                    location: violation,
                    suggestion: constraint.suggestion || 'Fix the violation',
                });
            }
        }

        return issues;
    }

    /**
     * Check a specific constraint
     * Fix N9: Convert to async file operations
     */
    private async checkConstraint(rule: string): Promise<{ file: string; line?: number }[]> {
        const violations: { file: string; line?: number }[] = [];

        // Pattern-based constraint checking
        if (rule.toLowerCase().includes('no direct database access in controllers')) {
            // Check for DB imports in controller files
            for (const file of this.sourceFiles) {
                if (file.includes('controller')) {
                    try {
                        const content = await readFile(file, 'utf-8');
                        if (/import.*from.*(prisma|typeorm|sequelize|mongoose)/i.test(content)) {
                            const lines = content.split('\n');
                            for (let i = 0; i < lines.length; i++) {
                                if (/import.*from.*(prisma|typeorm|sequelize|mongoose)/i.test(lines[i])) {
                                    violations.push({ file, line: i + 1 });
                                    break;
                                }
                            }
                        }
                    } catch {
                        // Skip unreadable files
                    }
                }
            }
        }

        if (rule.toLowerCase().includes('no console.log')) {
            for (const file of this.sourceFiles) {
                try {
                    const content = await readFile(file, 'utf-8');
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (/console\.log\(/.test(lines[i]) && !lines[i].includes('//')) {
                            violations.push({ file, line: i + 1 });
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        }

        return violations;
    }

    /**
     * Detect technologies in codebase
     */
    private async detectTechnologies(techList: string[]): Promise<Map<string, { file: string; line?: number }[]>> {
        const results = new Map<string, { file: string; line?: number }[]>();

        for (const tech of techList) {
            const patterns = TECH_PATTERNS[tech];
            if (patterns) {
                const locations = await this.findPatternInFiles(patterns);
                if (locations.length > 0) {
                    results.set(tech, locations);
                }
            }
        }

        return results;
    }

    /**
     * Find patterns in files
     * Fix N9: Convert to async file operations
     */
    private async findPatternInFiles(patterns: RegExp[]): Promise<{ file: string; line?: number }[]> {
        const results: { file: string; line?: number }[] = [];

        for (const file of this.sourceFiles) {
            try {
                const content = await readFile(file, 'utf-8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    for (const pattern of patterns) {
                        if (pattern.test(lines[i])) {
                            results.push({ file, line: i + 1 });
                            break;
                        }
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        return results;
    }

    /**
     * Compare declared stack item with detected
     */
    private async compareStackItem(
        category: string,
        declared: string,
        possibleTechs: string[]
    ): Promise<DriftIssue[]> {
        const issues: DriftIssue[] = [];
        const detected = await this.detectTechnologies(possibleTechs);

        for (const [tech, locations] of detected) {
            if (tech !== declared.toLowerCase() && locations.length > 0) {
                issues.push({
                    type: 'dependency',
                    severity: 'warning',
                    message: `Stack ${category} mismatch`,
                    expected: declared,
                    actual: tech,
                    location: locations[0],
                    suggestion: `Update context.yaml stack.${category} to "${tech}"`,
                });
            }
        }

        return issues;
    }

    /**
     * Find undeclared technologies
     */
    private async findUndeclaredTechnologies(): Promise<{ name: string; category: string; location: { file: string; line?: number } }[]> {
        const undeclared: { name: string; category: string; location: { file: string; line?: number } }[] = [];
        const stack = this.context.stack || {};

        const categories: { [key: string]: string[] } = {
            cache: ['redis', 'memcached'],
            messaging: ['rabbitmq', 'kafka'],
            database: ['postgresql', 'mysql', 'mongodb', 'sqlite'],
        };

        for (const [category, techs] of Object.entries(categories)) {
            const declared = (stack as any)[category]?.toLowerCase();

            for (const tech of techs) {
                if (tech === declared) continue;

                const patterns = TECH_PATTERNS[tech];
                if (patterns) {
                    const locations = await this.findPatternInFiles(patterns);
                    if (locations.length > 0) {
                        undeclared.push({
                            name: tech,
                            category,
                            location: locations[0],
                        });
                    }
                }
            }
        }

        return undeclared;
    }

    /**
     * Calculate number of passed checks
     */
    private calculatePassedChecks(issues: DriftIssue[]): number {
        // Approximate number of checks performed
        const totalChecks = 50; // Arbitrary number representing all types of checks
        return Math.max(0, totalChecks - issues.length);
    }
}

/**
 * Run drift detection for a project
 */
export async function detectDrift(projectDir: string = process.cwd()): Promise<DriftReport> {
    const config = loadConfig(projectDir);
    const detector = new DriftDetector(config.rootDir, config.context);
    return detector.detect();
}
