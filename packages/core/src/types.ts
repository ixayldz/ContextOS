/**
 * ContextOS Type Definitions
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ProjectConfig {
    name: string;
    language: SupportedLanguage;
    framework?: string;
    description?: string;
}

export interface StackConfig {
    database?: string;
    cache?: string;
    messaging?: string;
    monitoring?: string;
    [key: string]: string | undefined;
}

export interface Constraint {
    rule: string;
    severity: 'error' | 'warning' | 'info';
    autofix?: boolean;
    suggestion?: string;
    related?: string[];
}

export interface Boundary {
    name: string;
    allow: string[];
    deny: string[];
}

export interface ContextYaml {
    version: string;
    project: ProjectConfig;
    stack?: StackConfig;
    constraints?: Constraint[];
    boundaries?: Boundary[];
    meta?: {
        last_indexed: string;
        index_version: string;
        contributors?: number;
        total_files?: number;
    };
}

export interface ConfigYaml {
    indexing: {
        watch_mode: boolean;
        ignore_patterns: string[];
        file_size_limit?: string;
    };
    graph: {
        max_depth: number;
        follow_types: string[];
        include_types?: boolean;
    };
    embedding: {
        strategy: 'local' | 'cloud' | 'adaptive';
        provider: string;
        model: string;
        chunk_size?: number;
        overlap?: number;
    };
    budgeting: {
        strategy: 'auto' | 'fixed' | 'adaptive';
        target_model?: string;
    };
    analytics?: {
        enabled: boolean;
        anonymous_metrics: boolean;
        report_frequency?: string;
    };
}

// ============================================================================
// Language & Framework Types
// ============================================================================

export type SupportedLanguage =
    | 'typescript'
    | 'javascript'
    | 'python'
    | 'go'
    | 'rust'
    | 'java';

export interface DetectedProject {
    language: SupportedLanguage;
    framework?: string;
    packageManager?: string;
    entryPoints: string[];
    configFiles: string[];
}

// ============================================================================
// Graph Types
// ============================================================================

export interface GraphNode {
    id: string;
    path: string;
    imports: string[];
    exports: string[];
    hash: string;
    language: SupportedLanguage;
}

export interface GraphEdge {
    from: string;
    to: string;
    type: 'import' | 'require' | 'export' | 'type-import';
}

export interface DependencyGraphData {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    lastUpdated: string;
}

// ============================================================================
// Embedding Types
// ============================================================================

export interface CodeChunk {
    id: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    hash: string;
    type: 'function' | 'class' | 'module' | 'block';
}

export interface EmbeddingResult {
    chunkId: string;
    embedding: Float32Array;
}

export interface VectorSearchResult {
    chunkId: string;
    filePath: string;
    content: string;
    score: number;
    lines: [number, number];
}

// ============================================================================
// Ranking Types
// ============================================================================

export interface RelevanceScore {
    vector: number;
    graph: number;
    manual: number;
    final: number;
}

export interface RankedFile {
    path: string;
    score: RelevanceScore;
    chunks: VectorSearchResult[];
    reason: string;
}

export interface RankingWeights {
    vector: number;
    graph: number;
    manual: number;
}

// ============================================================================
// Budgeting Types
// ============================================================================

export interface BudgetAllocation {
    immutableCore: number;
    activeFocus: number;
    strategicContext: number;
    buffer: number;
}

export interface TokenBudgetResult {
    totalTokens: number;
    allocation: BudgetAllocation;
    files: PackedFile[];
    truncated: boolean;
    savings: {
        original: number;
        optimized: number;
        percentage: number;
    };
}

export interface PackedFile {
    path: string;
    content: string;
    tokens: number;
    segment: keyof BudgetAllocation;
}

// ============================================================================
// Context Types
// ============================================================================

export interface BuildOptions {
    goal?: string;
    targetFile?: string;
    maxTokens?: number;
    includeRules?: boolean;
    modelName?: string;
}

export interface BuiltContext {
    goal: string;
    files: RankedFile[];
    rules: Constraint[];
    tokenCount: number;
    savings: {
        original: number;
        optimized: number;
        percentage: number;
    };
    meta: {
        buildTime: number;
        filesAnalyzed: number;
        filesIncluded: number;
    };
}

// ============================================================================
// Doctor (Drift Detection) Types
// ============================================================================

export interface DriftIssue {
    type: 'database' | 'framework' | 'dependency' | 'constraint' | 'boundary';
    severity: 'error' | 'warning' | 'info';
    message: string;
    expected: string;
    actual: string;
    location?: {
        file: string;
        line?: number;
    };
    suggestion: string;
    autofix?: () => Promise<void>;
}

export interface DriftReport {
    errors: DriftIssue[];
    warnings: DriftIssue[];
    info: DriftIssue[];
    passed: number;
    timestamp: string;
}

// ============================================================================
// CLI Types
// ============================================================================

export interface InitOptions {
    template?: string;
    yes?: boolean;
    force?: boolean;
}

export interface IndexOptions {
    watch?: boolean;
    stats?: boolean;
    force?: boolean;
}

export interface BuildCommandOptions {
    goal?: string;
    maxTokens?: number;
    output?: 'clipboard' | 'file' | 'stdout';
    format?: 'markdown' | 'json' | 'plain';
}

export interface DoctorOptions {
    fix?: boolean;
    json?: boolean;
    ci?: boolean;
}
