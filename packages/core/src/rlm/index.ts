/**
 * RLM Module Exports
 * Recursive Language Model execution engine for ContextOS
 */

// Types
export * from './types.js';

// Context API
export { createContextAPI, mergeFilesToContext, splitContextToFiles } from './context-api.js';

// Sandbox
export {
    type Sandbox,
    LocalSandbox,
    createSandbox,
    createSandboxContext,
    prepareSandboxVariables,
    validateCode,
} from './sandbox.js';

// Prompts
export {
    RLM_BASE_SYSTEM_PROMPT,
    MODEL_SPECIFIC_ADDENDUM,
    generateSystemPrompt,
    createInitialUserMessage,
    createObservationMessage,
    createSubAgentResultMessage,
} from './prompts.js';

// Engine
export { RLMEngine, createRLMEngine } from './engine.js';

// Proposal System (Transaction Layer)
export {
    type FileChange,
    type Proposal,
    type ConflictInfo,
    type ValidationResult,
    ProposalManager,
    createProposalManager,
} from './proposal.js';

// Blackboard (Shared State)
export {
    type Fact,
    type FactQuery,
    Blackboard,
    createBlackboard,
    getGlobalBlackboard,
    resetGlobalBlackboard,
} from './blackboard.js';

// Scope Manager (Anti-Indexing)
export {
    type ScopeRule,
    type ScopeCondition,
    type ActiveScope,
    ScopeManager,
    createScopeManager,
} from './scope.js';

// Watchdog (Process Safety)
export {
    type WatchdogConfig,
    type WatchdogState,
    type WatchdogReport,
    Watchdog,
    createWatchdog,
} from './watchdog.js';
