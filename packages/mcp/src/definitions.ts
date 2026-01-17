/**
 * MCP Tool, Resource, and Prompt Definitions
 * Defines all capabilities exposed by the ContextOS MCP server
 */

import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk/types.js';

// ═══════════════════════════════════════════════════════════
// TOOLS - Actions that AI can perform
// ═══════════════════════════════════════════════════════════

export const TOOLS: Tool[] = [
    {
        name: 'contextos_build',
        description: 'Build optimized context for a specific goal. Returns the most relevant files from the codebase based on semantic similarity, dependency graph, and custom rules.',
        inputSchema: {
            type: 'object',
            properties: {
                goal: {
                    type: 'string',
                    description: 'The coding task or goal (e.g., "Add authentication to UserController")',
                },
            },
            required: ['goal'],
        },
    },
    {
        name: 'contextos_analyze',
        description: 'Perform deep analysis of the codebase using RLM engine. Can find patterns, security issues, or answer complex questions about the code.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Analysis query (e.g., "Find potential security vulnerabilities")',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'contextos_find',
        description: 'Find files matching a pattern in the indexed codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: 'Glob pattern to match (e.g., "**/auth/**/*.ts")',
                },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'contextos_deps',
        description: 'Get dependencies of a file up to a specified depth.',
        inputSchema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    description: 'File path to analyze dependencies for',
                },
                depth: {
                    type: 'number',
                    description: 'Maximum depth to traverse (default: 2)',
                },
            },
            required: ['file'],
        },
    },
    {
        name: 'contextos_explain',
        description: 'Get an AI-powered explanation of a file, including its purpose, key functions, and how it relates to other parts of the codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    description: 'File path to explain',
                },
            },
            required: ['file'],
        },
    },
    {
        name: 'contextos_status',
        description: 'Get the current status of ContextOS: project info, index status, and configuration.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
];

// ═══════════════════════════════════════════════════════════
// RESOURCES - Data that AI can read
// ═══════════════════════════════════════════════════════════

export const RESOURCES: Resource[] = [
    {
        uri: 'contextos://context/current',
        name: 'Current Context',
        description: 'The most recently built context (output of ctx build/goal)',
        mimeType: 'text/markdown',
    },
    {
        uri: 'contextos://project/info',
        name: 'Project Info',
        description: 'Project configuration from context.yaml (name, language, framework, stack)',
        mimeType: 'application/json',
    },
    {
        uri: 'contextos://project/constraints',
        name: 'Coding Constraints',
        description: 'Project coding rules and constraints that should be followed',
        mimeType: 'text/markdown',
    },
    {
        uri: 'contextos://project/structure',
        name: 'Project Structure',
        description: 'Directory tree of the project (excluding node_modules, etc.)',
        mimeType: 'text/plain',
    },
];

// ═══════════════════════════════════════════════════════════
// PROMPTS - Pre-built prompt templates
// ═══════════════════════════════════════════════════════════

export const PROMPTS: Prompt[] = [
    {
        name: 'code_with_context',
        description: 'Start a coding task with optimized context from ContextOS',
        arguments: [
            {
                name: 'goal',
                description: 'The coding task or goal',
                required: true,
            },
        ],
    },
    {
        name: 'review_code',
        description: 'Review a file and its dependencies',
        arguments: [
            {
                name: 'file',
                description: 'File path to review',
                required: true,
            },
        ],
    },
    {
        name: 'debug_issue',
        description: 'Debug an issue with relevant context',
        arguments: [
            {
                name: 'issue',
                description: 'Description of the issue',
                required: true,
            },
        ],
    },
];
