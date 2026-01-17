/**
 * Gemini Pro API Client
 * Provides LLM-powered context summarization and intelligent features
 */

export interface GeminiConfig {
    apiKey: string;
    model?: string;
    maxOutputTokens?: number;
    temperature?: number;
}

export interface SummarizeResult {
    summary: string;
    keyPoints: string[];
    tokenCount: number;
}

export interface GoalInferenceResult {
    goal: string;
    confidence: number;
    suggestedFiles: string[];
    reasoning: string;
}

export interface ConstraintSuggestion {
    rule: string;
    severity: 'error' | 'warning' | 'info';
    reason: string;
}

const DEFAULT_MODEL = 'gemini-3-pro-preview';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini 3 thinking levels: low, medium (Flash only), high
type ThinkingLevel = 'low' | 'medium' | 'high';

export class GeminiClient {
    private apiKey: string;
    private model: string;
    private maxOutputTokens: number;
    private temperature: number;
    private thinkingLevel: ThinkingLevel;

    constructor(config: GeminiConfig) {
        this.apiKey = config.apiKey;
        this.model = config.model || DEFAULT_MODEL;
        this.maxOutputTokens = config.maxOutputTokens || 2048;
        // Gemini 3 recommends temperature 1.0 for optimal reasoning
        this.temperature = 1.0;
        this.thinkingLevel = 'high'; // Default to high for best reasoning
    }

    /**
     * Check if API key is configured
     */
    isConfigured(): boolean {
        return Boolean(this.apiKey);
    }

    /**
     * Make a request to Gemini API
     */
    private async request(prompt: string, systemPrompt?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
        }

        const url = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

        const contents = [];

        if (systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: `System instructions: ${systemPrompt}` }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'Understood. I will follow these instructions.' }]
            });
        }

        contents.push({
            role: 'user',
            parts: [{ text: prompt }]
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: this.temperature,
                    maxOutputTokens: this.maxOutputTokens,
                    // Gemini 3 thinking configuration
                    thinkingConfig: {
                        thinkingLevel: this.thinkingLevel,
                    },
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{ text?: string }>;
                };
            }>;
        };

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response from Gemini API');
        }

        return data.candidates[0].content.parts[0].text;
    }

    /**
     * Summarize code or documentation for context compression
     */
    async summarize(content: string, fileType: string = 'code'): Promise<SummarizeResult> {
        const systemPrompt = `You are a code analysis expert. Your task is to create concise, technical summaries that preserve essential information for an AI coding assistant. Focus on:
- Main purpose and functionality
- Key APIs, functions, and classes
- Important dependencies and relationships
- Architectural patterns used`;

        const prompt = `Summarize this ${fileType} file. Be concise but preserve all technically important details.

Content:
\`\`\`
${content}
\`\`\`

Respond in this JSON format:
{
  "summary": "One paragraph summary",
  "keyPoints": ["point1", "point2", "point3"]
}`;

        const response = await this.request(prompt, systemPrompt);

        try {
            // Extract JSON from response (might be wrapped in markdown code blocks)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    summary: parsed.summary || '',
                    keyPoints: parsed.keyPoints || [],
                    tokenCount: Math.ceil(response.length / 4),
                };
            }
        } catch {
            // Fallback if JSON parsing fails
        }

        return {
            summary: response.slice(0, 500),
            keyPoints: [],
            tokenCount: Math.ceil(response.length / 4),
        };
    }

    /**
     * Infer development goal from git diff or recent changes
     */
    async inferGoal(
        gitDiff: string,
        projectContext: string,
        recentFiles: string[]
    ): Promise<GoalInferenceResult> {
        const systemPrompt = `You are a software development expert. Analyze code changes to infer the developer's goal. Be specific and actionable.`;

        const prompt = `Based on these code changes, infer what the developer is trying to accomplish.

Project Context:
${projectContext}

Recent Files Modified:
${recentFiles.join('\n')}

Git Diff:
\`\`\`
${gitDiff.slice(0, 3000)}
\`\`\`

Respond in JSON format:
{
  "goal": "Clear, actionable goal description",
  "confidence": 0.0-1.0,
  "suggestedFiles": ["file1.ts", "file2.ts"],
  "reasoning": "Brief explanation of why this goal was inferred"
}`;

        const response = await this.request(prompt, systemPrompt);

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    goal: parsed.goal || 'General development',
                    confidence: parsed.confidence || 0.5,
                    suggestedFiles: parsed.suggestedFiles || [],
                    reasoning: parsed.reasoning || '',
                };
            }
        } catch {
            // Fallback
        }

        return {
            goal: 'General development context',
            confidence: 0.3,
            suggestedFiles: recentFiles,
            reasoning: 'Could not infer specific goal from changes',
        };
    }

    /**
     * Suggest coding constraints based on codebase analysis
     */
    async suggestConstraints(
        sampleCode: string,
        existingConstraints: string[]
    ): Promise<ConstraintSuggestion[]> {
        const systemPrompt = `You are a code quality expert. Analyze code patterns and suggest coding rules/constraints that would improve consistency and prevent bugs.`;

        const prompt = `Analyze this code and suggest coding constraints/rules that should be enforced.

Sample Code:
\`\`\`
${sampleCode.slice(0, 2000)}
\`\`\`

Existing Constraints:
${existingConstraints.map(c => `- ${c}`).join('\n') || 'None'}

Suggest 3-5 NEW constraints that would benefit this codebase. Respond in JSON format:
{
  "suggestions": [
    {"rule": "Rule description", "severity": "error|warning|info", "reason": "Why this rule matters"}
  ]
}`;

        const response = await this.request(prompt, systemPrompt);

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.suggestions || [];
            }
        } catch {
            // Fallback
        }

        return [];
    }

    /**
     * Generate human-readable explanation for drift issues
     */
    async explainDrift(
        driftIssue: {
            type: string;
            expected: string;
            actual: string;
            location?: string;
        }
    ): Promise<string> {
        const prompt = `Explain this code-to-configuration drift issue in a developer-friendly way:

Issue Type: ${driftIssue.type}
Expected (from configuration): ${driftIssue.expected}
Actual (from code): ${driftIssue.actual}
${driftIssue.location ? `Location: ${driftIssue.location}` : ''}

Provide:
1. A clear explanation of what went wrong
2. Why this matters
3. How to fix it

Keep the response concise (max 3-4 sentences).`;

        return this.request(prompt);
    }

    /**
     * Optimize context for LLM consumption
     */
    async optimizeContext(
        files: { path: string; content: string }[],
        goal: string,
        maxTokens: number
    ): Promise<{ optimizedContent: string; tokensSaved: number }> {
        const totalContent = files.map(f => `// ${f.path}\n${f.content}`).join('\n\n');
        const originalTokens = Math.ceil(totalContent.length / 4);

        if (originalTokens <= maxTokens) {
            return { optimizedContent: totalContent, tokensSaved: 0 };
        }

        const systemPrompt = `You are an expert at compressing code context while preserving essential information for AI coding assistants.`;

        const prompt = `Compress this code context to fit within ${maxTokens} tokens while preserving all information relevant to this goal: "${goal}"

Files:
${files.map(f => `\n--- ${f.path} ---\n${f.content.slice(0, 1000)}`).join('\n')}

Instructions:
1. Keep all function/class signatures
2. Summarize implementation details
3. Preserve comments about important behavior
4. Remove redundant code

Output the compressed version directly.`;

        const optimizedContent = await this.request(prompt, systemPrompt);
        const newTokens = Math.ceil(optimizedContent.length / 4);

        return {
            optimizedContent,
            tokensSaved: originalTokens - newTokens,
        };
    }
}

/**
 * Create a Gemini client from environment variables
 */
export function createGeminiClient(): GeminiClient | null {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return null;
    }

    return new GeminiClient({
        apiKey,
        model: process.env.GEMINI_MODEL || 'gemini-3-pro-preview',
    });
}

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
}
