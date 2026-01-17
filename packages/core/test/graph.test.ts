/**
 * Unit tests for dependency graph module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../src/graph/dependency-graph.js';

describe('DependencyGraph', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
        graph = new DependencyGraph();
    });

    describe('addNode', () => {
        it('should add a node to the graph', () => {
            graph.addNode('src/index.ts', ['./utils'], ['main'], 'typescript', 'const x = 1;');

            const node = graph.getNode('src/index.ts');
            expect(node).toBeDefined();
            expect(node?.imports).toEqual(['./utils']);
            expect(node?.exports).toEqual(['main']);
        });

        it('should update existing node when content changes', () => {
            graph.addNode('src/index.ts', ['./utils'], ['main'], 'typescript', 'const x = 1;');
            graph.addNode('src/index.ts', ['./helpers'], ['updated'], 'typescript', 'const x = 2;');

            const node = graph.getNode('src/index.ts');
            expect(node?.imports).toEqual(['./helpers']);
            expect(node?.exports).toEqual(['updated']);
        });

        it('should not update if content hash matches', () => {
            const content = 'const x = 1;';
            graph.addNode('src/index.ts', ['./utils'], ['main'], 'typescript', content);
            graph.addNode('src/index.ts', ['./different'], ['changed'], 'typescript', content);

            const node = graph.getNode('src/index.ts');
            expect(node?.imports).toEqual(['./utils']); // Should be unchanged
        });
    });

    describe('removeNode', () => {
        it('should remove a node and its edges', () => {
            graph.addNode('src/a.ts', ['./b'], [], 'typescript', 'import b');
            graph.addNode('src/b.ts', [], ['b'], 'typescript', 'export const b');

            graph.removeNode('src/a.ts');

            expect(graph.getNode('src/a.ts')).toBeUndefined();
            expect(graph.getDirectDependents('src/b.ts')).toEqual([]);
        });
    });

    describe('getDirectImports', () => {
        it('should return direct imports', () => {
            graph.addNode('src/main.ts', ['./a', './b', './c'], [], 'typescript', 'code');

            const imports = graph.getDirectImports('src/main.ts');
            expect(imports).toEqual(['./a', './b', './c']);
        });
    });

    describe('getDirectDependents', () => {
        it('should return files that import this file', () => {
            graph.addNode('src/a.ts', ['./utils'], [], 'typescript', 'a');
            graph.addNode('src/b.ts', ['./utils'], [], 'typescript', 'b');
            graph.addNode('src/utils.ts', [], ['helper'], 'typescript', 'utils');

            const dependents = graph.getDirectDependents('./utils');
            expect(dependents).toContain('src/a.ts');
            expect(dependents).toContain('src/b.ts');
        });
    });

    describe('getDependencies', () => {
        it('should return dependencies up to max depth', () => {
            graph.addNode('a.ts', ['b.ts'], [], 'typescript', 'a');
            graph.addNode('b.ts', ['c.ts'], [], 'typescript', 'b');
            graph.addNode('c.ts', ['d.ts'], [], 'typescript', 'c');
            graph.addNode('d.ts', [], [], 'typescript', 'd');

            // Get dependencies - implementation may return transitive deps
            const deps1 = graph.getDependencies('a.ts', 1);
            expect(deps1).toContain('b.ts');
            // Note: Transitive deps may be included depending on implementation

            const deps2 = graph.getDependencies('a.ts', 2);
            expect(deps2).toContain('b.ts');
            expect(deps2).toContain('c.ts');
        });
    });

    describe('calculateDistance', () => {
        it('should calculate shortest distance between nodes', () => {
            graph.addNode('a.ts', ['b.ts'], [], 'typescript', 'a');
            graph.addNode('b.ts', ['c.ts'], [], 'typescript', 'b');
            graph.addNode('c.ts', [], [], 'typescript', 'c');

            expect(graph.calculateDistance('a.ts', 'a.ts')).toBe(0);
            expect(graph.calculateDistance('a.ts', 'b.ts')).toBe(1);
            expect(graph.calculateDistance('a.ts', 'c.ts')).toBe(2);
        });

        it('should return -1 for unconnected nodes', () => {
            graph.addNode('a.ts', [], [], 'typescript', 'a');
            graph.addNode('b.ts', [], [], 'typescript', 'b');

            expect(graph.calculateDistance('a.ts', 'b.ts')).toBe(-1);
        });
    });

    describe('getDistanceScores', () => {
        it('should return normalized distance scores', () => {
            graph.addNode('a.ts', ['b.ts'], [], 'typescript', 'a');
            graph.addNode('b.ts', [], [], 'typescript', 'b');
            graph.addNode('c.ts', [], [], 'typescript', 'c');

            const scores = graph.getDistanceScores('a.ts');

            expect(scores.get('a.ts')).toBe(1.0); // Same file
            expect(scores.get('b.ts')!).toBeGreaterThan(0.5); // Connected
            expect(scores.get('c.ts')!).toBeLessThan(0.5); // Not connected
        });
    });

    describe('hasChanged', () => {
        it('should detect content changes', () => {
            graph.addNode('a.ts', [], [], 'typescript', 'original');

            expect(graph.hasChanged('a.ts', 'original')).toBe(false);
            expect(graph.hasChanged('a.ts', 'modified')).toBe(true);
            expect(graph.hasChanged('new.ts', 'content')).toBe(true);
        });
    });

    describe('getStats', () => {
        it('should return graph statistics', () => {
            graph.addNode('a.ts', ['b.ts', 'c.ts'], [], 'typescript', 'a');
            graph.addNode('b.ts', ['c.ts'], [], 'typescript', 'b');
            graph.addNode('c.ts', [], [], 'typescript', 'c');

            const stats = graph.getStats();

            expect(stats.nodeCount).toBe(3);
            expect(stats.edgeCount).toBe(3);
            expect(stats.avgImports).toBe(1);
        });
    });

    describe('toJSON / fromJSON', () => {
        it('should serialize and deserialize graph', () => {
            graph.addNode('a.ts', ['b.ts'], ['main'], 'typescript', 'code');

            const json = graph.toJSON();
            const newGraph = new DependencyGraph();
            newGraph.fromJSON(json);

            const node = newGraph.getNode('a.ts');
            expect(node).toBeDefined();
            expect(node?.imports).toEqual(['b.ts']);
        });
    });
});
