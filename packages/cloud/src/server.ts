#!/usr/bin/env node
/**
 * ContextOS Cloud MCP Server
 * Hosted MCP solution with API key authentication
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { validateApiKey, type AuthResult } from './auth.js';
import { handleMCPRequest } from './proxy.js';

const app = new Hono();

// Middleware
app.use('*', logger());

// CORS configuration with origin validation (Fix R4: CORS Misconfiguration)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use('*', cors({
    origin: (origin) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return true;

        // Development mode: allow all origins
        if (process.env.NODE_ENV === 'development') {
            return true;
        }

        // Production mode: only allow whitelisted origins
        if (ALLOWED_ORIGINS.length === 0) {
            console.warn('⚠️  CORS: No ALLOWED_ORIGINS configured in production');
            return false;
        }

        return ALLOWED_ORIGINS.includes(origin);
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
}));

// Health check
app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// API info
app.get('/', (c) => {
    return c.json({
        name: 'ContextOS Cloud MCP Server',
        version: '0.1.0',
        endpoints: {
            health: 'GET /health',
            mcp: 'POST /mcp',
            register: 'POST /register',
        },
        docs: 'https://docs.contextos.dev/cloud',
    });
});

// Register new API key (simplified - in production would use proper auth)
app.post('/register', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { email?: string };
    const email = body.email;

    if (!email) {
        return c.json({ error: 'Email required' }, 400);
    }

    // Generate API key
    const { nanoid } = await import('nanoid');
    const apiKey = `ctx_${nanoid(32)}`;

    // In production: save to database
    console.log(`[Register] New key for ${email}: ${apiKey}`);

    return c.json({
        success: true,
        apiKey,
        message: 'Save this key - it will only be shown once',
    });
});

// MCP endpoint - main functionality
app.post('/mcp', async (c) => {
    // Authenticate
    const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
        return c.json({ error: 'API key required' }, 401);
    }

    const authResult = await validateApiKey(apiKey);

    if (!authResult.valid) {
        return c.json({ error: authResult.message }, 401);
    }

    // Rate limiting check
    if (authResult.rateLimited) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    // Handle MCP request
    try {
        const request = await c.req.json();
        const response = await handleMCPRequest(request, authResult);
        return c.json(response);
    } catch (error) {
        console.error('[MCP Error]', error);
        return c.json({
            jsonrpc: '2.0',
            error: {
                code: -32603,
                message: error instanceof Error ? error.message : 'Internal error',
            },
        }, 500);
    }
});

// MCP SSE endpoint for streaming
app.get('/mcp/sse', async (c) => {
    const apiKey = c.req.query('apiKey');

    if (!apiKey) {
        return c.json({ error: 'API key required' }, 401);
    }

    const authResult = await validateApiKey(apiKey);
    if (!authResult.valid) {
        return c.json({ error: authResult.message }, 401);
    }

    // Set up SSE
    return c.text('SSE endpoint - not yet implemented', 501);
});

// Start server
const port = parseInt(process.env.PORT || '3100');
const host = process.env.HOST || '0.0.0.0';

console.log(`
╔══════════════════════════════════════════╗
║     ContextOS Cloud MCP Server           ║
╠══════════════════════════════════════════╣
║  Port: ${port.toString().padEnd(33)}║
║  Host: ${host.padEnd(33)}║
║  Docs: https://docs.contextos.dev/cloud  ║
╚══════════════════════════════════════════╝
`);

serve({
    fetch: app.fetch,
    port,
    hostname: host,
});

export { app };
