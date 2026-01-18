/**
 * Shadow File System
 * Provides atomic file operations with transaction support
 * Based on analysis recommendations for ACID compliance
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

export interface Transaction {
    id: string;
    shadowDir: string;
    files: Map<string, string>; // realPath -> shadowPath
    startedAt: Date;
    status: 'active' | 'committed' | 'rolled_back';
}

export interface WriteResult {
    success: boolean;
    shadowPath?: string;
    error?: string;
}

/**
 * Shadow File System for atomic file operations
 */
export class ShadowFileSystem {
    private readonly rootDir: string;
    private readonly shadowRoot: string;
    private activeTransactions: Map<string, Transaction> = new Map();

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.shadowRoot = join(rootDir, '.contextos', '.shadow');
    }

    /**
     * Begin a new transaction
     */
    beginTransaction(): Transaction {
        const id = randomUUID();
        const shadowDir = join(this.shadowRoot, id);

        // Create shadow directory
        mkdirSync(shadowDir, { recursive: true });

        const transaction: Transaction = {
            id,
            shadowDir,
            files: new Map(),
            startedAt: new Date(),
            status: 'active',
        };

        this.activeTransactions.set(id, transaction);
        return transaction;
    }

    /**
     * Write file to shadow location
     */
    writeToShadow(txId: string, relativePath: string, content: string): WriteResult {
        const tx = this.activeTransactions.get(txId);
        if (!tx) {
            return { success: false, error: 'Transaction not found' };
        }

        if (tx.status !== 'active') {
            return { success: false, error: `Transaction is ${tx.status}` };
        }

        try {
            // Create shadow path maintaining directory structure
            const shadowPath = join(tx.shadowDir, relativePath);
            const shadowDir = dirname(shadowPath);

            if (!existsSync(shadowDir)) {
                mkdirSync(shadowDir, { recursive: true });
            }

            // Write to shadow file
            writeFileSync(shadowPath, content, 'utf-8');

            // Track the mapping
            const realPath = join(this.rootDir, relativePath);
            tx.files.set(realPath, shadowPath);

            return { success: true, shadowPath };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Read file from shadow or real location
     */
    readFile(txId: string, relativePath: string): string | null {
        const tx = this.activeTransactions.get(txId);
        const realPath = join(this.rootDir, relativePath);

        // Check shadow first
        if (tx && tx.files.has(realPath)) {
            const shadowPath = tx.files.get(realPath)!;
            if (existsSync(shadowPath)) {
                return readFileSync(shadowPath, 'utf-8');
            }
        }

        // Fallback to real file
        if (existsSync(realPath)) {
            return readFileSync(realPath, 'utf-8');
        }

        return null;
    }

    /**
     * Commit transaction - atomically move shadow files to real locations
     */
    commit(txId: string): { success: boolean; filesCommitted: number; error?: string } {
        const tx = this.activeTransactions.get(txId);
        if (!tx) {
            return { success: false, filesCommitted: 0, error: 'Transaction not found' };
        }

        if (tx.status !== 'active') {
            return { success: false, filesCommitted: 0, error: `Transaction is ${tx.status}` };
        }

        let filesCommitted = 0;

        try {
            // Phase 1: Create backups of existing files
            const backups: Map<string, string> = new Map();

            for (const [realPath, shadowPath] of tx.files) {
                if (existsSync(realPath)) {
                    const backupPath = `${realPath}.bak.${txId.slice(0, 8)}`;
                    copyFileSync(realPath, backupPath);
                    backups.set(realPath, backupPath);
                }
            }

            // Phase 2: Atomic rename (move shadow to real)
            for (const [realPath, shadowPath] of tx.files) {
                // Ensure target directory exists
                const targetDir = dirname(realPath);
                if (!existsSync(targetDir)) {
                    mkdirSync(targetDir, { recursive: true });
                }

                // Atomic move
                renameSync(shadowPath, realPath);
                filesCommitted++;
            }

            // Phase 3: Cleanup backups (commit successful)
            for (const backupPath of backups.values()) {
                if (existsSync(backupPath)) {
                    rmSync(backupPath);
                }
            }

            // Cleanup shadow directory
            this.cleanupTransaction(tx);

            tx.status = 'committed';
            return { success: true, filesCommitted };

        } catch (error) {
            // Rollback on error
            tx.status = 'rolled_back';
            return {
                success: false,
                filesCommitted,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Rollback transaction - discard all shadow files
     */
    rollback(txId: string): { success: boolean; error?: string } {
        const tx = this.activeTransactions.get(txId);
        if (!tx) {
            return { success: false, error: 'Transaction not found' };
        }

        try {
            this.cleanupTransaction(tx);
            tx.status = 'rolled_back';
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Cleanup transaction resources
     */
    private cleanupTransaction(tx: Transaction): void {
        // Remove shadow directory
        if (existsSync(tx.shadowDir)) {
            rmSync(tx.shadowDir, { recursive: true, force: true });
        }

        // Remove from active transactions
        this.activeTransactions.delete(tx.id);
    }

    /**
     * Get transaction status
     */
    getTransaction(txId: string): Transaction | undefined {
        return this.activeTransactions.get(txId);
    }

    /**
     * List files in transaction
     */
    listTransactionFiles(txId: string): string[] {
        const tx = this.activeTransactions.get(txId);
        if (!tx) return [];

        return Array.from(tx.files.keys()).map(p =>
            p.replace(this.rootDir + '/', '').replace(this.rootDir + '\\', '')
        );
    }
}

/**
 * Factory function
 */
export function createShadowFS(rootDir: string): ShadowFileSystem {
    return new ShadowFileSystem(rootDir);
}
