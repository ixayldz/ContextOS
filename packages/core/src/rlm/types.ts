/**
 * RLM (Recursive Language Model) Type Definitions
 * Based on MIT CSAIL RLM research (arXiv:2512.24601)
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface RLMConfig {
    /** Maximum recursive depth for sub-agent spawning (default: 5) */
    maxDepth: number;

    /** Total token budget for entire execution (default: 100000) */
    maxTokenBudget: number;

    /** Execution timeout in milliseconds (default: 300000 = 5 min) */
    timeoutMs: number;

    /** Allow recursive sub-agent calls (default: true) */
    enableSubAgents: boolean;

    /** Maximum iterations in agent loop before forced termination (default: 20) */
    maxIterations: number;

    /** Enable verbose logging for debugging (default: false) */
    verbose: boolean;

    /** Model adapter to use (default: 'gemini') */
    backend: 'gemini' | 'openai' | 'anthropic' | 'local';

    /** Backend-specific options */
    backendOptions?: Record<string, unknown>;

    /** Sandbox environment type (default: 'local') */
    environment: 'local' | 'docker' | 'modal';
}

export const DEFAULT_RLM_CONFIG: RLMConfig = {
    maxDepth: 5,
    maxTokenBudget: 100000,
    timeoutMs: 300000,
    enableSubAgents: true,
    maxIterations: 20,
    verbose: false,
    backend: 'gemini',
    environment: 'local',
};

// ============================================================================
// State Types
// ============================================================================

export interface RLMState {
    /** Current recursion depth (0 = root agent) */
    depth: number;

    /** Tokens consumed so far */
    consumedTokens: number;

    /** Visited paths for loop prevention */
    visitedPaths: Set<string>;

    /** Execution log for debugging and audit */
    executionLog: ExecutionEntry[];

    /** Current iteration count */
    iteration: number;

    /** Start time for timeout tracking */
    startTime: number;
}

export interface ExecutionEntry {
    /** Timestamp of this entry */
    timestamp: string;

    /** Type of action taken */
    action: 'code' | 'query' | 'recurse' | 'observe' | 'final';

    /** Input to this action */
    input: string;

    /** Output from this action */
    output: string;

    /** Tokens used for this action */
    tokensUsed: number;

    /** Duration in milliseconds */
    durationMs: number;

    /** Error if any */
    error?: string;
}

// ============================================================================
// Result Types
// ============================================================================

export interface RLMResult {
    /** The final answer/response */
    answer: string;

    /** Confidence score (0-1) */
    confidence: number;

    /** Complete execution path for debugging */
    executionPath: ExecutionEntry[];

    /** Total tokens consumed */
    totalTokens: number;

    /** Time taken in milliseconds */
    durationMs: number;

    /** Sub-agent results if any */
    subAgentResults?: RLMResult[];

    /** Whether execution was truncated due to limits */
    truncated: boolean;

    /** Reason for truncation if applicable */
    truncationReason?: 'depth' | 'budget' | 'timeout' | 'iterations';
}

// ============================================================================
// Sandbox Types
// ============================================================================

export interface SandboxResult {
    /** Whether execution succeeded */
    success: boolean;

    /** Output/return value */
    output: string;

    /** Console output (stdout) */
    stdout: string;

    /** Error message if failed */
    error?: string;

    /** Execution time in ms */
    durationMs: number;

    /** Variables modified/created */
    variables?: Record<string, unknown>;
}

export interface SandboxContext {
    /** The raw context string (full codebase/document) */
    context: string;

    /** Context Query API methods */
    ctx: ContextQueryAPI;

    /** RLM recursive call (injected by engine) */
    rlm?: {
        completion: (prompt: string, subContext?: string) => Promise<RLMResult>;
    };
}

// ============================================================================
// Context Query API Types
// ============================================================================

export interface ContextQueryAPI {
    // === Basic Properties ===
    /** Get total length of context in characters */
    length: () => number;

    /** Get total number of lines */
    lines: () => number;

    // === Search Operations ===
    /** Find first occurrence of needle, returns index or -1 */
    find: (needle: string) => number;

    /** Find all occurrences, returns array of indices */
    findAll: (needle: string) => number[];

    /** Search with regex, returns matches or null */
    search: (pattern: RegExp) => RegExpMatchArray | null;

    /** Grep-like search, returns matching lines with line numbers */
    grep: (pattern: string | RegExp) => Array<{ line: number; content: string }>;

    // === Slicing Operations ===
    /** Get substring by character indices */
    slice: (start: number, end?: number) => string;

    /** Get lines by line numbers (1-indexed, inclusive) */
    getLines: (startLine: number, endLine: number) => string;

    /** Get first N lines */
    head: (n: number) => string;

    /** Get last N lines */
    tail: (n: number) => string;

    // === Code-Specific Operations ===
    /** Extract a function by name (AST-aware) */
    getFunction: (name: string) => string | null;

    /** Extract a class by name (AST-aware) */
    getClass: (name: string) => string | null;

    /** Get all import statements */
    getImports: () => string[];

    /** Get all exported symbols */
    getExports: () => string[];

    /** Get file outline (functions, classes, their signatures) - Structure Peeking */
    getOutline: () => OutlineItem[];

    // === File System Operations (for multi-file contexts) ===
    /** List files if context contains multiple files */
    listFiles: () => string[];

    /** Get content of a specific file */
    getFile: (path: string) => string | null;
}

export interface OutlineItem {
    type: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type';
    name: string;
    signature: string;
    startLine: number;
    endLine: number;
    children?: OutlineItem[];
}

// ============================================================================
// Model Adapter Types (for unified LLM interface)
// ============================================================================

export interface ModelAdapter {
    /** Adapter name identifier */
    readonly name: string;

    /** Maximum context tokens supported */
    readonly maxContextTokens: number;

    /** Send a completion request */
    complete(request: CompletionRequest): Promise<CompletionResponse>;

    /** Count tokens in text */
    countTokens(text: string): Promise<number>;
}

export interface CompletionRequest {
    /** System prompt */
    systemPrompt: string;

    /** User message */
    userMessage: string;

    /** Temperature (0-2, default 0.7) */
    temperature?: number;

    /** Max tokens to generate */
    maxTokens?: number;

    /** Stop sequences */
    stopSequences?: string[];
}

export interface CompletionResponse {
    /** Generated content */
    content: string;

    /** Token usage breakdown */
    tokensUsed: {
        prompt: number;
        completion: number;
        total: number;
    };

    /** Why generation stopped */
    finishReason: 'stop' | 'length' | 'error';

    /** Error message if finishReason is 'error' */
    error?: string;
}

// ============================================================================
// Agent Action Types
// ============================================================================

export type AgentAction =
    | { type: 'code'; code: string }
    | { type: 'recurse'; subGoal: string; subContext: string }
    | { type: 'answer'; answer: string; confidence: number };

export interface StepResult {
    /** The action that was taken */
    action: AgentAction;

    /** Observation from the environment */
    observation: string;

    /** Whether this was the final step */
    isFinal: boolean;

    /** Tokens used in this step */
    tokensUsed: number;
}

// ============================================================================
// Logger Types
// ============================================================================

export interface RLMLogger {
    /** Log an execution step */
    logStep(entry: ExecutionEntry, depth: number): void;

    /** Log sub-agent spawn */
    logSpawn(parentId: string, childId: string, goal: string): void;

    /** Get full execution tree */
    getTree(): ExecutionTree;

    /** Export to JSONL format */
    exportJSONL(): string;
}

export interface ExecutionTree {
    id: string;
    goal: string;
    entries: ExecutionEntry[];
    children: ExecutionTree[];
    result?: RLMResult;
}
