/**
 * Blackboard System (Shared State)
 * 
 * Implements the expert recommendation for inter-agent communication
 * Allows agents to share discoveries and findings with each other
 */

/**
 * A fact is a piece of information discovered by an agent
 */
export interface Fact {
    id: string;
    type: 'discovery' | 'warning' | 'dependency' | 'pattern' | 'note';
    content: string;
    path?: string;           // Related file path
    symbol?: string;         // Related symbol name
    createdBy: string;       // Agent ID
    createdAt: Date;
    confidence: number;
    tags: string[];
    references: string[];    // Other fact IDs
}

/**
 * Query to search for facts
 */
export interface FactQuery {
    type?: Fact['type'];
    path?: string;
    symbol?: string;
    tags?: string[];
    minConfidence?: number;
    createdBy?: string;
}

/**
 * Blackboard for inter-agent communication
 * Implements the "Shared Memory" pattern from expert recommendations
 */
export class Blackboard {
    private facts: Map<string, Fact> = new Map();
    private pathIndex: Map<string, Set<string>> = new Map();
    private symbolIndex: Map<string, Set<string>> = new Map();
    private tagIndex: Map<string, Set<string>> = new Map();
    private typeIndex: Map<Fact['type'], Set<string>> = new Map();

    /**
     * Post a new fact to the blackboard
     */
    post(
        type: Fact['type'],
        content: string,
        createdBy: string,
        options: {
            path?: string;
            symbol?: string;
            confidence?: number;
            tags?: string[];
            references?: string[];
        } = {}
    ): Fact {
        const id = this.generateId();

        const fact: Fact = {
            id,
            type,
            content,
            path: options.path,
            symbol: options.symbol,
            createdBy,
            createdAt: new Date(),
            confidence: options.confidence ?? 0.8,
            tags: options.tags ?? [],
            references: options.references ?? [],
        };

        this.facts.set(id, fact);
        this.indexFact(fact);

        return fact;
    }

    /**
     * Query facts from the blackboard
     */
    query(q: FactQuery): Fact[] {
        let results: Fact[] = Array.from(this.facts.values());

        if (q.type) {
            const typeIds = this.typeIndex.get(q.type);
            if (typeIds) {
                results = results.filter(f => typeIds.has(f.id));
            } else {
                return [];
            }
        }

        if (q.path) {
            const pathIds = this.pathIndex.get(q.path);
            if (pathIds) {
                results = results.filter(f => pathIds.has(f.id));
            } else {
                return [];
            }
        }

        if (q.symbol) {
            const symbolIds = this.symbolIndex.get(q.symbol);
            if (symbolIds) {
                results = results.filter(f => symbolIds.has(f.id));
            } else {
                return [];
            }
        }

        if (q.tags && q.tags.length > 0) {
            results = results.filter(f =>
                q.tags!.some(tag => f.tags.includes(tag))
            );
        }

        if (q.minConfidence !== undefined) {
            results = results.filter(f => f.confidence >= q.minConfidence!);
        }

        if (q.createdBy) {
            results = results.filter(f => f.createdBy === q.createdBy);
        }

        // Sort by confidence descending, then by date
        return results.sort((a, b) => {
            if (b.confidence !== a.confidence) {
                return b.confidence - a.confidence;
            }
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }

    /**
     * Get a specific fact by ID
     */
    get(id: string): Fact | undefined {
        return this.facts.get(id);
    }

    /**
     * Get all facts for a specific file
     */
    getForPath(path: string): Fact[] {
        const ids = this.pathIndex.get(path);
        if (!ids) return [];
        return Array.from(ids).map(id => this.facts.get(id)!).filter(Boolean);
    }

    /**
     * Get all facts for a specific symbol
     */
    getForSymbol(symbol: string): Fact[] {
        const ids = this.symbolIndex.get(symbol);
        if (!ids) return [];
        return Array.from(ids).map(id => this.facts.get(id)!).filter(Boolean);
    }

    /**
     * Get all warnings (useful for safety checks)
     */
    getWarnings(): Fact[] {
        return this.query({ type: 'warning' });
    }

    /**
     * Get all discovered dependencies
     */
    getDependencies(): Fact[] {
        return this.query({ type: 'dependency' });
    }

    /**
     * Check if a specific warning exists
     */
    hasWarning(path: string, content: string): boolean {
        const warnings = this.getForPath(path).filter(f => f.type === 'warning');
        return warnings.some(w => w.content.includes(content));
    }

    /**
     * Get summary of all facts (for debugging/display)
     */
    getSummary(): {
        total: number;
        byType: Record<string, number>;
        byAgent: Record<string, number>;
        recentFacts: Fact[];
    } {
        const facts = Array.from(this.facts.values());

        const byType: Record<string, number> = {};
        const byAgent: Record<string, number> = {};

        for (const fact of facts) {
            byType[fact.type] = (byType[fact.type] || 0) + 1;
            byAgent[fact.createdBy] = (byAgent[fact.createdBy] || 0) + 1;
        }

        const recentFacts = facts
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10);

        return {
            total: facts.length,
            byType,
            byAgent,
            recentFacts,
        };
    }

    /**
     * Clear all facts (use with caution)
     */
    clear(): void {
        this.facts.clear();
        this.pathIndex.clear();
        this.symbolIndex.clear();
        this.tagIndex.clear();
        this.typeIndex.clear();
    }

    /**
     * Export all facts as JSON
     */
    export(): string {
        return JSON.stringify(Array.from(this.facts.values()), null, 2);
    }

    /**
     * Import facts from JSON
     */
    import(json: string): number {
        const facts: Fact[] = JSON.parse(json);
        let imported = 0;

        for (const fact of facts) {
            if (!this.facts.has(fact.id)) {
                fact.createdAt = new Date(fact.createdAt);
                this.facts.set(fact.id, fact);
                this.indexFact(fact);
                imported++;
            }
        }

        return imported;
    }

    // Private helpers
    private generateId(): string {
        return `fact_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    private indexFact(fact: Fact): void {
        // Type index
        if (!this.typeIndex.has(fact.type)) {
            this.typeIndex.set(fact.type, new Set());
        }
        this.typeIndex.get(fact.type)!.add(fact.id);

        // Path index
        if (fact.path) {
            if (!this.pathIndex.has(fact.path)) {
                this.pathIndex.set(fact.path, new Set());
            }
            this.pathIndex.get(fact.path)!.add(fact.id);
        }

        // Symbol index
        if (fact.symbol) {
            if (!this.symbolIndex.has(fact.symbol)) {
                this.symbolIndex.set(fact.symbol, new Set());
            }
            this.symbolIndex.get(fact.symbol)!.add(fact.id);
        }

        // Tag index
        for (const tag of fact.tags) {
            if (!this.tagIndex.has(tag)) {
                this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag)!.add(fact.id);
        }
    }
}

/**
 * Factory function
 */
export function createBlackboard(): Blackboard {
    return new Blackboard();
}

/**
 * Global blackboard instance (singleton pattern for cross-agent access)
 */
let globalBlackboard: Blackboard | null = null;

export function getGlobalBlackboard(): Blackboard {
    if (!globalBlackboard) {
        globalBlackboard = new Blackboard();
    }
    return globalBlackboard;
}

export function resetGlobalBlackboard(): void {
    globalBlackboard = null;
}
