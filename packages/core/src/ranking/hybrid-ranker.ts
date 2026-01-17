/**
 * Hybrid Ranker
 * Combines vector similarity, graph distance, and manual rules for ranking
 */

import type {
    RelevanceScore,
    RankedFile,
    RankingWeights,
    VectorSearchResult,
    Constraint,
} from '../types.js';
import { VectorStore } from '../embedding/vector-store.js';
import { DependencyGraph } from '../graph/dependency-graph.js';

const DEFAULT_WEIGHTS: RankingWeights = {
    vector: 0.4,
    graph: 0.4,
    manual: 0.2,
};

export class HybridRanker {
    private vectorStore: VectorStore;
    private graph: DependencyGraph;
    private constraints: Constraint[];
    private weights: RankingWeights;

    constructor(
        vectorStore: VectorStore,
        graph: DependencyGraph,
        constraints: Constraint[] = [],
        weights: RankingWeights = DEFAULT_WEIGHTS
    ) {
        this.vectorStore = vectorStore;
        this.graph = graph;
        this.constraints = constraints;
        this.weights = weights;
    }

    /**
     * Rank files based on goal and optional target file
     */
    async rank(
        goal: string,
        targetFile?: string,
        limit: number = 20
    ): Promise<RankedFile[]> {
        // 1. Get vector search results
        const vectorResults = await this.vectorStore.search(goal, limit * 2);

        // 2. Get graph distance scores (if target file specified)
        const graphScores = targetFile
            ? this.graph.getDistanceScores(targetFile)
            : new Map<string, number>();

        // 3. Calculate manual rule boosts
        const ruleBoosts = this.calculateRuleBoosts(goal);

        // 4. Combine scores and group by file
        const fileScores = this.combineScores(vectorResults, graphScores, ruleBoosts);

        // 5. Resolve conflicts (Graph takes priority)
        const rankedFiles = this.resolveConflictsAndRank(fileScores, vectorResults);

        return rankedFiles.slice(0, limit);
    }

    /**
     * Calculate boosts based on manual rules
     */
    private calculateRuleBoosts(goal: string): Map<string, number> {
        const boosts = new Map<string, number>();
        const goalLower = goal.toLowerCase();

        for (const constraint of this.constraints) {
            // Check if goal relates to any constraint topics
            const related = constraint.related || [];
            for (const topic of related) {
                if (goalLower.includes(topic.toLowerCase())) {
                    // Boost files that match this constraint's context
                    boosts.set(constraint.rule, 0.3);
                }
            }
        }

        return boosts;
    }

    /**
     * Combine scores from all three sources
     */
    private combineScores(
        vectorResults: VectorSearchResult[],
        graphScores: Map<string, number>,
        ruleBoosts: Map<string, number>
    ): Map<string, { vector: number; graph: number; manual: number; chunks: VectorSearchResult[] }> {
        const fileScores = new Map<string, {
            vector: number;
            graph: number;
            manual: number;
            chunks: VectorSearchResult[];
        }>();

        // Group vector results by file
        for (const result of vectorResults) {
            const existing = fileScores.get(result.filePath);

            if (existing) {
                // Take max vector score for the file
                existing.vector = Math.max(existing.vector, result.score);
                existing.chunks.push(result);
            } else {
                fileScores.set(result.filePath, {
                    vector: result.score,
                    graph: graphScores.get(result.filePath) || 0.1,
                    manual: 0,
                    chunks: [result],
                });
            }
        }

        // Add graph-only files (files connected in graph but not in vector results)
        for (const [filePath, graphScore] of graphScores) {
            if (!fileScores.has(filePath) && graphScore > 0.5) {
                fileScores.set(filePath, {
                    vector: 0.1, // Minimal vector score
                    graph: graphScore,
                    manual: 0,
                    chunks: [],
                });
            }
        }

        // Apply rule boosts (affects all files equally for now)
        const maxBoost = Math.max(...Array.from(ruleBoosts.values()), 0);
        for (const scores of fileScores.values()) {
            scores.manual = maxBoost;
        }

        return fileScores;
    }

    /**
     * Resolve conflicts and calculate final rankings
     * Graph takes priority when vector and graph conflict
     */
    private resolveConflictsAndRank(
        fileScores: Map<string, { vector: number; graph: number; manual: number; chunks: VectorSearchResult[] }>,
        vectorResults: VectorSearchResult[]
    ): RankedFile[] {
        const rankedFiles: RankedFile[] = [];

        for (const [filePath, scores] of fileScores) {
            // Calculate weighted final score
            let finalScore =
                (scores.vector * this.weights.vector) +
                (scores.graph * this.weights.graph) +
                (scores.manual * this.weights.manual);

            // Conflict resolution: If graph says file is close but vector says it's not relevant,
            // trust the graph (code structure over semantic similarity)
            const hasConflict = scores.graph > 0.7 && scores.vector < 0.3;
            if (hasConflict) {
                // Boost graph contribution
                finalScore = (scores.graph * 0.6) + (scores.vector * 0.2) + (scores.manual * 0.2);
            }

            // Determine reason for inclusion
            let reason = 'semantic match';
            if (hasConflict) {
                reason = 'structural dependency (graph priority)';
            } else if (scores.graph > scores.vector) {
                reason = 'structural connection';
            } else if (scores.manual > 0) {
                reason = 'rule-based boost';
            }

            rankedFiles.push({
                path: filePath,
                score: {
                    vector: scores.vector,
                    graph: scores.graph,
                    manual: scores.manual,
                    final: finalScore,
                },
                chunks: scores.chunks,
                reason,
            });
        }

        // Sort by final score descending
        return rankedFiles.sort((a, b) => b.score.final - a.score.final);
    }

    /**
     * Update weights
     */
    setWeights(weights: Partial<RankingWeights>): void {
        this.weights = { ...this.weights, ...weights };

        // Normalize weights to sum to 1
        const total = this.weights.vector + this.weights.graph + this.weights.manual;
        this.weights.vector /= total;
        this.weights.graph /= total;
        this.weights.manual /= total;
    }

    /**
     * Update constraints
     */
    setConstraints(constraints: Constraint[]): void {
        this.constraints = constraints;
    }
}
