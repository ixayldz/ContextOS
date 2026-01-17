/**
 * Regex-Based Import Parser (Fallback)
 * Provides import extraction without Tree-sitter for all languages
 */

import type { SupportedLanguage } from '../types.js';

export interface RegexImport {
    source: string;
    specifiers: string[];
    type: 'import' | 'require' | 'type-import';
    line: number;
}

export interface RegexExport {
    name: string;
    type: 'default' | 'named' | 'all';
    line: number;
}

interface LanguagePatterns {
    imports: RegExp[];
    exports: RegExp[];
    functions: RegExp[];
    classes: RegExp[];
}

const PATTERNS: Record<string, LanguagePatterns> = {
    typescript: {
        imports: [
            /import\s+(?:type\s+)?(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        exports: [
            /export\s+(default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g,
            /export\s+\{([^}]+)\}/g,
        ],
        functions: [
            /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
            /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
        ],
        classes: [
            /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g,
        ],
    },
    javascript: {
        imports: [
            /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            /(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        exports: [
            /export\s+(default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
            /module\.exports\s*=\s*(\w+)/g,
        ],
        functions: [
            /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
            /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
        ],
        classes: [
            /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g,
        ],
    },
    python: {
        imports: [
            /^import\s+([\w.]+)/gm,
            /^from\s+([\w.]+)\s+import/gm,
        ],
        exports: [
            /__all__\s*=\s*\[([^\]]+)\]/g,
        ],
        functions: [
            /^(?:async\s+)?def\s+(\w+)\s*\(/gm,
        ],
        classes: [
            /^class\s+(\w+)(?:\([^)]*\))?:/gm,
        ],
    },
    go: {
        imports: [
            /import\s+"([^"]+)"/g,
            /import\s+\w+\s+"([^"]+)"/g,
            /import\s+\(\s*([^)]+)\s*\)/gs,
        ],
        exports: [], // Go uses capitalization for exports
        functions: [
            /func\s+(\w+)\s*\(/g,
            /func\s+\([^)]+\)\s+(\w+)\s*\(/g, // Methods
        ],
        classes: [
            /type\s+(\w+)\s+struct\s*\{/g,
            /type\s+(\w+)\s+interface\s*\{/g,
        ],
    },
    rust: {
        imports: [
            /use\s+([\w:]+)(?:::\{[^}]+\})?;/g,
            /extern\s+crate\s+(\w+)/g,
            /mod\s+(\w+);/g,
        ],
        exports: [
            /pub\s+(?:fn|struct|enum|trait|type|mod)\s+(\w+)/g,
        ],
        functions: [
            /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]+>)?\s*\(/g,
        ],
        classes: [
            /(?:pub\s+)?struct\s+(\w+)(?:<[^>]+>)?/g,
            /(?:pub\s+)?enum\s+(\w+)(?:<[^>]+>)?/g,
            /(?:pub\s+)?trait\s+(\w+)(?:<[^>]+>)?/g,
        ],
    },
    java: {
        imports: [
            /import\s+(?:static\s+)?([\w.]+(?:\.\*)?);/g,
        ],
        exports: [], // Java uses public modifier
        functions: [
            /(?:public|private|protected)?\s*(?:static\s+)?(?:[\w<>,\s]+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g,
        ],
        classes: [
            /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g,
            /(?:public\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+[\w,\s]+)?\s*\{/g,
            /(?:public\s+)?enum\s+(\w+)\s*\{/g,
        ],
    },
};

/**
 * Extract imports using regex patterns
 */
export function extractImportsRegex(code: string, language: SupportedLanguage): RegexImport[] {
    const patterns = PATTERNS[language];
    if (!patterns) return [];

    const imports: RegexImport[] = [];
    const lines = code.split('\n');

    for (const pattern of patterns.imports) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(code)) !== null) {
            const source = match[1]?.trim();
            if (!source) continue;

            // Handle Go multi-import blocks
            if (language === 'go' && source.includes('\n')) {
                const goImports = source.match(/"([^"]+)"/g);
                if (goImports) {
                    goImports.forEach(imp => {
                        imports.push({
                            source: imp.replace(/"/g, ''),
                            specifiers: [],
                            type: 'import',
                            line: findLineNumber(code, match.index),
                        });
                    });
                }
                continue;
            }

            imports.push({
                source,
                specifiers: [],
                type: language === 'typescript' && match[0].includes('type ')
                    ? 'type-import'
                    : match[0].includes('require')
                        ? 'require'
                        : 'import',
                line: findLineNumber(code, match.index),
            });
        }
    }

    return imports;
}

/**
 * Extract exports using regex patterns
 */
export function extractExportsRegex(code: string, language: SupportedLanguage): RegexExport[] {
    const patterns = PATTERNS[language];
    if (!patterns) return [];

    const exports: RegexExport[] = [];

    for (const pattern of patterns.exports) {
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(code)) !== null) {
            const isDefault = match[1]?.includes('default');
            const name = match[2] || match[1]?.replace('default', '').trim() || 'default';

            exports.push({
                name,
                type: isDefault ? 'default' : 'named',
                line: findLineNumber(code, match.index),
            });
        }
    }

    return exports;
}

/**
 * Extract function names
 */
export function extractFunctionsRegex(code: string, language: SupportedLanguage): string[] {
    const patterns = PATTERNS[language];
    if (!patterns) return [];

    const functions: string[] = [];

    for (const pattern of patterns.functions) {
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(code)) !== null) {
            const name = match[1];
            if (name && !functions.includes(name)) {
                functions.push(name);
            }
        }
    }

    return functions;
}

/**
 * Extract class/struct names
 */
export function extractClassesRegex(code: string, language: SupportedLanguage): string[] {
    const patterns = PATTERNS[language];
    if (!patterns) return [];

    const classes: string[] = [];

    for (const pattern of patterns.classes) {
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(code)) !== null) {
            const name = match[1];
            if (name && !classes.includes(name)) {
                classes.push(name);
            }
        }
    }

    return classes;
}

/**
 * Full regex-based parse result
 */
export function parseWithRegex(code: string, language: SupportedLanguage): {
    imports: RegexImport[];
    exports: RegexExport[];
    functions: string[];
    classes: string[];
} {
    return {
        imports: extractImportsRegex(code, language),
        exports: extractExportsRegex(code, language),
        functions: extractFunctionsRegex(code, language),
        classes: extractClassesRegex(code, language),
    };
}

// Helper to find line number from character index
function findLineNumber(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text[i] === '\n') line++;
    }
    return line;
}

/**
 * Check if language is supported by regex parser
 */
export function isLanguageSupported(language: string): boolean {
    return language in PATTERNS;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
    return Object.keys(PATTERNS);
}
