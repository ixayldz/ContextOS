/**
 * Scope Manager (Anti-Indexing / Negative Context)
 * 
 * Implements the expert recommendation for "Negative Context" management
 * Allows logical scoping: "When working on frontend, exclude backend/"
 */

export interface ScopeRule {
    name: string;
    description: string;
    when: ScopeCondition;
    include?: string[];   // Glob patterns to include
    exclude?: string[];   // Glob patterns to exclude
    priority: number;     // Higher = more important
}

export interface ScopeCondition {
    type: 'goal_contains' | 'file_in' | 'tag_is' | 'always';
    value?: string | string[];
}

export interface ActiveScope {
    rules: ScopeRule[];
    effectiveIncludes: string[];
    effectiveExcludes: string[];
    reason: string;
}

/**
 * Manages context scoping to prevent irrelevant files from polluting context
 */
export class ScopeManager {
    private rules: ScopeRule[] = [];
    private defaultExcludes: string[] = [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.git/**',
        '*.min.js',
        '*.map',
        'coverage/**',
        '__pycache__/**',
        '.next/**',
        '.nuxt/**',
        'vendor/**',
    ];

    constructor(customRules?: ScopeRule[]) {
        if (customRules) {
            this.rules = customRules;
        }
        this.initializeDefaultRules();
    }

    /**
     * Add a scope rule
     */
    addRule(rule: ScopeRule): void {
        this.rules.push(rule);
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Remove a rule by name
     */
    removeRule(name: string): boolean {
        const index = this.rules.findIndex(r => r.name === name);
        if (index >= 0) {
            this.rules.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Calculate active scope based on current goal and context
     */
    calculateScope(goal: string, targetFiles?: string[]): ActiveScope {
        const activeRules: ScopeRule[] = [];
        const includes: Set<string> = new Set();
        const excludes: Set<string> = new Set(this.defaultExcludes);
        const reasons: string[] = [];

        for (const rule of this.rules) {
            if (this.matchesCondition(rule.when, goal, targetFiles)) {
                activeRules.push(rule);
                reasons.push(`Applied rule: ${rule.name}`);

                if (rule.include) {
                    rule.include.forEach(p => includes.add(p));
                }
                if (rule.exclude) {
                    rule.exclude.forEach(p => excludes.add(p));
                }
            }
        }

        return {
            rules: activeRules,
            effectiveIncludes: Array.from(includes),
            effectiveExcludes: Array.from(excludes),
            reason: reasons.length > 0 ? reasons.join('; ') : 'Default scope applied',
        };
    }

    /**
     * Check if a file should be included in context
     */
    shouldInclude(path: string, scope: ActiveScope): boolean {
        // Check excludes first
        for (const pattern of scope.effectiveExcludes) {
            if (this.matchGlob(path, pattern)) {
                return false;
            }
        }

        // If includes are specified, path must match at least one
        if (scope.effectiveIncludes.length > 0) {
            return scope.effectiveIncludes.some(pattern =>
                this.matchGlob(path, pattern)
            );
        }

        return true;
    }

    /**
     * Get all rules
     */
    getRules(): ScopeRule[] {
        return [...this.rules];
    }

    /**
     * Initialize default scoping rules
     */
    private initializeDefaultRules(): void {
        // Frontend focus rule
        this.rules.push({
            name: 'frontend-focus',
            description: 'When working on frontend, prioritize frontend files',
            when: {
                type: 'goal_contains',
                value: ['frontend', 'ui', 'component', 'react', 'vue', 'angular', 'css', 'style'],
            },
            include: [
                'src/components/**',
                'src/pages/**',
                'src/views/**',
                'src/styles/**',
                '**/*.tsx',
                '**/*.jsx',
                '**/*.vue',
                '**/*.css',
                '**/*.scss',
            ],
            exclude: [
                'src/api/**',
                'src/server/**',
                'src/database/**',
                '**/*.sql',
            ],
            priority: 10,
        });

        // Backend focus rule
        this.rules.push({
            name: 'backend-focus',
            description: 'When working on backend, prioritize server files',
            when: {
                type: 'goal_contains',
                value: ['backend', 'api', 'server', 'database', 'endpoint', 'controller', 'service'],
            },
            include: [
                'src/api/**',
                'src/server/**',
                'src/services/**',
                'src/controllers/**',
                'src/repositories/**',
                'src/database/**',
            ],
            exclude: [
                'src/components/**',
                'src/pages/**',
                '**/*.css',
                '**/*.scss',
            ],
            priority: 10,
        });

        // Testing focus rule
        this.rules.push({
            name: 'testing-focus',
            description: 'When working on tests, include test files',
            when: {
                type: 'goal_contains',
                value: ['test', 'spec', 'jest', 'vitest', 'mocha', 'testing'],
            },
            include: [
                '**/*.test.ts',
                '**/*.test.js',
                '**/*.spec.ts',
                '**/*.spec.js',
                'test/**',
                '__tests__/**',
            ],
            priority: 10,
        });

        // Security focus rule
        this.rules.push({
            name: 'security-focus',
            description: 'When analyzing security, focus on auth and sensitive areas',
            when: {
                type: 'goal_contains',
                value: ['security', 'auth', 'authentication', 'authorization', 'vulnerability', 'password', 'token'],
            },
            include: [
                '**/auth/**',
                '**/security/**',
                '**/middleware/**',
                '**/*auth*',
                '**/*token*',
                '**/*session*',
            ],
            priority: 15,
        });

        // Configuration focus
        this.rules.push({
            name: 'config-focus',
            description: 'When working on configuration',
            when: {
                type: 'goal_contains',
                value: ['config', 'configuration', 'environment', 'setup', '.env'],
            },
            include: [
                '**/*.config.*',
                '**/*.json',
                '**/*.yaml',
                '**/*.yml',
                '.env*',
                'config/**',
            ],
            priority: 8,
        });

        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Check if a condition matches
     */
    private matchesCondition(
        condition: ScopeCondition,
        goal: string,
        targetFiles?: string[]
    ): boolean {
        const goalLower = goal.toLowerCase();

        switch (condition.type) {
            case 'always':
                return true;

            case 'goal_contains':
                const values = Array.isArray(condition.value)
                    ? condition.value
                    : [condition.value || ''];
                return values.some(v => goalLower.includes(v.toLowerCase()));

            case 'file_in':
                if (!targetFiles) return false;
                const patterns = Array.isArray(condition.value)
                    ? condition.value
                    : [condition.value || ''];
                return targetFiles.some(file =>
                    patterns.some(pattern => this.matchGlob(file, pattern))
                );

            case 'tag_is':
                // Would need tag context to implement
                return false;

            default:
                return false;
        }
    }

    /**
     * Simple glob matching (supports * and **)
     */
    private matchGlob(path: string, pattern: string): boolean {
        // Normalize paths
        const normalizedPath = path.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');

        // Convert glob to regex
        const regexPattern = normalizedPattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\{\{GLOBSTAR\}\}/g, '.*');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(normalizedPath);
    }
}

/**
 * Factory function
 */
export function createScopeManager(rules?: ScopeRule[]): ScopeManager {
    return new ScopeManager(rules);
}
