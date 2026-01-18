/**
 * Rate Limiter for LLM API requests
 * Implements token bucket algorithm with sliding window
 */

export interface RateLimiterOptions {
    /** Maximum requests per time window */
    requestsPerMinute: number;
    /** Time window in milliseconds (default: 60000 = 1 minute) */
    windowMs?: number;
}

export interface RateLimitResult {
    /** Whether the request is allowed */
    allowed: boolean;
    /** Time to wait until next request (in milliseconds) */
    waitTime: number;
    /** Number of requests remaining in current window */
    remaining: number;
    /** When the window resets (timestamp) */
    resetAt: number;
}

/**
 * Rate Limiter Class
 * Uses sliding window algorithm for accurate rate limiting
 */
export class RateLimiter {
    private requests: number[] = []; // Timestamps of requests
    private readonly maxRequests: number;
    private readonly windowMs: number;

    constructor(options: RateLimiterOptions) {
        this.maxRequests = options.requestsPerMinute;
        this.windowMs = options.windowMs || 60000; // Default 1 minute
    }

    /**
     * Check if a request is allowed and record it
     * @returns Rate limit info
     */
    async checkLimit(): Promise<RateLimitResult> {
        const now = Date.now();

        // Remove old requests outside the window
        this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);

        // Check if we can make a request
        if (this.requests.length >= this.maxRequests) {
            // Rate limited - calculate wait time
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest);

            return {
                allowed: false,
                waitTime,
                remaining: 0,
                resetAt: oldestRequest + this.windowMs,
            };
        }

        // Record this request
        this.requests.push(now);

        return {
            allowed: true,
            waitTime: 0,
            remaining: this.maxRequests - this.requests.length,
            resetAt: this.requests[0] ? this.requests[0] + this.windowMs : now + this.windowMs,
        };
    }

    /**
     * Wait until a request is allowed (blocking)
     * Use this for automatic retry with backoff
     */
    async waitForSlot(): Promise<void> {
        const result = await this.checkLimit();

        if (!result.allowed) {
            // Wait until window resets
            await new Promise(resolve => setTimeout(resolve, result.waitTime + 100)); // +100ms buffer
            // Try again
            return this.waitForSlot();
        }
    }

    /**
     * Reset the rate limiter (clear all history)
     */
    reset(): void {
        this.requests = [];
    }

    /**
     * Get current statistics
     */
    getStats(): {
        currentRequests: number;
        maxRequests: number;
        windowMs: number;
    } {
        const now = Date.now();
        const currentRequests = this.requests.filter(t => now - t < this.windowMs).length;

        return {
            currentRequests,
            maxRequests: this.maxRequests,
            windowMs: this.windowMs,
        };
    }
}

/**
 * Default rate limits for popular LLM providers
 */
export const DEFAULT_RATE_LIMITS: Record<string, number> = {
    // OpenAI (GPT-4, GPT-3.5)
    'openai': 50, // Free tier: 3 RPM, Paid: 50-5000 RPM depending on model
    'gpt-4': 10,
    'gpt-4-turbo': 50,
    'gpt-3.5-turbo': 200,

    // Anthropic (Claude)
    'anthropic': 50, // Claude 3 Sonnet: 50 RPM default
    'claude-3-opus': 5,
    'claude-3-sonnet': 50,
    'claude-3-haiku': 200,

    // Google (Gemini)
    'gemini': 60, // Gemini Pro: 60 RPM
    'gemini-pro': 60,
    'gemini-flash': 150,

    // Local models (no rate limit)
    'local': 999999,
    'ollama': 999999,
    'lm-studio': 999999,
};

/**
 * Get default rate limit for a provider/model
 */
export function getDefaultRateLimit(provider: string, model?: string): number {
    // Check model-specific limit first
    if (model && model in DEFAULT_RATE_LIMITS) {
        return DEFAULT_RATE_LIMITS[model];
    }

    // Check provider limit
    if (provider in DEFAULT_RATE_LIMITS) {
        return DEFAULT_RATE_LIMITS[provider];
    }

    // Default conservative limit
    return 60;
}
