/**
 * Tree-sitter AST Parser
 * Parses code to extract imports, exports, and structural information
 */

import Parser from 'web-tree-sitter';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { SupportedLanguage } from '../types.js';

// Get the directory for WASM files
const __dirname = dirname(fileURLToPath(import.meta.url));

interface ParseResult {
    imports: ImportInfo[];
    exports: ExportInfo[];
    functions: FunctionInfo[];
    classes: ClassInfo[];
}

interface ImportInfo {
    source: string;
    specifiers: string[];
    type: 'import' | 'require' | 'type-import';
    line: number;
}

interface ExportInfo {
    name: string;
    type: 'default' | 'named' | 'all';
    line: number;
}

interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    isAsync: boolean;
    isExported: boolean;
}

interface ClassInfo {
    name: string;
    startLine: number;
    endLine: number;
    methods: string[];
    isExported: boolean;
}

export class ASTParser {
    private parser: Parser | null = null;
    private languages: Map<string, Parser.Language> = new Map();
    private initialized: boolean = false;

    /**
     * Initialize Tree-sitter and load language grammars
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await Parser.init();
        this.parser = new Parser();

        // Load language grammars
        // In production, these would be loaded from node_modules or bundled
        const languagesToLoad: SupportedLanguage[] = ['typescript', 'javascript', 'python'];

        for (const lang of languagesToLoad) {
            try {
                // Try to load from common locations
                const wasmPath = this.findWasmFile(lang);
                if (wasmPath) {
                    const language = await Parser.Language.load(wasmPath);
                    this.languages.set(lang, language);
                }
            } catch (error) {
                console.warn(`Warning: Could not load Tree-sitter grammar for ${lang}`);
            }
        }

        this.initialized = true;
    }

    private findWasmFile(language: string): string | null {
        // Common locations for Tree-sitter WASM files
        const possiblePaths = [
            join(__dirname, `../../grammars/tree-sitter-${language}.wasm`),
            join(__dirname, `../../../node_modules/tree-sitter-${language}/tree-sitter-${language}.wasm`),
            `tree-sitter-${language}.wasm`,
        ];

        for (const path of possiblePaths) {
            try {
                readFileSync(path);
                return path;
            } catch {
                continue;
            }
        }

        return null;
    }

    /**
     * Check if a language is supported
     */
    hasLanguage(language: SupportedLanguage): boolean {
        return this.languages.has(language);
    }

    /**
     * Parse source code and extract structural information
     */
    parse(code: string, language: SupportedLanguage): ParseResult {
        if (!this.parser) {
            throw new Error('Parser not initialized. Call initialize() first.');
        }

        const lang = this.languages.get(language);
        if (!lang) {
            // Return empty result for unsupported languages (graceful degradation)
            return { imports: [], exports: [], functions: [], classes: [] };
        }

        this.parser.setLanguage(lang);
        const tree = this.parser.parse(code);

        const result: ParseResult = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
        };

        // Extract information based on language
        switch (language) {
            case 'typescript':
            case 'javascript':
                this.extractTypeScriptInfo(tree.rootNode, result);
                break;
            case 'python':
                this.extractPythonInfo(tree.rootNode, result);
                break;
            default:
                // For other languages, try generic extraction
                this.extractGenericInfo(tree.rootNode, result);
        }

        return result;
    }

    /**
     * Parse a file and return structural information
     */
    async parseFile(filePath: string, language: SupportedLanguage): Promise<ParseResult> {
        const code = readFileSync(filePath, 'utf-8');
        return this.parse(code, language);
    }

    /**
     * Extract imports, exports, functions, and classes from TypeScript/JavaScript
     */
    private extractTypeScriptInfo(node: Parser.SyntaxNode, result: ParseResult): void {
        const cursor = node.walk();

        const visit = (): boolean => {
            const currentNode = cursor.currentNode;

            switch (currentNode.type) {
                case 'import_statement': {
                    const source = currentNode.childForFieldName('source')?.text.slice(1, -1) || '';
                    const specifiers: string[] = [];

                    // Extract named imports
                    const clause = currentNode.children.find(c => c.type === 'import_clause');
                    if (clause) {
                        clause.descendantsOfType('identifier').forEach(id => {
                            specifiers.push(id.text);
                        });
                    }

                    result.imports.push({
                        source,
                        specifiers,
                        type: currentNode.text.includes('type ') ? 'type-import' : 'import',
                        line: currentNode.startPosition.row + 1,
                    });
                    break;
                }

                case 'export_statement': {
                    const declaration = currentNode.childForFieldName('declaration');
                    if (declaration) {
                        const name = declaration.childForFieldName('name')?.text || 'default';
                        result.exports.push({
                            name,
                            type: currentNode.text.includes('default') ? 'default' : 'named',
                            line: currentNode.startPosition.row + 1,
                        });
                    }
                    break;
                }

                case 'function_declaration':
                case 'arrow_function':
                case 'function': {
                    const name = currentNode.childForFieldName('name')?.text || '<anonymous>';
                    result.functions.push({
                        name,
                        startLine: currentNode.startPosition.row + 1,
                        endLine: currentNode.endPosition.row + 1,
                        isAsync: currentNode.text.startsWith('async'),
                        isExported: currentNode.parent?.type === 'export_statement',
                    });
                    break;
                }

                case 'class_declaration': {
                    const name = currentNode.childForFieldName('name')?.text || '<anonymous>';
                    const methods = currentNode.descendantsOfType('method_definition').map(m =>
                        m.childForFieldName('name')?.text || '<anonymous>'
                    );
                    result.classes.push({
                        name,
                        startLine: currentNode.startPosition.row + 1,
                        endLine: currentNode.endPosition.row + 1,
                        methods,
                        isExported: currentNode.parent?.type === 'export_statement',
                    });
                    break;
                }
            }

            // Visit children
            if (cursor.gotoFirstChild()) {
                do {
                    visit();
                } while (cursor.gotoNextSibling());
                cursor.gotoParent();
            }

            return true;
        };

        visit();
    }

    /**
     * Extract imports, exports, functions, and classes from Python
     */
    private extractPythonInfo(node: Parser.SyntaxNode, result: ParseResult): void {
        const cursor = node.walk();

        const visit = (): boolean => {
            const currentNode = cursor.currentNode;

            switch (currentNode.type) {
                case 'import_statement': {
                    const name = currentNode.childForFieldName('name');
                    if (name) {
                        result.imports.push({
                            source: name.text,
                            specifiers: [],
                            type: 'import',
                            line: currentNode.startPosition.row + 1,
                        });
                    }
                    break;
                }

                case 'import_from_statement': {
                    const module = currentNode.childForFieldName('module_name')?.text || '';
                    const specifiers = currentNode.descendantsOfType('dotted_name').map(n => n.text);
                    result.imports.push({
                        source: module,
                        specifiers: specifiers.slice(1), // First one is the module itself
                        type: 'import',
                        line: currentNode.startPosition.row + 1,
                    });
                    break;
                }

                case 'function_definition': {
                    const name = currentNode.childForFieldName('name')?.text || '<anonymous>';
                    result.functions.push({
                        name,
                        startLine: currentNode.startPosition.row + 1,
                        endLine: currentNode.endPosition.row + 1,
                        isAsync: currentNode.text.startsWith('async'),
                        isExported: true, // Python doesn't have explicit exports
                    });
                    break;
                }

                case 'class_definition': {
                    const name = currentNode.childForFieldName('name')?.text || '<anonymous>';
                    const methods = currentNode.descendantsOfType('function_definition').map(m =>
                        m.childForFieldName('name')?.text || '<anonymous>'
                    );
                    result.classes.push({
                        name,
                        startLine: currentNode.startPosition.row + 1,
                        endLine: currentNode.endPosition.row + 1,
                        methods,
                        isExported: true,
                    });
                    break;
                }
            }

            if (cursor.gotoFirstChild()) {
                do {
                    visit();
                } while (cursor.gotoNextSibling());
                cursor.gotoParent();
            }

            return true;
        };

        visit();
    }

    /**
     * Generic extraction for unsupported languages
     */
    private extractGenericInfo(_node: Parser.SyntaxNode, _result: ParseResult): void {
        // For unsupported languages, we don't extract structural info
        // The file will still be indexed as text-only
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.parser?.delete();
        this.parser = null;
        this.languages.clear();
        this.initialized = false;
    }
}

// Singleton instance with promise locking to prevent race condition (Fix R5)
let parserInstance: ASTParser | null = null;
let initializationPromise: Promise<ASTParser> | null = null;

export async function getParser(): Promise<ASTParser> {
    // Fast path: already initialized
    if (parserInstance) {
        return parserInstance;
    }

    // Slow path: initialize with promise locking
    if (!initializationPromise) {
        initializationPromise = (async () => {
            try {
                const instance = new ASTParser();
                await instance.initialize();
                parserInstance = instance;
                return instance;
            } catch (error) {
                // Clear promise on failure to allow retry
                initializationPromise = null;
                throw error;
            }
        })();
    }

    return initializationPromise;
}

/**
 * Reset the parser singleton (useful for testing)
 */
export function resetParser(): void {
    parserInstance = null;
    initializationPromise = null;
}
