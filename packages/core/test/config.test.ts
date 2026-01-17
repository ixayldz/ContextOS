/**
 * Unit tests for config module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
    ContextYamlSchema,
    ConfigYamlSchema,
    SupportedLanguageSchema,
} from '../src/config/schema.js';
import {
    loadContextYaml,
    loadConfigYaml,
    saveContextYaml,
    findContextosRoot,
    isInitialized,
} from '../src/config/loader.js';

describe('Config Schema', () => {
    describe('SupportedLanguageSchema', () => {
        it('should accept valid languages', () => {
            expect(SupportedLanguageSchema.parse('typescript')).toBe('typescript');
            expect(SupportedLanguageSchema.parse('python')).toBe('python');
            expect(SupportedLanguageSchema.parse('go')).toBe('go');
        });

        it('should reject invalid languages', () => {
            expect(() => SupportedLanguageSchema.parse('invalid')).toThrow();
        });
    });

    describe('ContextYamlSchema', () => {
        it('should parse valid context.yaml', () => {
            const result = ContextYamlSchema.parse({
                version: '3.1',
                project: {
                    name: 'test-project',
                    language: 'typescript',
                },
            });

            expect(result.version).toBe('3.1');
            expect(result.project.name).toBe('test-project');
            expect(result.project.language).toBe('typescript');
        });

        it('should apply default values', () => {
            const result = ContextYamlSchema.parse({
                project: {
                    name: 'test',
                    language: 'typescript',
                },
            });

            expect(result.version).toBe('3.1');
            expect(result.constraints).toEqual([]);
            expect(result.boundaries).toEqual([]);
        });

        it('should parse constraints', () => {
            const result = ContextYamlSchema.parse({
                project: { name: 'test', language: 'typescript' },
                constraints: [
                    { rule: 'No console.log', severity: 'error' },
                ],
            });

            expect(result.constraints).toHaveLength(1);
            expect(result.constraints[0].rule).toBe('No console.log');
            expect(result.constraints[0].severity).toBe('error');
        });
    });

    describe('ConfigYamlSchema', () => {
        it('should parse valid config.yaml', () => {
            const result = ConfigYamlSchema.parse({
                indexing: {
                    watch_mode: true,
                },
                embedding: {
                    model: 'all-MiniLM-L6-v2',
                },
            });

            expect(result.indexing.watch_mode).toBe(true);
            expect(result.embedding.model).toBe('all-MiniLM-L6-v2');
        });

        it('should apply default values', () => {
            const result = ConfigYamlSchema.parse({});

            expect(result.indexing.watch_mode).toBe(true);
            expect(result.graph.max_depth).toBe(2);
            expect(result.embedding.strategy).toBe('adaptive');
            expect(result.budgeting.strategy).toBe('adaptive');
        });
    });
});

describe('Config Loader', () => {
    const testDir = join(tmpdir(), `contextos-test-${Date.now()}`);
    const contextosDir = join(testDir, '.contextos');

    beforeEach(() => {
        mkdirSync(contextosDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('findContextosRoot', () => {
        it('should find .contextos directory', () => {
            const result = findContextosRoot(testDir);
            expect(result).toBe(testDir);
        });

        it('should return null if not found', () => {
            const result = findContextosRoot(tmpdir());
            expect(result).toBeNull();
        });
    });

    describe('isInitialized', () => {
        it('should return true when initialized', () => {
            expect(isInitialized(testDir)).toBe(true);
        });

        it('should return false when not initialized', () => {
            rmSync(contextosDir, { recursive: true });
            expect(isInitialized(testDir)).toBe(false);
        });
    });

    describe('loadContextYaml', () => {
        it('should load valid context.yaml', () => {
            const contextPath = join(contextosDir, 'context.yaml');
            writeFileSync(contextPath, `
version: "3.1"
project:
  name: test
  language: typescript
`);

            const result = loadContextYaml(testDir);
            expect(result.project.name).toBe('test');
            expect(result.project.language).toBe('typescript');
        });
    });

    describe('loadConfigYaml', () => {
        it('should load valid config.yaml', () => {
            const configPath = join(contextosDir, 'config.yaml');
            writeFileSync(configPath, `
indexing:
  watch_mode: false
`);

            const result = loadConfigYaml(testDir);
            expect(result.indexing.watch_mode).toBe(false);
        });

        it('should return defaults if file missing', () => {
            const result = loadConfigYaml(testDir);
            expect(result.indexing.watch_mode).toBe(true);
        });
    });

    describe('saveContextYaml', () => {
        it('should save context.yaml', () => {
            const context = {
                version: '3.1',
                project: { name: 'saved', language: 'python' as const },
                stack: {},
                constraints: [],
                boundaries: [],
            };

            saveContextYaml(testDir, context);

            const loaded = loadContextYaml(testDir);
            expect(loaded.project.name).toBe('saved');
            expect(loaded.project.language).toBe('python');
        });
    });
});
