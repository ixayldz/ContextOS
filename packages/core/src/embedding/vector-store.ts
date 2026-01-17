/**
 * Vector Store
 * SQLite-based vector storage with similarity search
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { CodeChunk, VectorSearchResult } from '../types.js';

// Note: In production, we'd use @xenova/transformers for embeddings
// For now, this is a placeholder that can work without the ML library

export class VectorStore {
    private db: Database.Database | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private embedder: any = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * Initialize the vector store
     */
    async initialize(): Promise<void> {
        // Ensure directory exists
        const dir = dirname(this.dbPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(this.dbPath);

        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');

        // Create tables
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        hash TEXT NOT NULL,
        type TEXT NOT NULL,
        embedding BLOB,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);
    `);

        // Try to initialize the embedder
        await this.initializeEmbedder();
    }

    /**
     * Initialize the embedding model
     */
    private async initializeEmbedder(): Promise<void> {
        try {
            // Dynamic import to handle cases where transformers.js isn't available
            const { pipeline } = await import('@xenova/transformers');
            this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        } catch (error) {
            console.warn('Warning: Embedding model not available. Using fallback similarity.');
            this.embedder = null;
        }
    }

    /**
     * Generate embedding for text
     */
    async embed(text: string): Promise<Float32Array | null> {
        if (!this.embedder) {
            return null; // Fallback mode
        }

        try {
            const result = await this.embedder(text, {
                pooling: 'mean',
                normalize: true
            });
            return new Float32Array(result.data);
        } catch (error) {
            console.error('Embedding error:', error);
            return null;
        }
    }

    /**
     * Add a chunk to the store
     */
    async addChunk(chunk: CodeChunk): Promise<void> {
        if (!this.db) throw new Error('VectorStore not initialized');

        // Check if chunk already exists with same hash
        const existing = this.db.prepare(
            'SELECT id FROM chunks WHERE id = ? AND hash = ?'
        ).get(chunk.id, chunk.hash);

        if (existing) {
            return; // Already up to date
        }

        // Generate embedding
        const embedding = await this.embed(chunk.content);
        const embeddingBlob = embedding ? Buffer.from(embedding.buffer) : null;

        // Upsert chunk
        this.db.prepare(`
      INSERT OR REPLACE INTO chunks 
      (id, file_path, content, start_line, end_line, hash, type, embedding, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
            chunk.id,
            chunk.filePath,
            chunk.content,
            chunk.startLine,
            chunk.endLine,
            chunk.hash,
            chunk.type,
            embeddingBlob
        );
    }

    /**
     * Add multiple chunks (batch)
     */
    async addChunks(chunks: CodeChunk[]): Promise<void> {
        for (const chunk of chunks) {
            await this.addChunk(chunk);
        }
    }

    /**
     * Search for similar chunks
     */
    async search(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
        if (!this.db) throw new Error('VectorStore not initialized');

        const queryEmbedding = await this.embed(query);

        if (queryEmbedding) {
            // Vector similarity search
            return this.vectorSearch(queryEmbedding, limit);
        } else {
            // Fallback to text-based search
            return this.textSearch(query, limit);
        }
    }

    /**
     * Vector-based similarity search
     */
    private vectorSearch(queryEmbedding: Float32Array, limit: number): VectorSearchResult[] {
        if (!this.db) throw new Error('VectorStore not initialized');

        // Get all chunks with embeddings
        const chunks = this.db.prepare(`
      SELECT id, file_path, content, start_line, end_line, embedding
      FROM chunks
      WHERE embedding IS NOT NULL
    `).all() as Array<{
            id: string;
            file_path: string;
            content: string;
            start_line: number;
            end_line: number;
            embedding: Buffer;
        }>;

        // Calculate cosine similarity for each chunk
        const results: VectorSearchResult[] = chunks.map(chunk => {
            const chunkEmbedding = new Float32Array(chunk.embedding.buffer);
            const score = cosineSimilarity(queryEmbedding, chunkEmbedding);

            return {
                chunkId: chunk.id,
                filePath: chunk.file_path,
                content: chunk.content,
                score,
                lines: [chunk.start_line, chunk.end_line] as [number, number],
            };
        });

        // Sort by score and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Text-based fallback search
     */
    private textSearch(query: string, limit: number): VectorSearchResult[] {
        if (!this.db) throw new Error('VectorStore not initialized');

        const terms = query.toLowerCase().split(/\s+/);

        // Simple text matching
        const chunks = this.db.prepare(`
      SELECT id, file_path, content, start_line, end_line
      FROM chunks
    `).all() as Array<{
            id: string;
            file_path: string;
            content: string;
            start_line: number;
            end_line: number;
        }>;

        const results: VectorSearchResult[] = chunks.map(chunk => {
            const contentLower = chunk.content.toLowerCase();
            let score = 0;

            for (const term of terms) {
                const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
                score += matches;
            }

            // Normalize score
            score = Math.min(1, score / (terms.length * 2));

            return {
                chunkId: chunk.id,
                filePath: chunk.file_path,
                content: chunk.content,
                score,
                lines: [chunk.start_line, chunk.end_line] as [number, number],
            };
        });

        return results
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Remove chunks for a file
     */
    removeFile(filePath: string): void {
        if (!this.db) throw new Error('VectorStore not initialized');
        this.db.prepare('DELETE FROM chunks WHERE file_path = ?').run(filePath);
    }

    /**
     * Get all chunks for a file
     */
    getFileChunks(filePath: string): CodeChunk[] {
        if (!this.db) throw new Error('VectorStore not initialized');

        const rows = this.db.prepare(`
      SELECT id, file_path, content, start_line, end_line, hash, type
      FROM chunks
      WHERE file_path = ?
      ORDER BY start_line
    `).all(filePath) as Array<{
            id: string;
            file_path: string;
            content: string;
            start_line: number;
            end_line: number;
            hash: string;
            type: string;
        }>;

        return rows.map(row => ({
            id: row.id,
            filePath: row.file_path,
            content: row.content,
            startLine: row.start_line,
            endLine: row.end_line,
            hash: row.hash,
            type: row.type as CodeChunk['type'],
        }));
    }

    /**
     * Get store statistics
     */
    getStats(): {
        chunkCount: number;
        fileCount: number;
        embeddedCount: number;
    } {
        if (!this.db) throw new Error('VectorStore not initialized');

        const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as chunk_count,
        COUNT(DISTINCT file_path) as file_count,
        SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as embedded_count
      FROM chunks
    `).get() as {
            chunk_count: number;
            file_count: number;
            embedded_count: number;
        };

        return {
            chunkCount: stats.chunk_count,
            fileCount: stats.file_count,
            embeddedCount: stats.embedded_count,
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        if (!this.db) throw new Error('VectorStore not initialized');
        this.db.prepare('DELETE FROM chunks').run();
    }

    /**
     * Close the database
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}
