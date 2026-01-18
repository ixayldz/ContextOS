/**
 * Context Query API
 * Provides programmatic access to context for RLM sandbox execution
 * Implements the "Context as External Environment" paradigm from MIT CSAIL RLM research
 */

import type { ContextQueryAPI, OutlineItem } from './types.js';

/**
 * Create a Context Query API instance for the given raw context
 * This API is injected into the sandbox and provides Python-like operations
 */
export function createContextAPI(rawContext: string): ContextQueryAPI {
    const lines = rawContext.split('\n');

    return {
        // === Basic Properties ===
        length: () => rawContext.length,
        lines: () => lines.length,

        // === Search Operations ===
        find: (needle: string) => rawContext.indexOf(needle),

        findAll: (needle: string) => {
            const indices: number[] = [];
            let idx = rawContext.indexOf(needle);
            while (idx !== -1) {
                indices.push(idx);
                idx = rawContext.indexOf(needle, idx + 1);
            }
            return indices;
        },

        search: (pattern: RegExp) => rawContext.match(pattern),

        grep: (pattern: string | RegExp) => {
            const regex = typeof pattern === 'string'
                ? new RegExp(pattern, 'gi')
                : pattern;

            const results: Array<{ line: number; content: string }> = [];
            lines.forEach((content, idx) => {
                if (regex.test(content)) {
                    results.push({ line: idx + 1, content });
                    regex.lastIndex = 0; // Reset for global regex
                }
            });
            return results;
        },

        // === Slicing Operations ===
        slice: (start: number, end?: number) => rawContext.slice(start, end),

        getLines: (startLine: number, endLine: number) => {
            const start = Math.max(1, startLine) - 1;
            const end = Math.min(lines.length, endLine);
            return lines.slice(start, end).join('\n');
        },

        head: (n: number) => lines.slice(0, n).join('\n'),

        tail: (n: number) => lines.slice(-n).join('\n'),

        // === Code-Specific Operations ===
        getFunction: (name: string) => {
            // Simple regex-based extraction (works for JS/TS/Python)
            const patterns = [
                // JavaScript/TypeScript: function name(...) or name = function(...) or name(...) {...}
                new RegExp(`(?:function\\s+${name}|(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s+)?function|${name}\\s*=\\s*\\([^)]*\\)\\s*=>|(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{)`, 'g'),
                // Python: def name(...)
                new RegExp(`def\\s+${name}\\s*\\(`, 'g'),
            ];

            for (const pattern of patterns) {
                for (let i = 0; i < lines.length; i++) {
                    if (pattern.test(lines[i])) {
                        // Find function boundaries
                        const startLine = i;
                        let endLine = i;
                        let braceCount = 0;
                        let inFunction = false;

                        for (let j = i; j < lines.length; j++) {
                            const line = lines[j];

                            // Count braces for JS/TS
                            for (const char of line) {
                                if (char === '{') {
                                    braceCount++;
                                    inFunction = true;
                                } else if (char === '}') {
                                    braceCount--;
                                }
                            }

                            endLine = j;

                            // Check for Python (indentation-based)
                            if (line.match(/^def\s/) && j > i) break;

                            // Check for JS/TS (brace matching)
                            if (inFunction && braceCount === 0) break;

                            // Safety limit
                            if (j - i > 200) break;
                        }

                        return lines.slice(startLine, endLine + 1).join('\n');
                    }
                    pattern.lastIndex = 0;
                }
            }
            return null;
        },

        getClass: (name: string) => {
            const patterns = [
                // JavaScript/TypeScript: class Name
                new RegExp(`class\\s+${name}(?:\\s+extends|\\s+implements|\\s*\\{)`, 'g'),
                // Python: class Name:
                new RegExp(`class\\s+${name}\\s*[:(]`, 'g'),
            ];

            for (const pattern of patterns) {
                for (let i = 0; i < lines.length; i++) {
                    if (pattern.test(lines[i])) {
                        const startLine = i;
                        let endLine = i;
                        let braceCount = 0;
                        let inClass = false;

                        for (let j = i; j < lines.length; j++) {
                            const line = lines[j];

                            for (const char of line) {
                                if (char === '{') {
                                    braceCount++;
                                    inClass = true;
                                } else if (char === '}') {
                                    braceCount--;
                                }
                            }

                            endLine = j;

                            // Python class detection
                            if (j > i && line.match(/^class\s/) && !line.match(/^\s/)) break;

                            if (inClass && braceCount === 0) break;
                            if (j - i > 500) break;
                        }

                        return lines.slice(startLine, endLine + 1).join('\n');
                    }
                    pattern.lastIndex = 0;
                }
            }
            return null;
        },

        getImports: () => {
            const imports: string[] = [];
            const importPatterns = [
                /^import\s+.+/,              // ES6 import
                /^from\s+.+\s+import\s+.+/,  // Python from import
                /^const\s+.+=\s*require\(/,   // CommonJS require
                /^require\s*\(/,              // require()
            ];

            for (const line of lines) {
                const trimmed = line.trim();
                for (const pattern of importPatterns) {
                    if (pattern.test(trimmed)) {
                        imports.push(trimmed);
                        break;
                    }
                }
            }
            return imports;
        },

        getExports: () => {
            const exports: string[] = [];
            const exportPatterns = [
                /^export\s+(default\s+)?(class|function|const|let|interface|type|enum)/,
                /^export\s*\{/,
                /^module\.exports\s*=/,
            ];

            for (const line of lines) {
                const trimmed = line.trim();
                for (const pattern of exportPatterns) {
                    if (pattern.test(trimmed)) {
                        exports.push(trimmed);
                        break;
                    }
                }
            }
            return exports;
        },

        getOutline: () => {
            const outline: OutlineItem[] = [];
            const patterns = {
                function: [
                    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
                    /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
                ],
                class: [
                    /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
                ],
                interface: [
                    /^(?:export\s+)?interface\s+(\w+)/,
                ],
                type: [
                    /^(?:export\s+)?type\s+(\w+)/,
                ],
            };

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check functions
                for (const pattern of patterns.function) {
                    const match = line.match(pattern);
                    if (match) {
                        outline.push({
                            type: 'function',
                            name: match[1],
                            signature: line.trim(),
                            startLine: i + 1,
                            endLine: i + 1, // Would need full parsing for accurate end
                        });
                        break;
                    }
                }

                // Check classes
                for (const pattern of patterns.class) {
                    const match = line.match(pattern);
                    if (match) {
                        outline.push({
                            type: 'class',
                            name: match[1],
                            signature: line.trim(),
                            startLine: i + 1,
                            endLine: i + 1,
                        });
                        break;
                    }
                }

                // Check interfaces
                for (const pattern of patterns.interface) {
                    const match = line.match(pattern);
                    if (match) {
                        outline.push({
                            type: 'interface',
                            name: match[1],
                            signature: line.trim(),
                            startLine: i + 1,
                            endLine: i + 1,
                        });
                        break;
                    }
                }

                // Check types
                for (const pattern of patterns.type) {
                    const match = line.match(pattern);
                    if (match) {
                        outline.push({
                            type: 'type',
                            name: match[1],
                            signature: line.trim(),
                            startLine: i + 1,
                            endLine: i + 1,
                        });
                        break;
                    }
                }
            }

            return outline;
        },

        // === Multi-file Context Operations ===
        listFiles: () => {
            // Multi-file contexts use format: === FILE: path/to/file.ts ===
            const fileMarkers = rawContext.match(/^={3,}\s*FILE:\s*(.+?)\s*={3,}$/gm);
            if (!fileMarkers) return [];
            return fileMarkers.map(m => {
                const match = m.match(/FILE:\s*(.+?)\s*=/);
                return match ? match[1].trim() : '';
            }).filter(Boolean);
        },

        getFile: (path: string) => {
            // Fix N10: ReDoS protection - limit path length and validate characters
            const MAX_PATH_LENGTH = 1000;
            if (path.length > MAX_PATH_LENGTH) {
                return null;
            }

            // Validate path contains only safe characters
            if (!/^[\w\-./\\]+$/.test(path)) {
                return null;
            }

            const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(
                `^={3,}\\s*FILE:\\s*${escapedPath}\\s*={3,}$([\\s\\S]*?)(?=^={3,}\\s*FILE:|$)`,
                'm'
            );
            const match = rawContext.match(pattern);
            return match ? match[1].trim() : null;
        },
    };
}

/**
 * Merge multiple file contents into a single context with file markers
 */
export function mergeFilesToContext(files: Array<{ path: string; content: string }>): string {
    return files
        .map(f => `=== FILE: ${f.path} ===\n${f.content}`)
        .join('\n\n');
}

/**
 * Split a merged context back into individual files
 */
export function splitContextToFiles(context: string): Array<{ path: string; content: string }> {
    const api = createContextAPI(context);
    const paths = api.listFiles();
    return paths.map(path => ({
        path,
        content: api.getFile(path) || '',
    }));
}
