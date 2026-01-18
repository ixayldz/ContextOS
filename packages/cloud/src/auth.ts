/**
 * API Key Authentication
 * Fixed: Strong API key validation, removed auto-registration
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

export interface AuthResult {
    valid: boolean;
    message?: string;
    userId?: string;
    tier?: 'free' | 'pro' | 'enterprise';
    rateLimited?: boolean;
    requestsRemaining?: number;
}

// In-memory store (would be Redis/DB in production)
const apiKeys = new Map<string, {
    userId: string;
    tier: 'free' | 'pro' | 'enterprise';
    createdAt: Date;
    lastUsed: Date;
    requestCount: number;
}>();

// Rate limits by tier (requests per minute)
const rateLimits: Record<string, number> = {
    free: 10,
    pro: 100,
    enterprise: 1000,
};

// Request tracking (sliding window - simplified)
const requestWindows = new Map<string, { count: number; resetAt: number }>();

/**
 * Strong API key format validation
 * - Must start with ctx_
 * - Must be exactly 36 characters total (ctx_ + 32 random chars)
 * - Remainder must be alphanumeric
 * - Must have sufficient entropy (at least 50% unique characters)
 */
function validateApiKeyFormat(apiKey: string): boolean {
    // Check prefix
    if (!apiKey.startsWith('ctx_')) {
        return false;
    }

    // Check total length
    if (apiKey.length !== 36) {
        return false;
    }

    // Check remainder is alphanumeric
    const keyPart = apiKey.slice(4);
    const alphanumericRegex = /^[A-Za-z0-9]+$/;
    if (!alphanumericRegex.test(keyPart)) {
        return false;
    }

    // Check entropy (at least 50% unique characters to prevent weak keys)
    const uniqueChars = new Set(keyPart).size;
    if (uniqueChars < 16) { // 16 unique chars out of 32 = 50%
        return false;
    }

    return true;
}

/**
 * Register a new API key (explicit registration, no auto-registration)
 */
export function registerApiKey(
    apiKey: string,
    userId: string,
    tier: 'free' | 'pro' | 'enterprise' = 'free'
): { success: boolean; message?: string } {
    if (!validateApiKeyFormat(apiKey)) {
        return {
            success: false,
            message: 'Invalid API key format. Must be ctx_ followed by 32 alphanumeric characters with sufficient entropy.',
        };
    }

    if (apiKeys.has(apiKey)) {
        return {
            success: false,
            message: 'API key already registered',
        };
    }

    apiKeys.set(apiKey, {
        userId,
        tier,
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
    });

    return { success: true };
}

/**
 * Validate API key and check rate limits
 * Fixed: Removed auto-registration, added timing-safe comparison
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult> {
    // Validate format first
    if (!validateApiKeyFormat(apiKey)) {
        return {
            valid: false,
            message: 'Invalid API key format. Must be ctx_ followed by 32 alphanumeric characters.',
        };
    }

    // Look up key in database
    const keyData = apiKeys.get(apiKey);

    // NO AUTO-REGISTRATION - reject unknown keys
    if (!keyData) {
        // Use constant-time comparison to prevent timing attacks
        try {
            const dummyHash = createHash('sha256').update('dummy-key-check').digest();
            const keyHash = createHash('sha256').update(apiKey).digest();
            timingSafeEqual(dummyHash, keyHash); // Always fails but takes consistent time
        } catch {
            // Ignore comparison result
        }

        return {
            valid: false,
            message: 'Invalid API key. Get your key at https://contextos.dev/keys',
        };
    }

    const userData = apiKeys.get(apiKey);
    if (!userData) {
        return {
            valid: false,
            message: 'Invalid API key',
        };
    }

    userData.lastUsed = new Date();
    userData.requestCount++;

    // Check rate limit
    const now = Date.now();
    const windowKey = `${apiKey}:${Math.floor(now / 60000)}`; // 1-minute windows
    const window = requestWindows.get(windowKey) || { count: 0, resetAt: now + 60000 };

    window.count++;
    requestWindows.set(windowKey, window);

    const limit = rateLimits[userData.tier];
    if (window.count > limit) {
        return {
            valid: true,
            userId: userData.userId,
            tier: userData.tier,
            rateLimited: true,
            requestsRemaining: 0,
            message: `Rate limit exceeded. Resets in ${Math.ceil((window.resetAt - now) / 1000)}s`,
        };
    }

    return {
        valid: true,
        userId: userData.userId,
        tier: userData.tier,
        rateLimited: false,
        requestsRemaining: limit - window.count,
    };
}

/**
 * Generate new API key with cryptographic randomness
 */
export function generateApiKey(): string {
    // Use crypto.randomBytes for secure random generation
    const randomBytes = Buffer.from(getRandomValues(24)); // 24 bytes = 32 base64 chars
    const keyPart = randomBytes.toString('base64')
        .replace(/[+/]/g, '') // Remove + and /
        .slice(0, 32); // Take first 32 chars

    return `ctx_${keyPart}`;
}

// Polyfill for Web Crypto API in Node.js
function getRandomValues(length: number): Uint8Array {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint8Array(length);
        crypto.getRandomValues(arr);
        return arr;
    }
    // Node.js fallback
    return require('crypto').randomBytes(length);
}

/**
 * Revoke API key
 */
export function revokeApiKey(apiKey: string): boolean {
    return apiKeys.delete(apiKey);
}

/**
 * Get API key stats
 */
export function getKeyStats(apiKey: string) {
    const data = apiKeys.get(apiKey);
    if (!data) return null;

    return {
        userId: data.userId,
        tier: data.tier,
        createdAt: data.createdAt.toISOString(),
        lastUsed: data.lastUsed.toISOString(),
        totalRequests: data.requestCount,
    };
}

/**
 * List all registered keys (admin function)
 */
export function listAllKeys(): Array<{ apiKey: string; userId: string; tier: string }> {
    return Array.from(apiKeys.entries()).map(([apiKey, data]) => ({
        apiKey,
        userId: data.userId,
        tier: data.tier,
    }));
}
