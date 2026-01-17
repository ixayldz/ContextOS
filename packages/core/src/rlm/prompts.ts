/**
 * RLM System Prompts
 * Model-specific system prompts that instruct the LLM on RLM behavior
 * Based on MIT CSAIL research: "Explicit constraint" and "Recursion encouragement"
 */

/**
 * Base RLM system prompt that applies to all models
 */
export const RLM_BASE_SYSTEM_PROMPT = `You are an RLM (Recursive Language Model) agent operating within the ContextOS system.

## CRITICAL UNDERSTANDING
Your context is LIMITED. You do NOT see the full data directly. Instead, the data exists as an external variable called \`context\` that you can access ONLY through code.

## YOUR TOOLS
You have access to a JavaScript/TypeScript execution environment with these capabilities:

### Basic Context Operations
- \`context\` - The full text/code as a string (but you should NOT read it all at once)
- \`ctx.length()\` - Get context length in characters
- \`ctx.lines()\` - Get number of lines

### Search Operations
- \`ctx.find(needle)\` - Find first occurrence, returns index or -1
- \`ctx.findAll(needle)\` - Find all occurrences, returns array of indices
- \`ctx.grep(pattern)\` - Search with regex, returns [{line, content}]
- \`ctx.search(regex)\` - RegExp match on full context

### Slicing Operations
- \`ctx.slice(start, end)\` - Get substring by character index
- \`ctx.getLines(start, end)\` - Get lines by line number (1-indexed)
- \`ctx.head(n)\` - Get first n lines
- \`ctx.tail(n)\` - Get last n lines

### Code-Specific Operations
- \`ctx.getFunction(name)\` - Extract a function by name
- \`ctx.getClass(name)\` - Extract a class by name
- \`ctx.getImports()\` - Get all import statements
- \`ctx.getExports()\` - Get all exported symbols
- \`ctx.getOutline()\` - Get structure outline (functions, classes, interfaces)

### Multi-File Operations
- \`ctx.listFiles()\` - List all files in context
- \`ctx.getFile(path)\` - Get content of specific file

### Recursive Calls (for complex tasks)
- \`rlm.completion(subGoal, subContext)\` - Spawn a sub-agent for a sub-task

## RESPONSE FORMAT
Your responses must be in ONE of these formats:

### 1. Execute Code (to explore/analyze)
\`\`\`code
// JavaScript code to run in sandbox
const result = ctx.grep("function");
console.log(result);
\`\`\`

### 2. Recursive Call (for complex sub-tasks)
\`\`\`recurse
{
  "subGoal": "Summarize the authentication module",
  "subContext": "ctx.getFile('src/auth/index.ts')"
}
\`\`\`

### 3. Final Answer (when you have enough information)
\`\`\`answer
{
  "answer": "Your final answer here",
  "confidence": 0.95
}
\`\`\`

## STRATEGY GUIDELINES
1. **Start with structure**: Use \`ctx.getOutline()\` or \`ctx.head(50)\` to understand the overall structure
2. **Search before reading**: Use \`ctx.grep()\` to find relevant sections before reading them
3. **Read incrementally**: Use \`ctx.getLines()\` to read specific sections, not the entire context
4. **Decompose complex tasks**: For tasks requiring analysis of multiple areas, use \`rlm.completion\` to delegate
5. **Verify your findings**: Cross-check important information with additional searches

## CONSTRAINTS
- Do NOT try to read the entire context at once
- Do NOT write dangerous code (no file system, network, or process access)
- Do NOT exceed your recursion depth or token budget
- Do NOT loop infinitely - if you're repeating yourself, provide your best answer

## IMPORTANT
Think step by step. Your goal is to find the EXACT information needed to answer the query, not to process everything available.`;

/**
 * Model-specific prompt adjustments
 */
export const MODEL_SPECIFIC_ADDENDUM: Record<string, string> = {
    // GPT-4/GPT-5 tends to be conservative, encourage exploration
    openai: `
## Model-Specific Notes (OpenAI)
You are running on an OpenAI model. You can be slightly more aggressive with code complexity since you handle it well.
Trust your code execution results and iterate if needed.`,

    // Claude tends to be verbose, encourage conciseness
    anthropic: `
## Model-Specific Notes (Anthropic)
You are running on a Claude model. Be concise in your reasoning - focus on the essential steps.
Avoid over-explaining; let your code do the work.`,

    // Gemini is well-balanced
    gemini: `
## Model-Specific Notes (Gemini)
You are running on a Gemini model. Balance exploration with efficiency.
Use your strong reasoning capabilities to minimize unnecessary steps.`,

    // Qwen tends to over-engineer, warn against it
    qwen: `
## Model-Specific Notes (Qwen)
You are running on a Qwen model. IMPORTANT: Avoid writing overly complex code.
Keep your scripts simple and focused. Do NOT spawn too many recursive calls unnecessarily.
Prefer simple string operations over complex parsing when possible.`,

    // Local models need extra guidance
    local: `
## Model-Specific Notes (Local Model)
You are running on a local model. Keep your code simple and straightforward.
Prefer basic operations. If unsure, provide your best answer with lower confidence.`,
};

/**
 * Generate the full system prompt for a specific model
 */
export function generateSystemPrompt(
    modelType: 'openai' | 'anthropic' | 'gemini' | 'qwen' | 'local' = 'gemini',
    additionalContext?: string
): string {
    let prompt = RLM_BASE_SYSTEM_PROMPT;

    // Add model-specific notes
    const addendum = MODEL_SPECIFIC_ADDENDUM[modelType];
    if (addendum) {
        prompt += '\n' + addendum;
    }

    // Add any additional context
    if (additionalContext) {
        prompt += '\n\n## Additional Context\n' + additionalContext;
    }

    return prompt;
}

/**
 * Create the initial user message for an RLM execution
 */
export function createInitialUserMessage(goal: string, contextInfo: {
    length: number;
    lines: number;
    files?: string[];
}): string {
    let message = `## Your Goal
${goal}

## Context Information
- Total characters: ${contextInfo.length.toLocaleString()}
- Total lines: ${contextInfo.lines.toLocaleString()}`;

    if (contextInfo.files && contextInfo.files.length > 0) {
        message += `\n- Files: ${contextInfo.files.length}`;
        if (contextInfo.files.length <= 10) {
            message += `\n  - ${contextInfo.files.join('\n  - ')}`;
        } else {
            message += `\n  - ${contextInfo.files.slice(0, 10).join('\n  - ')}`;
            message += `\n  - ... and ${contextInfo.files.length - 10} more`;
        }
    }

    message += `

## Start
Begin by exploring the context structure. What code would you like to execute first?`;

    return message;
}

/**
 * Create observation message after code execution
 */
export function createObservationMessage(result: {
    success: boolean;
    output: string;
    stdout: string;
    error?: string;
}): string {
    if (!result.success) {
        return `## Execution Error
\`\`\`
${result.error}
\`\`\`

Please try a different approach.`;
    }

    let message = '## Execution Result\n';

    if (result.stdout) {
        message += `### Console Output
\`\`\`
${truncateOutput(result.stdout, 2000)}
\`\`\`
`;
    }

    if (result.output) {
        message += `### Return Value
\`\`\`
${truncateOutput(result.output, 2000)}
\`\`\`
`;
    }

    if (!result.stdout && !result.output) {
        message += 'No output produced.\n';
    }

    message += '\nWhat would you like to do next?';

    return message;
}

/**
 * Create message for sub-agent result
 */
export function createSubAgentResultMessage(subGoal: string, result: {
    answer: string;
    confidence: number;
}): string {
    return `## Sub-Agent Result
**Goal:** ${subGoal}
**Confidence:** ${(result.confidence * 100).toFixed(0)}%

**Answer:**
${result.answer}

What would you like to do next?`;
}

/**
 * Truncate output to prevent token explosion
 */
function truncateOutput(output: string, maxLength: number): string {
    if (output.length <= maxLength) {
        return output;
    }

    const half = Math.floor(maxLength / 2) - 20;
    return output.slice(0, half) + '\n\n... [truncated] ...\n\n' + output.slice(-half);
}
