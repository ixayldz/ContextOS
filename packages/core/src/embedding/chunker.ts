/**
 * Code Chunker
 * Splits code into semantically meaningful chunks for embedding
 */

import type { CodeChunk } from '../types.js';
import { createHash } from 'crypto';

interface ChunkOptions {
    chunkSize?: number;
    overlap?: number;
    minChunkSize?: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
    chunkSize: 512,
    overlap: 50,
    minChunkSize: 100,
};

/**
 * Split code into chunks based on semantic boundaries
 */
export function chunkCode(
    filePath: string,
    content: string,
    options: ChunkOptions = {}
): CodeChunk[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    if (lines.length === 0) return [];

    // Strategy: Try to chunk at function/class boundaries first
    // Fall back to line-based chunking if content is simple

    let currentChunk: string[] = [];
    let currentStartLine = 1;
    let chunkIndex = 0;

    const flushChunk = (endLine: number): void => {
        if (currentChunk.length === 0) return;

        const chunkContent = currentChunk.join('\n');
        if (chunkContent.length >= opts.minChunkSize) {
            const hash = createHash('md5').update(chunkContent).digest('hex').slice(0, 8);

            chunks.push({
                id: `${filePath}#${chunkIndex}`,
                filePath,
                content: chunkContent,
                startLine: currentStartLine,
                endLine,
                hash,
                type: detectChunkType(chunkContent),
            });
            chunkIndex++;
        }
        currentChunk = [];
        currentStartLine = endLine + 1;
    };

    // Simple line-based chunking with overlap
    let currentLength = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        currentChunk.push(line);
        currentLength += line.length + 1; // +1 for newline

        // Check if we should create a new chunk
        if (currentLength >= opts.chunkSize) {
            // Try to find a good break point (empty line, closing brace)
            let breakPoint = currentChunk.length - 1;

            for (let j = currentChunk.length - 1; j >= Math.max(0, currentChunk.length - 10); j--) {
                const checkLine = currentChunk[j].trim();
                if (checkLine === '' || checkLine === '}' || checkLine === '};') {
                    breakPoint = j;
                    break;
                }
            }

            // Flush up to break point
            const toFlush = currentChunk.slice(0, breakPoint + 1);
            const remaining = currentChunk.slice(Math.max(0, breakPoint + 1 - Math.floor(opts.overlap / 10)));

            currentChunk = toFlush;
            flushChunk(currentStartLine + toFlush.length - 1);

            // Add overlap from the end
            currentChunk = remaining;
            currentStartLine = i - remaining.length + 2;
            currentLength = remaining.reduce((sum, l) => sum + l.length + 1, 0);
        }
    }

    // Flush remaining content
    if (currentChunk.length > 0) {
        flushChunk(lines.length);
    }

    return chunks;
}

/**
 * Detect the type of chunk based on content
 */
function detectChunkType(content: string): CodeChunk['type'] {
    const firstLine = content.trim().split('\n')[0];

    // Check for class definition
    if (/^\s*(export\s+)?(abstract\s+)?class\s+/.test(firstLine) ||
        /^\s*class\s+\w+/.test(firstLine)) {
        return 'class';
    }

    // Check for function definition
    if (/^\s*(export\s+)?(async\s+)?function\s+/.test(firstLine) ||
        /^\s*const\s+\w+\s*=\s*(async\s+)?\(/.test(firstLine) ||
        /^\s*def\s+\w+\s*\(/.test(firstLine)) {
        return 'function';
    }

    // Check for module (imports at the start)
    if (/^\s*import\s+/.test(firstLine) ||
        /^\s*from\s+/.test(firstLine) ||
        /^\s*require\s*\(/.test(firstLine)) {
        return 'module';
    }

    return 'block';
}

/**
 * Merge small chunks to avoid fragmentation
 */
export function mergeSmallChunks(
    chunks: CodeChunk[],
    minSize: number = 200
): CodeChunk[] {
    const result: CodeChunk[] = [];
    let pendingChunk: CodeChunk | null = null;

    for (const chunk of chunks) {
        if (pendingChunk) {
            if (pendingChunk.content.length + chunk.content.length < minSize * 3) {
                // Merge with pending
                pendingChunk = {
                    ...pendingChunk,
                    content: pendingChunk.content + '\n' + chunk.content,
                    endLine: chunk.endLine,
                    hash: createHash('md5')
                        .update(pendingChunk.content + '\n' + chunk.content)
                        .digest('hex')
                        .slice(0, 8),
                };
            } else {
                result.push(pendingChunk);
                pendingChunk = chunk;
            }
        } else if (chunk.content.length < minSize) {
            pendingChunk = chunk;
        } else {
            result.push(chunk);
        }
    }

    if (pendingChunk) {
        result.push(pendingChunk);
    }

    return result;
}
