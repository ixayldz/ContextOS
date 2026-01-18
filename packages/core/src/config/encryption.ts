/**
 * Encryption utilities for sensitive configuration data
 * Uses AES-256-GCM for symmetric encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT = 'contextos-config-salt-v1'; // In production, use environment-specific salt
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt text using AES-256-GCM
 * @param text - Plain text to encrypt
 * @param password - Encryption password (use CONTEXTOS_ENCRYPTION_KEY env var)
 * @returns Encrypted string in format: iv:authTag:encrypted
 */
export function encrypt(text: string, password: string): string {
    try {
        // Derive key from password using scrypt
        const key = scryptSync(password, SALT, KEY_LENGTH);

        // Generate random IV
        const iv = randomBytes(IV_LENGTH);

        // Create cipher
        const cipher = createCipheriv(ALGORITHM, key, iv);

        // Encrypt
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Get auth tag
        const authTag = cipher.getAuthTag();

        // Return as: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Decrypt text using AES-256-GCM
 * @param encrypted - Encrypted string in format: iv:authTag:encrypted
 * @param password - Encryption password
 * @returns Decrypted plain text
 */
export function decrypt(encrypted: string, password: string): string {
    try {
        // Parse encrypted string
        const parts = encrypted.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted format');
        }

        const [ivHex, authTagHex, encryptedText] = parts;

        // Convert hex back to buffers
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        // Derive key from password
        const key = scryptSync(password, SALT, KEY_LENGTH);

        // Create decipher
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Sanitize configuration by removing sensitive fields
 * @param config - Configuration object
 * @param sensitiveFields - Array of field names to redact
 * @returns Sanitized configuration
 */
export function sanitizeConfig<T extends Record<string, unknown>>(
    config: T,
    sensitiveFields: string[] = ['apiKeys', 'apiKey', 'secret', 'password', 'token']
): T {
    const sanitized = { ...config };

    for (const field of sensitiveFields) {
        if (field in sanitized) {
            delete (sanitized as Record<string, unknown>)[field];
        }
    }

    return sanitized;
}

/**
 * Check if encryption is available (has valid password)
 */
export function isEncryptionAvailable(): boolean {
    return !!process.env.CONTEXTOS_ENCRYPTION_KEY || process.env.NODE_ENV !== 'production';
}

/**
 * Get encryption password from environment
 * In production, this MUST be set
 */
export function getEncryptionPassword(): string {
    const password = process.env.CONTEXTOS_ENCRYPTION_KEY;

    if (!password) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                'CONTEXTOS_ENCRYPTION_KEY environment variable must be set in production'
            );
        }
        // Development fallback
        console.warn('CONTEXTOS_ENCRYPTION_KEY not set, using insecure default (development only)');
        return 'contextos-dev-key-change-in-production';
    }

    if (password.length < 16) {
        throw new Error('CONTEXTOS_ENCRYPTION_KEY must be at least 16 characters');
    }

    return password;
}
