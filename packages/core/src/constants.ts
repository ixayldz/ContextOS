/**
 * ContextOS Constants
 *
 * Centralized constants for magic numbers used across the codebase.
 * Improves maintainability and makes configuration easier.
 */

// ============================================================================
// RLM Engine Constants
// ============================================================================

/**
 * Default timeout for RLM execution (10 seconds)
 */
export const DEFAULT_TIMEOUT = 10000;

/**
 * Ratio for calculating sandbox timeout from total timeout
 */
export const SANDBOX_TIMEOUT_RATIO = 10;

/**
 * Maximum depth for recursive agent spawning
 */
export const DEFAULT_MAX_DEPTH = 5;

/**
 * Maximum number of iterations before forced termination
 */
export const DEFAULT_MAX_ITERATIONS = 20;

/**
 * Default token budget for RLM execution
 */
export const DEFAULT_TOKEN_BUDGET = 100000;

/**
 * Maximum number of visited paths to track (for loop detection)
 */
export const MAX_VISITED_PATHS = 50;

/**
 * Number of oldest entries to remove when cleanup is triggered
 */
export const PATH_CLEANUP_BATCH_SIZE = 10;

// ============================================================================
// Vector Store Constants
// ============================================================================

/**
 * Page size for vector search pagination
 */
export const VECTOR_PAGE_SIZE = 1000;

/**
 * Maximum path length for file operations (prevents ReDoS)
 */
export const MAX_PATH_LENGTH = 1000;

// ============================================================================
// File System Constants
// ============================================================================

/**
 * ContextOS directory name
 */
export const CONTEXTOS_DIR = '.contextos';

/**
 * Default database file name for vector store
 */
export const VECTOR_DB_FILE = 'db/vectors.db';

/**
 * Default graph file name for dependency graph
 */
export const GRAPH_FILE = 'db/graph.json';

/**
 * Default configuration file name
 */
export const CONFIG_FILE = 'config.yaml';

/**
 * Default context file name
 */
export const CONTEXT_FILE = 'context.yaml';

// ============================================================================
// Indexing Constants
// ============================================================================

/**
 * Default chunk size for code embedding (in tokens)
 */
export const DEFAULT_CHUNK_SIZE = 512;

/**
 * Default overlap between chunks (in tokens)
 */
export const DEFAULT_CHUNK_OVERLAP = 50;

/**
 * Default maximum depth for dependency graph traversal
 */
export const DEFAULT_GRAPH_MAX_DEPTH = 2;

/**
 * Maximum file size limit (default)
 */
export const DEFAULT_FILE_SIZE_LIMIT = '1MB';

// ============================================================================
// Token Budgeting Constants
// ============================================================================

/**
 * Average characters per token for code (rough approximation)
 * Code is denser than natural text, so ~4 chars per token
 */
export const CHARS_PER_TOKEN_CODE = 4;

/**
 * Average characters per token for natural text
 */
export const CHARS_PER_TOKEN_TEXT = 3;

// ============================================================================
// Git Constants
// ============================================================================

/**
 * Maximum buffer size for git command output (1MB)
 */
export const GIT_MAX_BUFFER = 1024 * 1024;

/**
 * Default timeout for git commands (5 seconds)
 */
export const GIT_COMMAND_TIMEOUT = 5000;

// ============================================================================
// Error Constants
// ============================================================================

/**
 * Maximum error message length to prevent log spam
 */
export const MAX_ERROR_MESSAGE_LENGTH = 1000;

/**
 * Maximum stack trace lines to include in error output
 */
export const MAX_STACK_TRACE_LINES = 20;

// ============================================================================
// Cache Size Limits
// ============================================================================

/**
 * Maximum number of compiled regex patterns to cache
 */
export const MAX_REGEX_CACHE_SIZE = 1000;

/**
 * Maximum number of parser instances to cache
 */
export const MAX_PARSER_CACHE_SIZE = 10;
