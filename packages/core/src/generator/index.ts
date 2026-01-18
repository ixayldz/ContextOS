/**
 * AI Code Generator
 * Generates code from prompts using AI models
 * Phase 8: Added depth limit, shadow FS, negative context
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join, resolve, normalize } from 'path';
import { GeminiClient, createGeminiClient, isGeminiAvailable } from '../llm/gemini-client.js';
import { OpenAIAdapter, createOpenAIAdapter, isOpenAIAvailable } from '../llm/openai-adapter.js';
import { AnthropicAdapter, createAnthropicAdapter, isAnthropicAvailable } from '../llm/anthropic-adapter.js';
import { loadConfig, type LoadedConfig } from '../config/loader.js';
import { ShadowFileSystem, createShadowFS } from './shadow-fs.js';
import { NegativeContextManager, createNegativeContextManager } from '../context/negative-context.js';

// Maximum recursion depth to prevent infinite loops (Qwen Trap)
const MAX_DEPTH = 3;

export interface GeneratorOptions {
    dryRun?: boolean;
    confirm?: boolean;
    model?: 'gemini' | 'openai' | 'anthropic' | 'auto';
    maxFiles?: number;
    backupBeforeOverwrite?: boolean;
    depth?: number; // Current recursion depth
    useTransaction?: boolean; // Use shadow FS for atomic writes
}

export interface GeneratedFile {
    path: string;
    content: string;
    isNew: boolean;
    language: string;
}

export interface GenerateResult {
    success: boolean;
    files: GeneratedFile[];
    tokensUsed: number;
    error?: string;
}

/**
 * AI Code Generator
 */
export class AIGenerator {
    private config: LoadedConfig | null = null;
    private gemini: GeminiClient | null = null;
    private openai: OpenAIAdapter | null = null;
    private anthropic: AnthropicAdapter | null = null;
    private rootDir: string = process.cwd();
    private shadowFS: ShadowFileSystem | null = null;
    private negativeContext: NegativeContextManager | null = null;

    constructor(projectDir?: string) {
        this.rootDir = projectDir || process.cwd();
    }

    /**
     * Initialize the generator
     */
    async initialize(): Promise<void> {
        try {
            this.config = loadConfig(this.rootDir);
            this.rootDir = this.config.rootDir;
        } catch {
            // Config not found, use current directory
        }

        // Initialize available AI clients
        if (isGeminiAvailable()) {
            this.gemini = createGeminiClient();
        }
        if (isOpenAIAvailable()) {
            this.openai = createOpenAIAdapter();
        }
        if (isAnthropicAvailable()) {
            this.anthropic = createAnthropicAdapter();
        }

        if (!this.gemini && !this.openai && !this.anthropic) {
            throw new Error('No AI API key found. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY environment variable.');
        }

        // Initialize Shadow FS and Negative Context
        this.shadowFS = createShadowFS(this.rootDir);
        this.negativeContext = createNegativeContextManager(this.rootDir);
    }

    /**
     * Generate code from a prompt
     */
    async generate(prompt: string, options: GeneratorOptions = {}): Promise<GenerateResult> {
        const model = options.model || 'auto';
        const depth = options.depth || 0;

        // Check depth limit (prevent infinite recursion - Qwen Trap)
        if (depth >= MAX_DEPTH) {
            return {
                success: false,
                files: [],
                tokensUsed: 0,
                error: `Maximum recursion depth (${MAX_DEPTH}) exceeded. Provide a heuristic summary instead.`,
            };
        }

        // Build context with negative rules
        const context = await this.buildContext();
        const negativeRules = this.negativeContext?.generatePromptInjection() || '';

        // Create the full prompt with negative context
        const fullPrompt = this.createPrompt(prompt, context + negativeRules);

        // Call AI
        let response: string;
        let tokensUsed = 0;

        try {
            if (model === 'gemini' || (model === 'auto' && this.gemini)) {
                if (!this.gemini) throw new Error('Gemini not available');
                const result = await this.gemini.generate(fullPrompt);
                response = result.text;
                tokensUsed = result.tokensUsed;
            } else if (model === 'openai' || (model === 'auto' && this.openai)) {
                if (!this.openai) throw new Error('OpenAI not available');
                const result = await this.openai.complete({
                    systemPrompt: 'You are an expert software developer. Generate clean, production-ready code.',
                    userMessage: fullPrompt,
                    maxTokens: 8000,
                });
                response = result.content;
                tokensUsed = result.tokensUsed.total;
            } else if (model === 'anthropic' || (model === 'auto' && this.anthropic)) {
                if (!this.anthropic) throw new Error('Anthropic not available');
                const result = await this.anthropic.complete({
                    systemPrompt: 'You are an expert software developer. Generate clean, production-ready code.',
                    userMessage: fullPrompt,
                    maxTokens: 4096,
                    model: 'claude-4.5-opus-20260115' // Claude 4.5 Opus
                });
                response = result.content;
                tokensUsed = result.tokensUsed.total;
            } else {
                throw new Error('No AI model available');
            }
        } catch (error) {
            return {
                success: false,
                files: [],
                tokensUsed: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }

        // Parse response into files
        const files = this.parseResponse(response);

        // Check file limits
        const maxFiles = options.maxFiles || 20;
        if (files.length > maxFiles) {
            return {
                success: false,
                files: [],
                tokensUsed,
                error: `Too many files generated (${files.length}). Max: ${maxFiles}`,
            };
        }

        // Dry run - just return files without writing
        if (options.dryRun) {
            return {
                success: true,
                files,
                tokensUsed,
            };
        }

        // Write files
        const writtenFiles = await this.writeFiles(files, options);

        return {
            success: true,
            files: writtenFiles,
            tokensUsed,
        };
    }

    /**
     * Build context from project files
     */
    private async buildContext(): Promise<string> {
        const parts: string[] = [];

        // Add PRD if exists
        const prdPaths = ['prd.md', 'PRD.md', 'docs/prd.md', 'README.md'];
        for (const prdPath of prdPaths) {
            const fullPath = join(this.rootDir, prdPath);
            if (existsSync(fullPath)) {
                const content = readFileSync(fullPath, 'utf-8');
                parts.push(`## ${prdPath}\n\n${content}`);
                break; // Only include first found
            }
        }

        // Add context.yaml info if available
        if (this.config) {
            parts.push(`## Project Info
- Name: ${this.config.context.project.name}
- Language: ${this.config.context.project.language}
- Description: ${this.config.context.project.description || 'N/A'}
`);
        }

        return parts.join('\n\n---\n\n');
    }

    /**
     * Create the full AI prompt
     */
    private createPrompt(userPrompt: string, context: string): string {
        return `# Project Context

${context}

---

# Task

${userPrompt}

---

# Instructions

Generate the necessary code files. Use this EXACT format for each file:

\`\`\`path/to/filename.ext
// file content here
\`\`\`

IMPORTANT:
- Put the FULL FILE PATH in the code block language tag (e.g. \`\`\`src/index.ts)
- Generate complete, working code - no placeholders
- Include all necessary imports
- Follow best practices for the language
- One file per code block

Generate the files now:`;
    }

    /**
     * Parse AI response into file objects
     */
    private parseResponse(response: string): GeneratedFile[] {
        const files: GeneratedFile[] = [];

        // Match code blocks with path in language tag
        // Pattern: ```path/to/file.ext\n...content...\n```
        const codeBlockRegex = /```([^\n`]+)\n([\s\S]*?)```/g;

        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const pathOrLang = match[1].trim();
            const content = match[2];

            // Check if it looks like a file path (contains / or \ or has extension)
            if (pathOrLang.includes('/') || pathOrLang.includes('\\') || /\.\w+$/.test(pathOrLang)) {
                // Normalize path
                const filePath = pathOrLang.replace(/\\/g, '/');

                // Detect language from extension
                const ext = filePath.split('.').pop() || '';
                const language = this.getLanguageFromExtension(ext);

                // Check if file exists
                const fullPath = join(this.rootDir, filePath);
                const isNew = !existsSync(fullPath);

                files.push({
                    path: filePath,
                    content: content.trim(),
                    isNew,
                    language,
                });
            }
        }

        return files;
    }

    /**
     * Get language from file extension
     */
    private getLanguageFromExtension(ext: string): string {
        const map: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            py: 'python',
            rs: 'rust',
            go: 'go',
            java: 'java',
            md: 'markdown',
            json: 'json',
            yaml: 'yaml',
            yml: 'yaml',
            css: 'css',
            html: 'html',
        };
        return map[ext] || ext;
    }

    /**
     * Write files to disk
     */
    private async writeFiles(
        files: GeneratedFile[],
        options: GeneratorOptions
    ): Promise<GeneratedFile[]> {
        const written: GeneratedFile[] = [];

        for (const file of files) {
            const fullPath = resolve(this.rootDir, file.path);

            // Security: ensure path is within project root
            const normalizedPath = normalize(fullPath);
            if (!normalizedPath.startsWith(normalize(this.rootDir))) {
                console.warn(`Skipping file outside project root: ${file.path}`);
                continue;
            }

            // Create directory if needed
            const dir = dirname(fullPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }

            // Backup existing file if requested
            if (!file.isNew && options.backupBeforeOverwrite) {
                const backupPath = `${fullPath}.bak`;
                const existingContent = readFileSync(fullPath, 'utf-8');
                writeFileSync(backupPath, existingContent);
            }

            // Write file
            writeFileSync(fullPath, file.content, 'utf-8');
            written.push(file);
        }

        return written;
    }
}

/**
 * Factory function
 */
export function createAIGenerator(projectDir?: string): AIGenerator {
    return new AIGenerator(projectDir);
}
