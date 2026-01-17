/**
 * YAML Schema Definitions using Zod
 * Validates context.yaml and config.yaml files
 */

import { z } from 'zod';

// ============================================================================
// context.yaml Schema
// ============================================================================

export const SupportedLanguageSchema = z.enum([
    'typescript',
    'javascript',
    'python',
    'go',
    'rust',
    'java',
]);

export const ProjectConfigSchema = z.object({
    name: z.string().min(1, 'Project name is required'),
    language: SupportedLanguageSchema,
    framework: z.string().optional(),
    description: z.string().optional(),
});

export const StackConfigSchema = z.record(z.string()).optional();

export const ConstraintSchema = z.object({
    rule: z.string().min(1, 'Rule text is required'),
    severity: z.enum(['error', 'warning', 'info']).default('warning'),
    autofix: z.boolean().optional().default(false),
    suggestion: z.string().optional(),
    related: z.array(z.string()).optional(),
});

export const BoundarySchema = z.object({
    name: z.string().min(1),
    allow: z.array(z.string()),
    deny: z.array(z.string()),
});

export const MetaSchema = z.object({
    last_indexed: z.string().datetime().optional(),
    index_version: z.string().optional(),
    contributors: z.number().int().positive().optional(),
    total_files: z.number().int().positive().optional(),
});

export const ContextYamlSchema = z.object({
    version: z.string().default('3.1'),
    project: ProjectConfigSchema,
    stack: StackConfigSchema,
    constraints: z.array(ConstraintSchema).optional().default([]),
    boundaries: z.array(BoundarySchema).optional().default([]),
    meta: MetaSchema.optional(),
});

// ============================================================================
// config.yaml Schema
// ============================================================================

export const IndexingConfigSchema = z.object({
    watch_mode: z.boolean().default(true),
    ignore_patterns: z.array(z.string()).default([
        '**/*.test.ts',
        '**/*.spec.ts',
        'node_modules/**',
        'dist/**',
        '.git/**',
    ]),
    file_size_limit: z.string().default('1MB'),
});

export const GraphConfigSchema = z.object({
    max_depth: z.number().int().min(1).max(10).default(2),
    follow_types: z.array(z.string()).default(['import', 'require', 'export']),
    include_types: z.boolean().default(true),
});

export const EmbeddingConfigSchema = z.object({
    strategy: z.enum(['local', 'cloud', 'adaptive']).default('adaptive'),
    provider: z.string().default('local'),
    model: z.string().default('all-MiniLM-L6-v2'),
    chunk_size: z.number().int().min(100).max(2000).default(512),
    overlap: z.number().int().min(0).max(200).default(50),
});

export const BudgetingConfigSchema = z.object({
    strategy: z.enum(['auto', 'fixed', 'adaptive']).default('adaptive'),
    target_model: z.string().optional(),
});

export const AnalyticsConfigSchema = z.object({
    enabled: z.boolean().default(false),
    anonymous_metrics: z.boolean().default(true),
    report_frequency: z.string().default('weekly'),
});

export const ConfigYamlSchema = z.object({
    indexing: IndexingConfigSchema.default({}),
    graph: GraphConfigSchema.default({}),
    embedding: EmbeddingConfigSchema.default({}),
    budgeting: BudgetingConfigSchema.default({}),
    analytics: AnalyticsConfigSchema.optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ContextYamlInput = z.input<typeof ContextYamlSchema>;
export type ContextYamlOutput = z.output<typeof ContextYamlSchema>;
export type ConfigYamlInput = z.input<typeof ConfigYamlSchema>;
export type ConfigYamlOutput = z.output<typeof ConfigYamlSchema>;
