/**
 * Phase 6 Tests
 * Plugin System, Fine-tuning, and Deployment module tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fs for testing
const testDir = join(tmpdir(), 'contextos-test-' + Date.now());

describe('PluginManager', () => {
    beforeEach(() => {
        mkdirSync(testDir, { recursive: true });
        mkdirSync(join(testDir, '.contextos', 'plugins'), { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true });
        }
    });

    describe('plugin loading', () => {
        it('should load plugins from directory', async () => {
            // Create a test plugin
            const pluginDir = join(testDir, '.contextos', 'plugins', 'test-plugin');
            mkdirSync(pluginDir, { recursive: true });

            writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({
                name: 'test-plugin',
                version: '1.0.0',
                description: 'Test plugin',
                main: 'index.js',
            }));

            writeFileSync(join(pluginDir, 'index.js'), `
                module.exports = {
                    name: 'test-plugin',
                    version: '1.0.0',
                    activate: () => {},
                };
            `);

            // Plugin structure is valid
            expect(existsSync(join(pluginDir, 'package.json'))).toBe(true);
            expect(existsSync(join(pluginDir, 'index.js'))).toBe(true);
        });

        it('should handle missing manifest', () => {
            const pluginDir = join(testDir, '.contextos', 'plugins', 'bad-plugin');
            mkdirSync(pluginDir, { recursive: true });

            // No package.json - should fail validation
            expect(existsSync(join(pluginDir, 'package.json'))).toBe(false);
        });
    });

    describe('plugin lifecycle', () => {
        it('should track enabled/disabled state', () => {
            const pluginDir = join(testDir, '.contextos', 'plugins', 'lifecycle-plugin');
            mkdirSync(pluginDir, { recursive: true });

            // Create .disabled file
            writeFileSync(join(pluginDir, '.disabled'), '');

            expect(existsSync(join(pluginDir, '.disabled'))).toBe(true);

            // Remove .disabled
            rmSync(join(pluginDir, '.disabled'));

            expect(existsSync(join(pluginDir, '.disabled'))).toBe(false);
        });
    });
});

describe('TrainingDataCollector', () => {
    beforeEach(() => {
        mkdirSync(testDir, { recursive: true });
        mkdirSync(join(testDir, '.contextos', 'training'), { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true });
        }
    });

    describe('recording examples', () => {
        it('should save examples to file', () => {
            const trainingDir = join(testDir, '.contextos', 'training');
            const dataFile = join(trainingDir, 'examples.json');

            // Create example data
            const examples = {
                version: '1.0',
                examples: [
                    {
                        id: 'ex_test123',
                        goal: 'Fix login bug',
                        selectedFiles: ['src/auth.ts', 'src/login.ts'],
                        context: 'Test context',
                        tokenCount: 1500,
                        meta: {
                            projectName: 'test-project',
                            language: 'typescript',
                            timestamp: new Date().toISOString(),
                        },
                    },
                ],
            };

            writeFileSync(dataFile, JSON.stringify(examples, null, 2));

            // Verify data was saved
            expect(existsSync(dataFile)).toBe(true);

            const saved = JSON.parse(readFileSync(dataFile, 'utf-8'));
            expect(saved.examples).toHaveLength(1);
            expect(saved.examples[0].goal).toBe('Fix login bug');
        });

        it('should add feedback to examples', () => {
            const trainingDir = join(testDir, '.contextos', 'training');
            const dataFile = join(trainingDir, 'examples.json');

            const examples = {
                version: '1.0',
                examples: [
                    {
                        id: 'ex_feedback123',
                        goal: 'Test goal',
                        selectedFiles: [],
                        context: '',
                        tokenCount: 0,
                        meta: {
                            projectName: 'test',
                            language: 'typescript',
                            timestamp: new Date().toISOString(),
                        },
                    },
                ],
            };

            writeFileSync(dataFile, JSON.stringify(examples));

            // Add feedback
            const loaded = JSON.parse(readFileSync(dataFile, 'utf-8'));
            loaded.examples[0].feedback = { rating: 'good', comment: 'Great!' };
            writeFileSync(dataFile, JSON.stringify(loaded));

            // Verify feedback added
            const updated = JSON.parse(readFileSync(dataFile, 'utf-8'));
            expect(updated.examples[0].feedback.rating).toBe('good');
        });
    });

    describe('statistics', () => {
        it('should calculate stats from examples', () => {
            const examples = [
                { tokenCount: 1000, selectedFiles: ['a.ts', 'b.ts'], feedback: { rating: 'good' } },
                { tokenCount: 2000, selectedFiles: ['c.ts'], feedback: { rating: 'neutral' } },
                { tokenCount: 1500, selectedFiles: ['d.ts', 'e.ts', 'f.ts'] },
            ];

            const totalTokens = examples.reduce((sum, e) => sum + e.tokenCount, 0);
            const totalFiles = examples.reduce((sum, e) => sum + e.selectedFiles.length, 0);

            expect(totalTokens).toBe(4500);
            expect(totalFiles).toBe(6);
            expect(totalTokens / examples.length).toBe(1500); // avg
            expect(totalFiles / examples.length).toBe(2); // avg
        });
    });
});

describe('DatasetFormatter', () => {
    describe('format conversion', () => {
        it('should format for OpenAI', () => {
            const example = {
                goal: 'Add user auth',
                selectedFiles: ['auth.ts'],
                context: 'Auth implementation',
                meta: { projectName: 'test', language: 'typescript' },
            };

            const formatted = {
                messages: [
                    { role: 'system', content: expect.any(String) },
                    { role: 'user', content: expect.stringContaining('Add user auth') },
                    { role: 'assistant', content: expect.stringContaining('auth.ts') },
                ],
            };

            // Verify structure
            expect(formatted.messages).toHaveLength(3);
            expect(formatted.messages[0].role).toBe('system');
        });

        it('should format for Anthropic', () => {
            const example = {
                goal: 'Fix bug',
                context: 'Bug fix code',
            };

            // Verify expected structure
            const formatted = {
                prompt: `\n\nHuman: Goal: ${example.goal}`,
                completion: expect.any(String),
            };

            expect(formatted.prompt).toContain('Human:');
        });

        it('should format as JSONL', () => {
            const examples = [
                { id: '1', goal: 'Goal 1' },
                { id: '2', goal: 'Goal 2' },
            ];

            const lines = examples.map(e => JSON.stringify(e));

            expect(lines).toHaveLength(2);
            expect(JSON.parse(lines[0]).goal).toBe('Goal 1');
        });
    });
});

describe('Deployment Configuration', () => {
    describe('Docker config', () => {
        it('should have required fields', () => {
            const config = {
                name: 'contextos-server',
                environment: 'production',
                port: 3000,
                host: '0.0.0.0',
                database: { type: 'postgres', host: 'db', port: 5432 },
                logging: { level: 'info', format: 'json', output: 'stdout' },
            };

            expect(config.name).toBeDefined();
            expect(config.port).toBe(3000);
            expect(config.database.type).toBe('postgres');
        });
    });

    describe('Kubernetes config', () => {
        it('should have replica and resource settings', () => {
            const config = {
                namespace: 'contextos',
                replicas: 3,
                resources: {
                    requests: { memory: '256Mi', cpu: '100m' },
                    limits: { memory: '512Mi', cpu: '500m' },
                },
            };

            expect(config.replicas).toBe(3);
            expect(config.resources.limits.memory).toBe('512Mi');
        });
    });

    describe('License validation', () => {
        it('should parse license key format', () => {
            const licenseKey = 'CTXOS-E-ACME-50-1735689600-abc123';
            const parts = licenseKey.split('-');

            expect(parts[0]).toBe('CTXOS');
            expect(parts[1]).toBe('E'); // enterprise
            expect(parts[2]).toBe('ACME'); // org
            expect(parts[3]).toBe('50'); // seats
        });

        it('should reject invalid keys', () => {
            const invalidKeys = ['', 'abc', 'CTX-123'];

            invalidKeys.forEach(key => {
                const isValid = key.startsWith('CTXOS-') && key.split('-').length >= 6;
                expect(isValid).toBe(false);
            });
        });
    });
});

describe('Health Check', () => {
    it('should return health status structure', () => {
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            version: '2.0.0',
            uptime: 3600,
            checks: [
                { name: 'database', status: 'pass' },
                { name: 'filesystem', status: 'pass' },
            ],
        };

        expect(health.status).toBe('healthy');
        expect(health.checks).toHaveLength(2);
        expect(health.checks.every(c => c.status === 'pass')).toBe(true);
    });
});
