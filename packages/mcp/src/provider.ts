/**
 * ContextOS Provider
 * Interfaces with @contextos/core to provide context to MCP clients
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Dynamic import for @contextos/core (may not be installed in all environments)
let core: typeof import('@contextos/core') | null = null;

async function loadCore() {
    if (core) return core;
    try {
        core = await import('@contextos/core');
        return core;
    } catch {
        return null;
    }
}

export class ContextOSProvider {
    private projectDir: string;
    private contextDir: string;
    private lastContext: string = '';

    constructor(projectDir?: string) {
        this.projectDir = projectDir || process.cwd();
        this.contextDir = join(this.projectDir, '.contextos');
    }

    /**
     * Check if ContextOS is initialized in the current directory
     */
    isInitialized(): boolean {
        return existsSync(this.contextDir);
    }

    /**
     * Build optimized context for a goal
     */
    async buildContext(goal: string): Promise<string> {
        const core = await loadCore();

        if (core) {
            try {
                const builder = await core.getContextBuilder();
                const result = await builder.build({ goal, maxTokens: 32000 });
                this.lastContext = result.context;
                return this.formatContext(goal, result);
            } catch (error) {
                // Fallback to simple context building
            }
        }

        // Fallback: Simple context building without full core
        return this.buildSimpleContext(goal);
    }

    /**
     * Analyze codebase with RLM
     */
    async analyze(query: string): Promise<string> {
        const core = await loadCore();

        if (core) {
            try {
                const engine = new core.RLMEngine({
                    maxDepth: 3,
                    maxTokenBudget: 50000,
                });

                // Note: Requires model adapter to be configured
                const result = await engine.execute(query, await this.getCurrentContext());
                return result.answer;
            } catch (error) {
                return `Analysis requires AI API key. Error: ${error instanceof Error ? error.message : String(error)}`;
            }
        }

        return 'Full analysis requires @contextos/core with AI API key configured.';
    }

    /**
     * Find files matching pattern
     */
    async findFiles(pattern: string): Promise<string> {
        const files = this.walkDirectory(this.projectDir, pattern);

        if (files.length === 0) {
            return `No files found matching pattern: ${pattern}`;
        }

        return `# Files matching "${pattern}"\n\n${files.map(f => `- ${f}`).join('\n')}`;
    }

    /**
     * Get dependencies of a file
     */
    async getDependencies(file: string, depth: number = 2): Promise<string> {
        const core = await loadCore();

        if (core) {
            try {
                const fullPath = join(this.projectDir, file);
                if (!existsSync(fullPath)) {
                    return `File not found: ${file}`;
                }

                const content = readFileSync(fullPath, 'utf-8');
                const result = core.parseWithRegex(content, this.detectLanguage(file));

                const deps = result.imports.map(i => i.source);
                return `# Dependencies of ${file}\n\n${deps.map(d => `- ${d}`).join('\n') || 'No imports found'}`;
            } catch (error) {
                // Fallback
            }
        }

        // Simple regex-based import extraction
        return this.extractImportsSimple(file);
    }

    /**
     * Explain a file
     */
    async explainFile(file: string): Promise<string> {
        const fullPath = join(this.projectDir, file);

        if (!existsSync(fullPath)) {
            return `File not found: ${file}`;
        }

        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        const core = await loadCore();

        let analysis = '';
        if (core) {
            try {
                const result = core.parseWithRegex(content, this.detectLanguage(file));
                analysis = `
## Structure

- **Functions**: ${result.functions.join(', ') || 'None'}
- **Classes**: ${result.classes.join(', ') || 'None'}
- **Imports**: ${result.imports.length} imports
`;
            } catch {
                // Fallback
            }
        }

        return `# ${file}

## Overview

- **Lines**: ${lines}
- **Language**: ${this.detectLanguage(file)}
${analysis}

## Content Preview

\`\`\`${this.detectLanguage(file)}
${content.slice(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }

    /**
     * Get current status
     */
    async getStatus(): Promise<string> {
        const initialized = this.isInitialized();

        let status = `# ContextOS Status\n\n`;
        status += `- **Project Directory**: ${this.projectDir}\n`;
        status += `- **Initialized**: ${initialized ? '✅ Yes' : '❌ No'}\n`;

        if (initialized) {
            const configPath = join(this.contextDir, 'context.yaml');
            if (existsSync(configPath)) {
                status += `- **Config**: context.yaml found\n`;
            }
        } else {
            status += `\n> Run \`ctx init\` to initialize ContextOS in this project.`;
        }

        return status;
    }

    /**
     * Get current context
     */
    async getCurrentContext(): Promise<string> {
        if (this.lastContext) {
            return this.lastContext;
        }

        // Try to load from cache
        const cachePath = join(this.contextDir, 'cache', 'last-context.md');
        if (existsSync(cachePath)) {
            return readFileSync(cachePath, 'utf-8');
        }

        return 'No context built yet. Use contextos_build tool first.';
    }

    /**
     * Get project info
     */
    async getProjectInfo(): Promise<string> {
        const configPath = join(this.contextDir, 'context.yaml');

        if (!existsSync(configPath)) {
            return JSON.stringify({
                error: 'ContextOS not initialized',
                suggestion: 'Run ctx init',
            }, null, 2);
        }

        const content = readFileSync(configPath, 'utf-8');

        // Parse YAML (simple extraction)
        const info: Record<string, string> = {};
        const lines = content.split('\n');

        for (const line of lines) {
            const match = line.match(/^\s*(name|language|framework|description):\s*["']?([^"'\n]+)["']?/);
            if (match) {
                info[match[1]] = match[2].trim();
            }
        }

        return JSON.stringify(info, null, 2);
    }

    /**
     * Get constraints
     */
    async getConstraints(): Promise<string> {
        const configPath = join(this.contextDir, 'context.yaml');

        if (!existsSync(configPath)) {
            return 'No constraints defined (ContextOS not initialized)';
        }

        const content = readFileSync(configPath, 'utf-8');

        // Extract constraints section
        const constraintsMatch = content.match(/constraints:\s*\n((?:\s+-[^\n]+\n?)+)/);

        if (!constraintsMatch) {
            return 'No constraints defined in context.yaml';
        }

        return `# Project Constraints\n\n${constraintsMatch[1]}`;
    }

    /**
     * Get project structure
     */
    async getProjectStructure(): Promise<string> {
        const tree = this.buildTree(this.projectDir, '', 0, 3);
        return `# Project Structure\n\n\`\`\`\n${tree}\`\`\``;
    }

    /**
     * Get file with dependencies
     */
    async getFileWithDeps(file: string): Promise<string> {
        const content = await this.explainFile(file);
        const deps = await this.getDependencies(file);
        return `${content}\n\n${deps}`;
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════

    private formatContext(goal: string, result: { context: string; files: string[]; tokens: number }): string {
        return `# Context for: ${goal}

## Statistics
- Files included: ${result.files.length}
- Total tokens: ~${result.tokens}

## Files
${result.files.map(f => `- ${f}`).join('\n')}

## Content

${result.context}
`;
    }

    private async buildSimpleContext(goal: string): Promise<string> {
        // Simple fallback: find files related to goal keywords
        const keywords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const files = this.walkDirectory(this.projectDir);

        const relevant = files.filter(file => {
            const lower = file.toLowerCase();
            return keywords.some(kw => lower.includes(kw));
        }).slice(0, 10);

        if (relevant.length === 0) {
            return `No files found related to: ${goal}\n\nTry running \`ctx index\` first.`;
        }

        let context = `# Context for: ${goal}\n\n`;

        for (const file of relevant) {
            const fullPath = join(this.projectDir, file);
            try {
                const content = readFileSync(fullPath, 'utf-8');
                context += `## ${file}\n\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\`\n\n`;
            } catch {
                // Skip unreadable files
            }
        }

        this.lastContext = context;
        return context;
    }

    private walkDirectory(dir: string, pattern?: string, maxFiles: number = 100): string[] {
        const results: string[] = [];
        const ignored = ['node_modules', '.git', 'dist', 'build', '.contextos', 'coverage'];

        const walk = (currentDir: string) => {
            if (results.length >= maxFiles) return;

            try {
                const entries = readdirSync(currentDir);

                for (const entry of entries) {
                    if (results.length >= maxFiles) break;
                    if (ignored.includes(entry)) continue;

                    const fullPath = join(currentDir, entry);
                    const relativePath = relative(this.projectDir, fullPath);

                    try {
                        const stat = statSync(fullPath);

                        if (stat.isDirectory()) {
                            walk(fullPath);
                        } else if (stat.isFile()) {
                            if (!pattern || this.matchPattern(relativePath, pattern)) {
                                results.push(relativePath);
                            }
                        }
                    } catch {
                        // Skip inaccessible
                    }
                }
            } catch {
                // Skip unreadable directories
            }
        };

        walk(dir);
        return results;
    }

    private matchPattern(path: string, pattern: string): boolean {
        // Simple glob matching
        const regex = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*');
        return new RegExp(regex).test(path);
    }

    private detectLanguage(file: string): string {
        const ext = file.split('.').pop()?.toLowerCase() || '';
        const langMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            py: 'python',
            go: 'go',
            rs: 'rust',
            java: 'java',
        };
        return langMap[ext] || ext;
    }

    private extractImportsSimple(file: string): string {
        const fullPath = join(this.projectDir, file);

        if (!existsSync(fullPath)) {
            return `File not found: ${file}`;
        }

        const content = readFileSync(fullPath, 'utf-8');
        const imports: string[] = [];

        // Common import patterns
        const patterns = [
            /import\s+.*from\s+['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /^import\s+([\w.]+)/gm,
            /^from\s+([\w.]+)\s+import/gm,
        ];

        // Fix R3: Add maximum iterations to prevent ReDoS
        const MAX_ITERATIONS = 1000;

        for (const pattern of patterns) {
            let match;
            let iterations = 0;
            while ((match = pattern.exec(content)) !== null && iterations < MAX_ITERATIONS) {
                if (match[1] && !imports.includes(match[1])) {
                    imports.push(match[1]);
                }
                iterations++;
            }
        }

        return `# Dependencies of ${file}\n\n${imports.map(i => `- ${i}`).join('\n') || 'No imports found'}`;
    }

    private buildTree(dir: string, prefix: string, depth: number, maxDepth: number): string {
        if (depth >= maxDepth) return '';

        const ignored = ['node_modules', '.git', 'dist', 'build', '.contextos', 'coverage', '__pycache__'];
        let result = '';

        try {
            const entries = readdirSync(dir).filter(e => !ignored.includes(e)).sort();

            for (let i = 0; i < entries.length && i < 20; i++) {
                const entry = entries[i];
                const isLast = i === entries.length - 1 || i === 19;
                const fullPath = join(dir, entry);

                try {
                    const stat = statSync(fullPath);
                    const connector = isLast ? '└── ' : '├── ';
                    result += `${prefix}${connector}${entry}${stat.isDirectory() ? '/' : ''}\n`;

                    if (stat.isDirectory()) {
                        const newPrefix = prefix + (isLast ? '    ' : '│   ');
                        result += this.buildTree(fullPath, newPrefix, depth + 1, maxDepth);
                    }
                } catch {
                    // Skip
                }
            }

            if (entries.length > 20) {
                result += `${prefix}└── ... (${entries.length - 20} more)\n`;
            }
        } catch {
            // Skip
        }

        return result;
    }
}
