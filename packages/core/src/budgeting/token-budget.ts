/**
 * Token Budget Manager
 * Manages token allocation and packing for LLM context windows
 */

import type {
    BudgetAllocation,
    TokenBudgetResult,
    PackedFile,
    RankedFile,
    Constraint,
} from '../types.js';
import { CHARS_PER_TOKEN_CODE } from '../constants.js';

// Model token limits
const MODEL_LIMITS: { [key: string]: number } = {
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 8000,
    'gpt-3.5-turbo': 16385,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'gemini-pro': 32768,
    'gemini-1.5-pro': 1000000,
};

export class TokenBudget {
    private modelName: string;
    private maxTokens: number;

    constructor(modelName: string = 'gpt-4-turbo', maxTokens?: number) {
        this.modelName = modelName;
        this.maxTokens = maxTokens || MODEL_LIMITS[modelName] || 32000;
    }

    /**
     * Count tokens in text (improved approximation)
     * Uses CHARS_PER_TOKEN_CODE constant for code-dense content
     *
     * Note: For production use, consider integrating tiktoken for accurate counts.
     * This approximation works well for most code scenarios.
     */
    count(text: string): number {
        if (!text) return 0;

        // Use the defined constant for code token estimation
        return Math.ceil(text.length / CHARS_PER_TOKEN_CODE);
    }

    /**
     * Get allocation percentages based on budget size
     */
    getAllocation(totalBudget?: number): BudgetAllocation {
        const budget = totalBudget || this.maxTokens;

        if (budget <= 8000) {
            // Small context: maximize active focus
            return {
                immutableCore: 0.15,
                activeFocus: 0.45,
                strategicContext: 0.15,
                buffer: 0.25,
            };
        } else if (budget <= 32000) {
            // Medium context: balanced
            return {
                immutableCore: 0.10,
                activeFocus: 0.50,
                strategicContext: 0.20,
                buffer: 0.20,
            };
        } else {
            // Large context: more room for strategic context
            return {
                immutableCore: 0.05,
                activeFocus: 0.55,
                strategicContext: 0.25,
                buffer: 0.15,
            };
        }
    }

    /**
     * Pack ranked files into token budget
     */
    packContext(
        rankedFiles: RankedFile[],
        coreContent: string,
        rules: Constraint[],
        budget?: number
    ): TokenBudgetResult {
        const totalBudget = budget || this.maxTokens;
        const allocation = this.getAllocation(totalBudget);

        // Calculate available tokens for each segment
        const immutableTokens = Math.floor(totalBudget * allocation.immutableCore);
        const activeFocusTokens = Math.floor(totalBudget * allocation.activeFocus);
        const strategicTokens = Math.floor(totalBudget * allocation.strategicContext);
        // Buffer is reserved for LLM response

        const packedFiles: PackedFile[] = [];
        let totalTokens = 0;
        let originalTokens = 0;

        // 1. Pack immutable core (context.yaml summary, essential rules)
        const coreTokens = this.count(coreContent);
        originalTokens += coreTokens;

        if (coreTokens <= immutableTokens) {
            packedFiles.push({
                path: '.contextos/context.yaml',
                content: coreContent,
                tokens: coreTokens,
                segment: 'immutableCore',
            });
            totalTokens += coreTokens;
        } else {
            // Truncate core if too large
            const truncatedCore = this.truncateToTokens(coreContent, immutableTokens);
            packedFiles.push({
                path: '.contextos/context.yaml',
                content: truncatedCore,
                tokens: this.count(truncatedCore),
                segment: 'immutableCore',
            });
            totalTokens += this.count(truncatedCore);
        }

        // 2. Pack active focus (top ranked files)
        let activeFocusUsed = 0;
        for (const file of rankedFiles) {
            if (file.chunks.length === 0) continue;

            const fileContent = file.chunks.map(c => c.content).join('\n\n');
            const fileTokens = this.count(fileContent);
            originalTokens += fileTokens;

            if (activeFocusUsed + fileTokens <= activeFocusTokens) {
                packedFiles.push({
                    path: file.path,
                    content: this.formatFileContent(file.path, fileContent),
                    tokens: fileTokens,
                    segment: 'activeFocus',
                });
                activeFocusUsed += fileTokens;
                totalTokens += fileTokens;
            } else {
                // Try to fit partial content
                const remaining = activeFocusTokens - activeFocusUsed;
                if (remaining > 200) {
                    const truncated = this.truncateToTokens(fileContent, remaining);
                    packedFiles.push({
                        path: file.path,
                        content: this.formatFileContent(file.path, truncated + '\n... [truncated]'),
                        tokens: this.count(truncated),
                        segment: 'activeFocus',
                    });
                    totalTokens += this.count(truncated);
                }
                break;
            }
        }

        // 3. Pack strategic context (rules, patterns)
        let strategicUsed = 0;
        const rulesContent = this.formatRules(rules);
        const rulesTokens = this.count(rulesContent);

        if (rulesTokens <= strategicTokens) {
            packedFiles.push({
                path: '.contextos/rules',
                content: rulesContent,
                tokens: rulesTokens,
                segment: 'strategicContext',
            });
            strategicUsed = rulesTokens;
            totalTokens += rulesTokens;
        }

        // Calculate savings
        const savings = {
            original: originalTokens,
            optimized: totalTokens,
            percentage: Math.round((1 - totalTokens / Math.max(originalTokens, 1)) * 100),
        };

        return {
            totalTokens,
            allocation,
            files: packedFiles,
            truncated: totalTokens < originalTokens,
            savings,
        };
    }

    /**
     * Truncate text to fit within token limit
     */
    private truncateToTokens(text: string, maxTokens: number): string {
        const estimatedChars = maxTokens * CHARS_PER_TOKEN_CODE;
        if (text.length <= estimatedChars) return text;

        // Try to truncate at a natural boundary
        const truncated = text.slice(0, estimatedChars);
        const lastNewline = truncated.lastIndexOf('\n');

        if (lastNewline > estimatedChars * 0.8) {
            return truncated.slice(0, lastNewline);
        }

        return truncated;
    }

    /**
     * Format file content with path header
     */
    private formatFileContent(path: string, content: string): string {
        return `// File: ${path}\n${content}`;
    }

    /**
     * Format rules as a readable section
     */
    private formatRules(rules: Constraint[]): string {
        if (rules.length === 0) return '';

        let output = '## Coding Rules\n\n';

        for (const rule of rules) {
            const icon = rule.severity === 'error' ? '🚫' : rule.severity === 'warning' ? '⚠️' : 'ℹ️';
            output += `${icon} **${rule.rule}**\n`;
            if (rule.suggestion) {
                output += `   Suggestion: ${rule.suggestion}\n`;
            }
            output += '\n';
        }

        return output;
    }

    /**
     * Get model token limit
     */
    getModelLimit(): number {
        return this.maxTokens;
    }

    /**
     * Set model
     */
    setModel(modelName: string): void {
        this.modelName = modelName;
        this.maxTokens = MODEL_LIMITS[modelName] || 32000;
    }
}
