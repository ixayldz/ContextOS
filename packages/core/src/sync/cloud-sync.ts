/**
 * Cloud Sync Module
 * End-to-end encrypted cloud synchronization
 */

import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface CloudConfig {
    enabled: boolean;
    apiEndpoint: string;
    teamId: string;
    userId: string;
    encryptionKey?: string;
}

export interface SyncPayload {
    teamId: string;
    userId: string;
    timestamp: string;
    data: string;  // Encrypted
    checksum: string;
}

export interface CloudSyncResult {
    success: boolean;
    action: 'upload' | 'download' | 'conflict';
    message: string;
    timestamp?: string;
}

/**
 * E2EE Encryption utilities
 */
export class E2EEncryption {
    private algorithm = 'aes-256-gcm';
    private keyLength = 32;
    private ivLength = 16;
    private tagLength = 16;

    /**
     * Generate a new encryption key
     */
    generateKey(): string {
        return crypto.randomBytes(this.keyLength).toString('base64');
    }

    /**
     * Derive key from password
     */
    deriveKey(password: string, salt: string): string {
        const key = crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
        return key.toString('base64');
    }

    /**
     * Encrypt data with key
     */
    encrypt(data: string, keyBase64: string): string {
        const key = Buffer.from(keyBase64, 'base64');
        const iv = crypto.randomBytes(this.ivLength);

        const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const tag = cipher.getAuthTag();

        // Format: iv:tag:encrypted
        return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
    }

    /**
     * Decrypt data with key
     */
    decrypt(encryptedData: string, keyBase64: string): string {
        const [ivBase64, tagBase64, encrypted] = encryptedData.split(':');

        const key = Buffer.from(keyBase64, 'base64');
        const iv = Buffer.from(ivBase64, 'base64');
        const tag = Buffer.from(tagBase64, 'base64');

        const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Calculate checksum for integrity verification
     */
    checksum(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}

/**
 * Cloud Sync Manager
 * Handles E2EE cloud synchronization
 */
export class CloudSync {
    private config: CloudConfig;
    private encryption: E2EEncryption;
    private rootDir: string;

    constructor(rootDir: string, config: Partial<CloudConfig>) {
        this.rootDir = rootDir;
        this.encryption = new E2EEncryption();
        this.config = {
            enabled: config.enabled ?? false,
            apiEndpoint: config.apiEndpoint ?? 'https://api.contextos.dev',
            teamId: config.teamId ?? '',
            userId: config.userId ?? '',
            encryptionKey: config.encryptionKey,
        };
    }

    /**
     * Initialize cloud sync with encryption
     */
    async initialize(password: string): Promise<string> {
        const salt = crypto.randomBytes(16).toString('hex');
        const key = this.encryption.deriveKey(password, salt);

        this.config.encryptionKey = key;
        this.config.enabled = true;

        // Store salt locally (key is never stored)
        const saltPath = join(this.rootDir, '.contextos', '.salt');
        writeFileSync(saltPath, salt, 'utf-8');

        return key;
    }

    /**
     * Upload encrypted context to cloud
     */
    async upload(): Promise<CloudSyncResult> {
        if (!this.config.enabled || !this.config.encryptionKey) {
            return { success: false, action: 'upload', message: 'Cloud sync not initialized' };
        }

        try {
            // Read .contextos folder content
            const contextPath = join(this.rootDir, '.contextos', 'context.yaml');
            const configPath = join(this.rootDir, '.contextos', 'config.yaml');

            const data = JSON.stringify({
                context: existsSync(contextPath) ? readFileSync(contextPath, 'utf-8') : '',
                config: existsSync(configPath) ? readFileSync(configPath, 'utf-8') : '',
                timestamp: new Date().toISOString(),
            });

            // Encrypt data
            const encryptedData = this.encryption.encrypt(data, this.config.encryptionKey);
            const checksum = this.encryption.checksum(data);

            const payload: SyncPayload = {
                teamId: this.config.teamId,
                userId: this.config.userId,
                timestamp: new Date().toISOString(),
                data: encryptedData,
                checksum,
            };

            // Upload to cloud API
            const response = await fetch(`${this.config.apiEndpoint}/sync/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            return {
                success: true,
                action: 'upload',
                message: 'Context uploaded and encrypted',
                timestamp: payload.timestamp,
            };
        } catch (error) {
            return {
                success: false,
                action: 'upload',
                message: error instanceof Error ? error.message : 'Upload failed',
            };
        }
    }

    /**
     * Download and decrypt context from cloud
     */
    async download(): Promise<CloudSyncResult> {
        if (!this.config.enabled || !this.config.encryptionKey) {
            return { success: false, action: 'download', message: 'Cloud sync not initialized' };
        }

        try {
            // Download from cloud API
            const response = await fetch(
                `${this.config.apiEndpoint}/sync/download?teamId=${this.config.teamId}&userId=${this.config.userId}`,
                { method: 'GET' }
            );

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const payload = await response.json() as SyncPayload;

            // Decrypt data
            const decryptedData = this.encryption.decrypt(payload.data, this.config.encryptionKey);
            const data = JSON.parse(decryptedData);

            // Verify checksum
            const expectedChecksum = this.encryption.checksum(decryptedData);
            if (expectedChecksum !== payload.checksum) {
                return { success: false, action: 'download', message: 'Checksum mismatch - data corrupted' };
            }

            // Write to local files
            const contextPath = join(this.rootDir, '.contextos', 'context.yaml');
            const configPath = join(this.rootDir, '.contextos', 'config.yaml');

            if (data.context) writeFileSync(contextPath, data.context, 'utf-8');
            if (data.config) writeFileSync(configPath, data.config, 'utf-8');

            return {
                success: true,
                action: 'download',
                message: 'Context downloaded and decrypted',
                timestamp: payload.timestamp,
            };
        } catch (error) {
            return {
                success: false,
                action: 'download',
                message: error instanceof Error ? error.message : 'Download failed',
            };
        }
    }

    /**
     * Check if encryption key is valid
     */
    validateKey(password: string): boolean {
        const saltPath = join(this.rootDir, '.contextos', '.salt');
        if (!existsSync(saltPath)) return false;

        const salt = readFileSync(saltPath, 'utf-8');
        const derivedKey = this.encryption.deriveKey(password, salt);

        return derivedKey === this.config.encryptionKey;
    }
}
