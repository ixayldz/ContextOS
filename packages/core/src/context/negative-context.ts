/**
 * Negative Context Manager
 * Manages .contextignore for learning from failures
 * Based on analysis recommendations for context poisoning prevention
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface NegativeRule {
    rule: string;
    reason: string;
    learnedAt: string;
    category: 'library' | 'pattern' | 'file' | 'approach';
}

/**
 * Negative Context Manager
 * Prevents agents from repeating learned mistakes
 */
export class NegativeContextManager {
    private readonly contextIgnorePath: string;
    private rules: NegativeRule[] = [];

    constructor(rootDir: string) {
        this.contextIgnorePath = join(rootDir, '.contextos', '.contextignore');
        this.load();
    }

    /**
     * Load rules from .contextignore
     */
    private load(): void {
        if (!existsSync(this.contextIgnorePath)) {
            this.rules = [];
            return;
        }

        try {
            const content = readFileSync(this.contextIgnorePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

            this.rules = lines.map(line => {
                // Format: CATEGORY:RULE|REASON
                const match = line.match(/^(\w+):(.+?)\|(.+)$/);
                if (match) {
                    return {
                        category: match[1] as NegativeRule['category'],
                        rule: match[2].trim(),
                        reason: match[3].trim(),
                        learnedAt: new Date().toISOString(),
                    };
                }
                // Simple format: just the rule
                return {
                    rule: line.trim(),
                    reason: 'User defined',
                    learnedAt: new Date().toISOString(),
                    category: 'pattern' as const,
                };
            });
        } catch {
            this.rules = [];
        }
    }

    /**
     * Save rules to .contextignore
     */
    private save(): void {
        const header = `# ContextOS Negative Context Rules
# Format: CATEGORY:RULE|REASON
# Categories: library, pattern, file, approach
# These rules are injected into AI prompts to prevent repeated mistakes

`;
        const content = this.rules.map(r =>
            `${r.category}:${r.rule}|${r.reason}`
        ).join('\n');

        writeFileSync(this.contextIgnorePath, header + content, 'utf-8');
    }

    /**
     * Add a new negative rule
     */
    addRule(rule: Omit<NegativeRule, 'learnedAt'>): void {
        // Check for duplicates
        if (this.rules.some(r => r.rule === rule.rule)) {
            return;
        }

        this.rules.push({
            ...rule,
            learnedAt: new Date().toISOString(),
        });

        this.save();
    }

    /**
     * Learn from an error
     */
    learnFromError(errorMessage: string, context?: string): NegativeRule | null {
        // Pattern matching for common errors
        const patterns = [
            // Library version issues
            {
                regex: /Module not found.*['"](.+?)['"]/i,
                category: 'library' as const,
                template: (match: RegExpMatchArray) => ({
                    rule: `Do not use ${match[1]}`,
                    reason: `Module not found: ${match[1]}`,
                }),
            },
            // Deprecated API
            {
                regex: /deprecated.*['"](.+?)['"]/i,
                category: 'approach' as const,
                template: (match: RegExpMatchArray) => ({
                    rule: `Avoid deprecated API: ${match[1]}`,
                    reason: 'API is deprecated',
                }),
            },
            // Permission denied
            {
                regex: /EACCES.*['"](.+?)['"]/i,
                category: 'file' as const,
                template: (match: RegExpMatchArray) => ({
                    rule: `Cannot write to ${match[1]}`,
                    reason: 'Permission denied',
                }),
            },
            // Type errors
            {
                regex: /Type '(.+?)' is not assignable/i,
                category: 'pattern' as const,
                template: (match: RegExpMatchArray) => ({
                    rule: `Check type compatibility for ${match[1]}`,
                    reason: 'Type mismatch error',
                }),
            },
        ];

        for (const pattern of patterns) {
            const match = errorMessage.match(pattern.regex);
            if (match) {
                const { rule, reason } = pattern.template(match);
                const newRule: NegativeRule = {
                    rule,
                    reason,
                    category: pattern.category,
                    learnedAt: new Date().toISOString(),
                };
                this.addRule(newRule);
                return newRule;
            }
        }

        return null;
    }

    /**
     * Get all rules
     */
    getRules(): NegativeRule[] {
        return [...this.rules];
    }

    /**
     * Get rules by category
     */
    getRulesByCategory(category: NegativeRule['category']): NegativeRule[] {
        return this.rules.filter(r => r.category === category);
    }

    /**
     * Generate prompt injection text
     */
    generatePromptInjection(): string {
        if (this.rules.length === 0) {
            return '';
        }

        const lines = [
            '',
            '# IMPORTANT CONSTRAINTS (Learned from previous failures)',
            'Do NOT violate these rules:',
            '',
        ];

        for (const rule of this.rules) {
            lines.push(`- ❌ ${rule.rule} (Reason: ${rule.reason})`);
        }

        lines.push('');
        return lines.join('\n');
    }

    /**
     * Clear all rules
     */
    clear(): void {
        this.rules = [];
        this.save();
    }

    /**
     * Remove a specific rule
     */
    removeRule(ruleText: string): boolean {
        const index = this.rules.findIndex(r => r.rule === ruleText);
        if (index !== -1) {
            this.rules.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
}

/**
 * Factory function
 */
export function createNegativeContextManager(rootDir: string): NegativeContextManager {
    return new NegativeContextManager(rootDir);
}
