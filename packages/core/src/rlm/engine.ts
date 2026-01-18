/**
 * RLM Engine
 * Core recursive language model execution engine
 * Implements the MIT CSAIL RLM "Agent Loop" paradigm
 */

import type {
    RLMConfig,
    RLMState,
    RLMResult,
    ExecutionEntry,
    AgentAction,
    ModelAdapter,
    CompletionResponse,
} from './types.js';
import { DEFAULT_RLM_CONFIG } from './types.js';
import { createSandbox, prepareSandboxVariables, validateCode, type Sandbox } from './sandbox.js';
import { createContextAPI } from './context-api.js';
import {
    generateSystemPrompt,
    createInitialUserMessage,
    createObservationMessage,
    createSubAgentResultMessage,
} from './prompts.js';

/**
 * RLM Engine - Main entry point for recursive language model execution
 */
export class RLMEngine {
    private config: RLMConfig;
    private sandbox: Sandbox;
    private modelAdapter: ModelAdapter | null = null;
    private executionId: string;

    constructor(options: Partial<RLMConfig> = {}) {
        this.config = { ...DEFAULT_RLM_CONFIG, ...options };
        this.sandbox = createSandbox(this.config.environment, {
            timeout: Math.min(10000, this.config.timeoutMs / 10),
        });
        this.executionId = this.generateExecutionId();
    }

    /**
     * Set the model adapter for completions
     */
    setModelAdapter(adapter: ModelAdapter): void {
        this.modelAdapter = adapter;
    }

    /**
     * Main entry point - execute a goal against context
     */
    async execute(goal: string, context: string, depth: number = 0): Promise<RLMResult> {
        if (!this.modelAdapter) {
            throw new Error('Model adapter not set. Call setModelAdapter() first.');
        }

        const startTime = Date.now();

        // Initialize state
        const state: RLMState = {
            depth,
            consumedTokens: 0,
            visitedPaths: new Map<string, number>(), // Changed to Map with timestamps for memory leak fix
            executionLog: [],
            iteration: 0,
            startTime,
        };

        // Check depth limit
        if (depth >= this.config.maxDepth) {
            return this.createTruncatedResult(state, 'depth', startTime);
        }

        // Prepare context info for initial message
        const ctx = createContextAPI(context);
        const contextInfo = {
            length: ctx.length(),
            lines: ctx.lines(),
            files: ctx.listFiles(),
        };

        // Prepare sandbox variables with rlm.completion for recursion
        const sandboxVars = prepareSandboxVariables(context, {
            rlm: {
                completion: async (subGoal: string, subContext?: string) => {
                    if (!this.config.enableSubAgents) {
                        throw new Error('Sub-agent spawning is disabled');
                    }
                    return this.execute(
                        subGoal,
                        subContext || context,
                        depth + 1
                    );
                },
            },
        });

        // Build conversation
        const systemPrompt = generateSystemPrompt(
            this.getModelType(),
            `Execution ID: ${this.executionId}\nDepth: ${depth}/${this.config.maxDepth}`
        );

        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
            { role: 'user', content: createInitialUserMessage(goal, contextInfo) },
        ];

        // Agent loop
        while (state.iteration < this.config.maxIterations) {
            state.iteration++;

            // Check timeout
            if (Date.now() - startTime > this.config.timeoutMs) {
                return this.createTruncatedResult(state, 'timeout', startTime);
            }

            // Check budget
            if (state.consumedTokens >= this.config.maxTokenBudget) {
                return this.createTruncatedResult(state, 'budget', startTime);
            }

            // Get model response
            const stepStart = Date.now();
            let response: CompletionResponse;

            try {
                response = await this.modelAdapter.complete({
                    systemPrompt,
                    userMessage: messages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
                    temperature: 0.7,
                    maxTokens: 4000,
                });
            } catch (error) {
                const errorEntry: ExecutionEntry = {
                    timestamp: new Date().toISOString(),
                    action: 'query',
                    input: 'LLM request',
                    output: '',
                    tokensUsed: 0,
                    durationMs: Date.now() - stepStart,
                    error: error instanceof Error ? error.message : String(error),
                };
                state.executionLog.push(errorEntry);
                return this.createErrorResult(state, errorEntry.error!, startTime);
            }

            state.consumedTokens += response.tokensUsed.total;

            // Parse the response to determine action
            const action = this.parseAction(response.content);

            // Log the step
            const entry: ExecutionEntry = {
                timestamp: new Date().toISOString(),
                action: action.type === 'answer' ? 'final' : action.type === 'code' ? 'code' : 'recurse',
                input: response.content.slice(0, 500),
                output: '',
                tokensUsed: response.tokensUsed.total,
                durationMs: Date.now() - stepStart,
            };

            // Execute the action
            if (action.type === 'answer') {
                entry.output = action.answer;
                state.executionLog.push(entry);

                return {
                    answer: action.answer,
                    confidence: action.confidence,
                    executionPath: state.executionLog,
                    totalTokens: state.consumedTokens,
                    durationMs: Date.now() - startTime,
                    truncated: false,
                };
            }

            if (action.type === 'code') {
                // Validate code safety
                const issues = validateCode(action.code);
                if (issues.length > 0) {
                    entry.error = `Security violation: ${issues.join(', ')}`;
                    entry.output = entry.error;
                    state.executionLog.push(entry);

                    messages.push({ role: 'assistant', content: response.content });
                    messages.push({
                        role: 'user',
                        content: createObservationMessage({
                            success: false,
                            output: '',
                            stdout: '',
                            error: entry.error,
                        }),
                    });
                    continue;
                }

                // Execute code in sandbox
                const result = await this.sandbox.execute(action.code, sandboxVars);
                entry.output = result.success
                    ? (result.output || result.stdout)
                    : (result.error || 'Unknown error');

                state.executionLog.push(entry);

                // Record visited path for loop detection (fixed: Map with timestamps)
                const pathKey = action.code.slice(0, 100);
                const now = Date.now();
                const lastSeen = state.visitedPaths.get(pathKey);

                if (lastSeen !== undefined) {
                    // Potential loop detected - force answer
                    messages.push({ role: 'assistant', content: response.content });
                    messages.push({
                        role: 'user',
                        content: 'You seem to be repeating yourself. Please provide your best answer now with the information you have gathered.',
                    });
                    continue;
                }

                state.visitedPaths.set(pathKey, now);

                // Cleanup: keep only last 50 entries to prevent memory leak
                if (state.visitedPaths.size > 50) {
                    const entries = Array.from(state.visitedPaths.entries());
                    entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp (oldest first)
                    // Remove oldest 10 entries
                    for (let i = 0; i < 10; i++) {
                        state.visitedPaths.delete(entries[i][0]);
                    }
                }

                // Add observation to conversation
                messages.push({ role: 'assistant', content: response.content });
                messages.push({
                    role: 'user',
                    content: createObservationMessage(result),
                });
            }

            if (action.type === 'recurse') {
                // Check if sub-agents are enabled
                if (!this.config.enableSubAgents) {
                    entry.error = 'Sub-agent spawning is disabled';
                    state.executionLog.push(entry);

                    messages.push({ role: 'assistant', content: response.content });
                    messages.push({
                        role: 'user',
                        content: 'Sub-agent spawning is disabled. Please solve the problem directly.',
                    });
                    continue;
                }

                // Get sub-context (either from expression or full context)
                let subContext = context;
                if (action.subContext) {
                    // Try to evaluate the subContext expression
                    try {
                        const evalResult = await this.sandbox.execute(
                            `${action.subContext}`,
                            sandboxVars
                        );
                        if (evalResult.success && evalResult.output) {
                            subContext = evalResult.output;
                        }
                    } catch {
                        // Use full context if expression fails
                    }
                }

                // Spawn sub-agent
                const subResult = await this.execute(action.subGoal, subContext, depth + 1);

                // Add sub-result to log
                entry.output = subResult.answer;
                entry.action = 'recurse';
                state.executionLog.push(entry);

                // Add tokens from sub-agent
                state.consumedTokens += subResult.totalTokens;

                // Add sub-agent result to conversation
                messages.push({ role: 'assistant', content: response.content });
                messages.push({
                    role: 'user',
                    content: createSubAgentResultMessage(action.subGoal, {
                        answer: subResult.answer,
                        confidence: subResult.confidence,
                    }),
                });
            }
        }

        // Max iterations reached
        return this.createTruncatedResult(state, 'iterations', startTime);
    }

    /**
     * Parse model response to determine action type
     */
    private parseAction(content: string): AgentAction {
        // Check for code block
        const codeMatch = content.match(/```(?:code|javascript|typescript|js|ts)?\s*\n([\s\S]*?)```/);
        if (codeMatch) {
            return { type: 'code', code: codeMatch[1].trim() };
        }

        // Check for recurse block
        const recurseMatch = content.match(/```recurse\s*\n([\s\S]*?)```/);
        if (recurseMatch) {
            try {
                const data = JSON.parse(recurseMatch[1].trim());
                return {
                    type: 'recurse',
                    subGoal: data.subGoal || data.goal || 'Analyze',
                    subContext: data.subContext || data.context,
                };
            } catch {
                // If JSON parsing fails, try to extract goal from text
                return {
                    type: 'recurse',
                    subGoal: recurseMatch[1].trim(),
                    subContext: '',
                };
            }
        }

        // Check for answer block
        const answerMatch = content.match(/```answer\s*\n([\s\S]*?)```/);
        if (answerMatch) {
            try {
                const data = JSON.parse(answerMatch[1].trim());
                return {
                    type: 'answer',
                    answer: data.answer || answerMatch[1].trim(),
                    confidence: data.confidence || 0.8,
                };
            } catch {
                return {
                    type: 'answer',
                    answer: answerMatch[1].trim(),
                    confidence: 0.8,
                };
            }
        }

        // No structured response - treat as implicit answer
        // This handles cases where the model just provides a plain text answer
        if (content.includes('The answer is') ||
            content.includes('Based on my analysis') ||
            content.includes('I found that') ||
            content.includes('The result is')) {
            return {
                type: 'answer',
                answer: content,
                confidence: 0.6, // Lower confidence for unstructured responses
            };
        }

        // If there's any code-like content, try to execute it
        const implicitCodeMatch = content.match(/(?:let|const|var|function|ctx\.|context\.)/);
        if (implicitCodeMatch) {
            // Extract what looks like code
            const lines = content.split('\n');
            const codeLines = lines.filter(line =>
                line.trim().match(/^(let|const|var|function|ctx\.|context\.|\/\/|console\.)/)
            );
            if (codeLines.length > 0) {
                return { type: 'code', code: codeLines.join('\n') };
            }
        }

        // Default: treat entire response as answer
        return {
            type: 'answer',
            answer: content,
            confidence: 0.5,
        };
    }

    /**
     * Create a truncated result due to limits
     */
    private createTruncatedResult(
        state: RLMState,
        reason: 'depth' | 'budget' | 'timeout' | 'iterations',
        startTime: number
    ): RLMResult {
        const reasonMessages: Record<string, string> = {
            depth: `Maximum recursion depth (${this.config.maxDepth}) reached`,
            budget: `Token budget (${this.config.maxTokenBudget}) exhausted`,
            timeout: `Execution timeout (${this.config.timeoutMs}ms) exceeded`,
            iterations: `Maximum iterations (${this.config.maxIterations}) reached`,
        };

        return {
            answer: `Execution truncated: ${reasonMessages[reason]}. Best available answer based on gathered information.`,
            confidence: 0.3,
            executionPath: state.executionLog,
            totalTokens: state.consumedTokens,
            durationMs: Date.now() - startTime,
            truncated: true,
            truncationReason: reason,
        };
    }

    /**
     * Create an error result
     */
    private createErrorResult(state: RLMState, error: string, startTime: number): RLMResult {
        return {
            answer: `Execution failed: ${error}`,
            confidence: 0,
            executionPath: state.executionLog,
            totalTokens: state.consumedTokens,
            durationMs: Date.now() - startTime,
            truncated: true,
        };
    }

    /**
     * Determine model type from config
     */
    private getModelType(): 'openai' | 'anthropic' | 'gemini' | 'qwen' | 'local' {
        switch (this.config.backend) {
            case 'openai':
                return 'openai';
            case 'anthropic':
                return 'anthropic';
            case 'gemini':
                return 'gemini';
            case 'local':
                return 'local';
            default:
                return 'gemini';
        }
    }

    /**
     * Generate unique execution ID
     */
    private generateExecutionId(): string {
        return `rlm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    /**
     * Get current configuration
     */
    getConfig(): RLMConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(options: Partial<RLMConfig>): void {
        this.config = { ...this.config, ...options };
    }
}

/**
 * Create RLM Engine with sensible defaults
 */
export function createRLMEngine(options: Partial<RLMConfig> = {}): RLMEngine {
    return new RLMEngine(options);
}
