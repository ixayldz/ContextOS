/**
 * Context Builder
 * Orchestrates all modules to build the final LLM context
 */

import { readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';
import { stringify } from 'yaml';
import type {
    BuiltContext,
    BuildOptions,
} from '../types.js';
import { loadConfig, type LoadedConfig } from '../config/loader.js';
import { getParser } from '../parser/tree-sitter.js';
import { getLanguageExtensions } from '../parser/detector.js';
import { DependencyGraph } from '../graph/dependency-graph.js';
import { VectorStore } from '../embedding/vector-store.js';
import { chunkCode } from '../embedding/chunker.js';
import { HybridRanker } from '../ranking/hybrid-ranker.js';
import { TokenBudget } from '../budgeting/token-budget.js';
import { GeminiClient, createGeminiClient, isGeminiAvailable } from '../llm/gemini-client.js';

const CONTEXTOS_DIR = '.contextos';
const DB_FILE = 'db/vectors.db';
const GRAPH_FILE = 'db/graph.json';

export class ContextBuilder {
    private config: LoadedConfig | null = null;
    private graph: DependencyGraph;
    private vectorStore: VectorStore | null = null;
    private ranker: HybridRanker | null = null;
    private budget: TokenBudget;
    private gemini: GeminiClient | null = null;
    private initialized: boolean = false;

    constructor() {
        this.graph = new DependencyGraph();
        this.budget = new TokenBudget();
    }

    /**
     * Initialize the context builder for a project
     */
    async initialize(projectDir: string = process.cwd()): Promise<void> {
        if (this.initialized) return;

        // Load configuration
        this.config = loadConfig(projectDir);

        // Initialize vector store
        const dbPath = join(this.config.rootDir, CONTEXTOS_DIR, DB_FILE);
        this.vectorStore = new VectorStore(dbPath);
        await this.vectorStore.initialize();

        // Load existing graph if available
        const graphPath = join(this.config.rootDir, CONTEXTOS_DIR, GRAPH_FILE);
        if (existsSync(graphPath)) {
            const graphData = JSON.parse(readFileSync(graphPath, 'utf-8'));
            this.graph.fromJSON(graphData);
        }

        // Initialize ranker
        this.ranker = new HybridRanker(
            this.vectorStore,
            this.graph,
            this.config.context.constraints
        );

        // Set budget model
        if (this.config.config.budgeting.target_model) {
            this.budget.setModel(this.config.config.budgeting.target_model);
        }

        // Initialize Gemini client if API key is available
        if (isGeminiAvailable()) {
            this.gemini = createGeminiClient();
        }

        this.initialized = true;
    }

    /**
     * Index the project (or update index)
     */
    async index(force: boolean = false): Promise<{
        filesIndexed: number;
        chunksCreated: number;
        timeMs: number;
    }> {
        if (!this.config || !this.vectorStore) {
            throw new Error('ContextBuilder not initialized');
        }

        const startTime = Date.now();
        const { rootDir, config, context } = this.config;
        const extensions = getLanguageExtensions(context.project.language);

        // Find all source files
        const patterns = extensions.map(ext => `**/*${ext}`);
        const ignorePatterns = config.indexing.ignore_patterns;

        const files = await glob(patterns, {
            cwd: rootDir,
            ignore: ignorePatterns,
            absolute: true,
        });

        let filesIndexed = 0;
        let chunksCreated = 0;

        const parser = await getParser();

        for (const filePath of files) {
            try {
                const content = readFileSync(filePath, 'utf-8');
                const relativePath = relative(rootDir, filePath);

                // Check if file has changed
                if (!force && !this.graph.hasChanged(relativePath, content)) {
                    continue;
                }

                // Parse file for imports/exports
                const parseResult = parser.parse(content, context.project.language);

                // Update dependency graph
                const imports = parseResult.imports.map(i => i.source);
                const exports = parseResult.exports.map(e => e.name);
                this.graph.addNode(relativePath, imports, exports, context.project.language, content);

                // Chunk and embed
                const chunks = chunkCode(relativePath, content, {
                    chunkSize: config.embedding.chunk_size,
                    overlap: config.embedding.overlap,
                });

                await this.vectorStore.addChunks(chunks);
                chunksCreated += chunks.length;
                filesIndexed++;
            } catch (error) {
                console.warn(`Warning: Failed to index ${filePath}:`, error);
            }
        }

        // Save graph
        const graphPath = join(rootDir, CONTEXTOS_DIR, GRAPH_FILE);
        const graphDir = join(rootDir, CONTEXTOS_DIR, 'db');
        if (!existsSync(graphDir)) {
            const { mkdirSync } = await import('fs');
            mkdirSync(graphDir, { recursive: true });
        }
        const { writeFileSync } = await import('fs');
        writeFileSync(graphPath, JSON.stringify(this.graph.toJSON(), null, 2));

        return {
            filesIndexed,
            chunksCreated,
            timeMs: Date.now() - startTime,
        };
    }

    /**
     * Build context for a goal
     */
    async build(options: BuildOptions): Promise<BuiltContext> {
        if (!this.config || !this.ranker) {
            throw new Error('ContextBuilder not initialized');
        }

        const startTime = Date.now();
        const goal = options.goal || await this.inferGoal();
        const maxTokens = options.maxTokens || this.budget.getModelLimit();

        // Rank files
        const rankedFiles = await this.ranker.rank(goal, options.targetFile);

        // Get core content
        const coreContent = this.getCoreContent();

        // Get rules
        const rules = options.includeRules !== false
            ? this.config.context.constraints || []
            : [];

        // Pack into token budget
        const packed = this.budget.packContext(rankedFiles, coreContent, rules, maxTokens);

        return {
            goal,
            files: rankedFiles.filter(f => packed.files.some(p => p.path === f.path)),
            rules,
            tokenCount: packed.totalTokens,
            savings: packed.savings,
            meta: {
                buildTime: Date.now() - startTime,
                filesAnalyzed: rankedFiles.length,
                filesIncluded: packed.files.length,
            },
        };
    }

    /**
     * Infer goal from git diff, enhanced with Gemini when available
     */
    private async inferGoal(): Promise<string> {
        let gitDiff = '';
        let recentFiles: string[] = [];

        try {
            const { execSync } = await import('child_process');

            // Get staged files
            const staged = execSync('git diff --cached --name-only', {
                cwd: this.config?.rootDir,
                encoding: 'utf-8',
            });
            recentFiles = staged.trim().split('\n').filter(Boolean);

            // If no staged files, check working directory
            if (recentFiles.length === 0) {
                const uncommitted = execSync('git diff --name-only', {
                    cwd: this.config?.rootDir,
                    encoding: 'utf-8',
                });
                recentFiles = uncommitted.trim().split('\n').filter(Boolean);
            }

            // Get actual diff content for Gemini analysis
            if (recentFiles.length > 0) {
                gitDiff = execSync('git diff --cached', {
                    cwd: this.config?.rootDir,
                    encoding: 'utf-8',
                    maxBuffer: 1024 * 1024, // 1MB max
                });

                if (!gitDiff) {
                    gitDiff = execSync('git diff', {
                        cwd: this.config?.rootDir,
                        encoding: 'utf-8',
                        maxBuffer: 1024 * 1024,
                    });
                }
            }
        } catch {
            // Git not available or not a git repo
        }

        // If no changes detected
        if (recentFiles.length === 0) {
            return 'General development context';
        }

        // Use Gemini for smart goal inference if available
        if (this.gemini && gitDiff) {
            try {
                const projectContext = this.config?.context.project.description ||
                    `${this.config?.context.project.name} - ${this.config?.context.project.language}`;

                const result = await this.gemini.inferGoal(gitDiff, projectContext, recentFiles);

                if (result.confidence > 0.5) {
                    return result.goal;
                }
            } catch (error) {
                console.warn('Gemini goal inference failed, using fallback:', error);
            }
        }

        // Fallback to simple file-based goal
        return `Modifying: ${recentFiles.slice(0, 5).join(', ')}${recentFiles.length > 5 ? ` (+${recentFiles.length - 5} more)` : ''}`;
    }

    /**
     * Get core context content (context.yaml summary)
     */
    private getCoreContent(): string {
        if (!this.config) return '';

        const { context } = this.config;
        return stringify({
            project: context.project,
            stack: context.stack,
            rules: context.constraints?.slice(0, 5).map(c => c.rule),
        });
    }

    /**
     * Format built context as a prompt-ready string
     */
    formatForLLM(context: BuiltContext): string {
        let output = '# Project Context\n\n';
        output += `**Goal:** ${context.goal}\n\n`;

        // Add rules
        if (context.rules.length > 0) {
            output += '## Coding Rules\n\n';
            for (const rule of context.rules) {
                const icon = rule.severity === 'error' ? '🚫' : '⚠️';
                output += `${icon} ${rule.rule}\n`;
            }
            output += '\n';
        }

        // Add files
        output += '## Relevant Files\n\n';
        for (const file of context.files) {
            output += `### ${file.path}\n\n`;
            for (const chunk of file.chunks) {
                output += '```\n';
                output += chunk.content;
                output += '\n```\n\n';
            }
        }

        // Add summary
        output += '---\n\n';
        output += `*Context: ${context.tokenCount} tokens | `;
        output += `${context.files.length} files | `;
        output += `${context.savings.percentage}% token savings*\n`;

        return output;
    }

    /**
     * Get statistics
     */
    getStats(): {
        graph: ReturnType<DependencyGraph['getStats']>;
        vectors: ReturnType<VectorStore['getStats']>;
    } | null {
        if (!this.vectorStore) return null;

        return {
            graph: this.graph.getStats(),
            vectors: this.vectorStore.getStats(),
        };
    }

    /**
     * Close resources
     */
    close(): void {
        this.vectorStore?.close();
        this.initialized = false;
    }
}

// Singleton instance
let builderInstance: ContextBuilder | null = null;

export async function getContextBuilder(projectDir?: string): Promise<ContextBuilder> {
    if (!builderInstance) {
        builderInstance = new ContextBuilder();
        await builderInstance.initialize(projectDir);
    }
    return builderInstance;
}
