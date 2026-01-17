/**
 * Dependency Graph
 * Builds and manages the import/export relationship graph between files
 */

import { createHash } from 'crypto';
import type { GraphNode, GraphEdge, DependencyGraphData } from '../types.js';

export class DependencyGraph {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: GraphEdge[] = [];
    private lastUpdated: string = new Date().toISOString();

    /**
     * Add or update a file node in the graph
     */
    addNode(
        path: string,
        imports: string[],
        exports: string[],
        language: GraphNode['language'],
        content: string
    ): void {
        const hash = createHash('md5').update(content).digest('hex');

        const existingNode = this.nodes.get(path);
        if (existingNode && existingNode.hash === hash) {
            // File hasn't changed, skip
            return;
        }

        // Remove old edges for this file
        this.edges = this.edges.filter(e => e.from !== path);

        // Create or update node
        const node: GraphNode = {
            id: path,
            path,
            imports,
            exports,
            hash,
            language,
        };
        this.nodes.set(path, node);

        // Add new edges
        for (const imp of imports) {
            this.edges.push({
                from: path,
                to: imp,
                type: 'import',
            });
        }

        this.lastUpdated = new Date().toISOString();
    }

    /**
     * Remove a file from the graph
     */
    removeNode(path: string): void {
        this.nodes.delete(path);
        this.edges = this.edges.filter(e => e.from !== path && e.to !== path);
        this.lastUpdated = new Date().toISOString();
    }

    /**
     * Get a node by path
     */
    getNode(path: string): GraphNode | undefined {
        return this.nodes.get(path);
    }

    /**
     * Get all nodes
     */
    getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get direct dependencies of a file (files it imports)
     */
    getDirectImports(path: string): string[] {
        return this.edges
            .filter(e => e.from === path)
            .map(e => e.to);
    }

    /**
     * Get direct dependents of a file (files that import it)
     */
    getDirectDependents(path: string): string[] {
        return this.edges
            .filter(e => e.to === path)
            .map(e => e.from);
    }

    /**
     * Get all dependencies up to a certain depth
     */
    getDependencies(path: string, maxDepth: number = 2): string[] {
        const visited = new Set<string>();
        const result: string[] = [];

        const visit = (currentPath: string, depth: number): void => {
            if (depth > maxDepth || visited.has(currentPath)) return;
            visited.add(currentPath);

            const imports = this.getDirectImports(currentPath);
            for (const imp of imports) {
                if (!visited.has(imp)) {
                    result.push(imp);
                    visit(imp, depth + 1);
                }
            }
        };

        visit(path, 0);
        return result;
    }

    /**
     * Calculate the shortest distance between two nodes
     * Returns -1 if no path exists
     */
    calculateDistance(from: string, to: string): number {
        if (from === to) return 0;

        const visited = new Set<string>();
        const queue: [string, number][] = [[from, 0]];

        while (queue.length > 0) {
            const [current, distance] = queue.shift()!;

            if (current === to) {
                return distance;
            }

            if (visited.has(current)) continue;
            visited.add(current);

            // Check both directions (imports and dependents)
            const neighbors = [
                ...this.getDirectImports(current),
                ...this.getDirectDependents(current),
            ];

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push([neighbor, distance + 1]);
                }
            }
        }

        return -1; // No path found
    }

    /**
     * Calculate normalized distance scores for all files relative to a target
     */
    getDistanceScores(targetPath: string): Map<string, number> {
        const scores = new Map<string, number>();
        const maxDistance = 5; // Normalize distances beyond this

        for (const node of this.nodes.values()) {
            const distance = this.calculateDistance(targetPath, node.path);

            if (distance === -1) {
                // No connection, minimal score
                scores.set(node.path, 0.1);
            } else if (distance === 0) {
                // Same file
                scores.set(node.path, 1.0);
            } else {
                // Normalize: closer files get higher scores
                const normalizedScore = Math.max(0.1, 1 - (distance / maxDistance));
                scores.set(node.path, normalizedScore);
            }
        }

        return scores;
    }

    /**
     * Check if content has changed (for incremental indexing)
     */
    hasChanged(path: string, content: string): boolean {
        const hash = createHash('md5').update(content).digest('hex');
        const existingNode = this.nodes.get(path);
        return !existingNode || existingNode.hash !== hash;
    }

    /**
     * Serialize graph to JSON
     */
    toJSON(): DependencyGraphData {
        return {
            nodes: this.nodes,
            edges: this.edges,
            lastUpdated: this.lastUpdated,
        };
    }

    /**
     * Deserialize graph from JSON
     */
    fromJSON(data: DependencyGraphData): void {
        this.nodes = new Map(data.nodes);
        this.edges = data.edges;
        this.lastUpdated = data.lastUpdated;
    }

    /**
     * Get graph statistics
     */
    getStats(): {
        nodeCount: number;
        edgeCount: number;
        avgImports: number;
        lastUpdated: string;
    } {
        const nodeCount = this.nodes.size;
        const edgeCount = this.edges.length;
        const avgImports = nodeCount > 0
            ? edgeCount / nodeCount
            : 0;

        return {
            nodeCount,
            edgeCount,
            avgImports: Math.round(avgImports * 100) / 100,
            lastUpdated: this.lastUpdated,
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.nodes.clear();
        this.edges = [];
        this.lastUpdated = new Date().toISOString();
    }
}
