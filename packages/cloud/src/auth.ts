/**
 * API Key Authentication
 */

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
 * Validate API key and check rate limits
 */
export async function validateApiKey(apiKey: string): Promise<AuthResult> {
    // Check format
    if (!apiKey.startsWith('ctx_')) {
        return {
            valid: false,
            message: 'Invalid API key format',
        };
    }

    // Look up key
    const keyData = apiKeys.get(apiKey);

    // For demo purposes, accept any valid format key
    // In production: verify against database
    if (!keyData) {
        // Auto-register for demo
        const userId = `user_${apiKey.slice(4, 12)}`;
        apiKeys.set(apiKey, {
            userId,
            tier: 'free',
            createdAt: new Date(),
            lastUsed: new Date(),
            requestCount: 0,
        });
    }

    const userData = apiKeys.get(apiKey)!;
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
 * Generate new API key
 */
export function generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'ctx_';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
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
