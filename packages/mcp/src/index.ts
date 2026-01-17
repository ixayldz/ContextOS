#!/usr/bin/env node
/**
 * ContextOS MCP Server
 * 
 * Model Context Protocol server that provides AI tools (Claude Code, Cursor, etc.)
 * with optimized context from ContextOS.
 * 
 * Usage:
 *   npx @contextos/mcp
 *   
 * Configure in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "contextos": {
 *         "command": "npx",
 *         "args": ["@contextos/mcp"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ContextOSProvider } from './provider.js';
import { TOOLS, RESOURCES, PROMPTS } from './definitions.js';

// Initialize server
const server = new Server(
    {
        name: 'contextos',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    }
);

// Initialize ContextOS provider
const provider = new ContextOSProvider();

// ═══════════════════════════════════════════════════════════
// TOOLS - Actions that AI can perform
// ═══════════════════════════════════════════════════════════

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'contextos_build': {
                const goal = (args as { goal: string }).goal;
                const result = await provider.buildContext(goal);
                return {
                    content: [{ type: 'text', text: result }],
                };
            }

            case 'contextos_analyze': {
                const query = (args as { query: string }).query;
                const result = await provider.analyze(query);
                return {
                    content: [{ type: 'text', text: result }],
                };
            }

            case 'contextos_find': {
                const pattern = (args as { pattern: string }).pattern;
                const result = await provider.findFiles(pattern);
                return {
                    content: [{ type: 'text', text: result }],
                };
            }

            case 'contextos_deps': {
                const file = (args as { file: string }).file;
                const depth = (args as { file: string; depth?: number }).depth || 2;
                const result = await provider.getDependencies(file, depth);
                return {
                    content: [{ type: 'text', text: result }],
                };
            }

            case 'contextos_explain': {
                const file = (args as { file: string }).file;
                const result = await provider.explainFile(file);
                return {
                    content: [{ type: 'text', text: result }],
                };
            }

            case 'contextos_status': {
                const result = await provider.getStatus();
                return {
                    content: [{ type: 'text', text: result }],
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            content: [{
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true,
        };
    }
});

// ═══════════════════════════════════════════════════════════
// RESOURCES - Data that AI can read
// ═══════════════════════════════════════════════════════════

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
        if (uri === 'contextos://context/current') {
            const content = await provider.getCurrentContext();
            return {
                contents: [{ uri, mimeType: 'text/markdown', text: content }],
            };
        }

        if (uri === 'contextos://project/info') {
            const content = await provider.getProjectInfo();
            return {
                contents: [{ uri, mimeType: 'application/json', text: content }],
            };
        }

        if (uri === 'contextos://project/constraints') {
            const content = await provider.getConstraints();
            return {
                contents: [{ uri, mimeType: 'text/markdown', text: content }],
            };
        }

        if (uri === 'contextos://project/structure') {
            const content = await provider.getProjectStructure();
            return {
                contents: [{ uri, mimeType: 'text/plain', text: content }],
            };
        }

        throw new Error(`Unknown resource: ${uri}`);
    } catch (error) {
        throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : String(error)}`);
    }
});

// ═══════════════════════════════════════════════════════════
// PROMPTS - Pre-built prompt templates
// ═══════════════════════════════════════════════════════════

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
        case 'code_with_context': {
            const goal = args?.goal || 'general coding task';
            const context = await provider.buildContext(goal);
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `# Project Context\n\n${context}\n\n# Task\n\n${goal}`,
                        },
                    },
                ],
            };
        }

        case 'review_code': {
            const file = args?.file || '';
            const content = await provider.getFileWithDeps(file);
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `# Code Review Request\n\nPlease review the following code and its dependencies:\n\n${content}`,
                        },
                    },
                ],
            };
        }

        case 'debug_issue': {
            const issue = args?.issue || 'unknown issue';
            const context = await provider.buildContext(`debug: ${issue}`);
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `# Debug Request\n\n## Issue\n${issue}\n\n## Relevant Context\n\n${context}`,
                        },
                    },
                ],
            };
        }

        default:
            throw new Error(`Unknown prompt: ${name}`);
    }
});

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('ContextOS MCP Server started');
}

main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
