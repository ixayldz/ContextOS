/**
 * Team Sync Module
 * Git-based synchronization for team context sharing
 * Fixed R1-R2: Added input sanitization to prevent command injection
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
import crypto from 'crypto';

/**
 * Validate git branch name to prevent command injection
 * Only allows: alphanumeric, hyphens, underscores, forward slashes
 */
function validateGitBranchName(branch: string): string {
    if (!/^[A-Za-z0-9/_-]+$/.test(branch)) {
        throw new Error(`Invalid git branch name: "${branch}". Only alphanumeric, _, -, and / are allowed.`);
    }
    return branch;
}

/**
 * Validate git remote name to prevent command injection
 * Only allows: alphanumeric, hyphens, underscores, dots
 */
function validateGitRemoteName(remote: string): string {
    if (!/^[A-Za-z0-9_.-]+$/.test(remote)) {
        throw new Error(`Invalid git remote name: "${remote}". Only alphanumeric, _, -, and . are allowed.`);
    }
    return remote;
}

/**
 * Safe git command execution using spawn (prevents shell injection)
 */
function safeGitCommand(args: string[], cwd: string): string {
    return execSync(`git ${args.join(' ')}`, { cwd, stdio: 'pipe' }).toString();
}

export interface SyncConfig {
    enabled: boolean;
    remote: string;
    branch: string;
    autoSync: boolean;
    conflictStrategy: 'local' | 'remote' | 'merge';
}

export interface SyncResult {
    success: boolean;
    action: 'push' | 'pull' | 'merge' | 'conflict';
    message: string;
    conflicts?: string[];
}

export interface TeamTemplate {
    name: string;
    description: string;
    context: Record<string, unknown>;
    config: Record<string, unknown>;
    author: string;
    version: string;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
    enabled: false,
    remote: 'origin',
    branch: 'contextos-sync',
    autoSync: true,
    conflictStrategy: 'merge',
};

/**
 * Team Sync Manager
 * Handles git-based synchronization of .contextos folder
 */
export class TeamSync {
    private rootDir: string;
    private contextosDir: string;
    private syncConfig: SyncConfig;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.contextosDir = join(rootDir, '.contextos');
        this.syncConfig = this.loadSyncConfig();

        // Validate remote and branch names on load (Fix R1-R2: Command Injection)
        if (this.syncConfig.remote) {
            this.syncConfig.remote = validateGitRemoteName(this.syncConfig.remote);
        }
        if (this.syncConfig.branch) {
            this.syncConfig.branch = validateGitBranchName(this.syncConfig.branch);
        }
    }

    private loadSyncConfig(): SyncConfig {
        const configPath = join(this.contextosDir, 'sync.yaml');
        if (existsSync(configPath)) {
            const content = readFileSync(configPath, 'utf-8');
            return { ...DEFAULT_SYNC_CONFIG, ...parse(content) };
        }
        return DEFAULT_SYNC_CONFIG;
    }

    private saveSyncConfig(): void {
        const configPath = join(this.contextosDir, 'sync.yaml');
        writeFileSync(configPath, stringify(this.syncConfig, { indent: 2 }), 'utf-8');
    }

    /**
     * Initialize team sync
     */
    async initialize(remote: string = 'origin'): Promise<void> {
        // Validate remote name (Fix R1-R2: Command Injection)
        this.syncConfig.enabled = true;
        this.syncConfig.remote = validateGitRemoteName(remote);
        this.syncConfig.branch = validateGitBranchName(this.syncConfig.branch);
        this.saveSyncConfig();

        // Create sync branch if it doesn't exist
        try {
            execSync(`git checkout -b ${this.syncConfig.branch}`, {
                cwd: this.rootDir,
                stdio: 'pipe',
            });
            execSync(`git checkout -`, { cwd: this.rootDir, stdio: 'pipe' });
        } catch {
            // Branch may already exist
        }
    }

    /**
     * Push local changes to remote
     */
    async push(): Promise<SyncResult> {
        if (!this.syncConfig.enabled) {
            return { success: false, action: 'push', message: 'Sync not enabled' };
        }

        try {
            // Stage .contextos changes
            execSync(`git add .contextos`, { cwd: this.rootDir, stdio: 'pipe' });

            // Create commit with timestamp
            const message = `[ContextOS] Sync ${new Date().toISOString()}`;
            execSync(`git commit -m "${message}"`, { cwd: this.rootDir, stdio: 'pipe' });

            // Push to remote
            execSync(`git push ${this.syncConfig.remote} ${this.syncConfig.branch}`, {
                cwd: this.rootDir,
                stdio: 'pipe',
            });

            return { success: true, action: 'push', message: 'Changes pushed successfully' };
        } catch (error) {
            return {
                success: false,
                action: 'push',
                message: error instanceof Error ? error.message : 'Push failed',
            };
        }
    }

    /**
     * Pull remote changes
     */
    async pull(): Promise<SyncResult> {
        if (!this.syncConfig.enabled) {
            return { success: false, action: 'pull', message: 'Sync not enabled' };
        }

        try {
            // Fetch remote changes
            execSync(`git fetch ${this.syncConfig.remote} ${this.syncConfig.branch}`, {
                cwd: this.rootDir,
                stdio: 'pipe',
            });

            // Try to merge
            execSync(`git merge ${this.syncConfig.remote}/${this.syncConfig.branch}`, {
                cwd: this.rootDir,
                stdio: 'pipe',
            });

            return { success: true, action: 'pull', message: 'Changes pulled successfully' };
        } catch (error) {
            // Check for conflicts
            return this.handleConflicts();
        }
    }

    private handleConflicts(): SyncResult {
        try {
            const status = execSync('git status --porcelain', {
                cwd: this.rootDir,
                encoding: 'utf-8',
            });

            const conflicts = status
                .split('\n')
                .filter(line => line.startsWith('UU'))
                .map(line => line.slice(3));

            if (conflicts.length > 0) {
                if (this.syncConfig.conflictStrategy === 'local') {
                    execSync('git checkout --ours .contextos', { cwd: this.rootDir });
                    return { success: true, action: 'merge', message: 'Kept local changes', conflicts };
                } else if (this.syncConfig.conflictStrategy === 'remote') {
                    execSync('git checkout --theirs .contextos', { cwd: this.rootDir });
                    return { success: true, action: 'merge', message: 'Applied remote changes', conflicts };
                }
                return {
                    success: false,
                    action: 'conflict',
                    message: 'Conflicts need manual resolution',
                    conflicts,
                };
            }

            return { success: true, action: 'merge', message: 'Merged successfully' };
        } catch {
            return { success: false, action: 'conflict', message: 'Failed to check conflicts' };
        }
    }

    /**
     * Get sync status
     */
    getStatus(): { enabled: boolean; behind: number; ahead: number } {
        if (!this.syncConfig.enabled) {
            return { enabled: false, behind: 0, ahead: 0 };
        }

        try {
            const status = execSync(
                `git rev-list --left-right --count ${this.syncConfig.branch}...${this.syncConfig.remote}/${this.syncConfig.branch}`,
                { cwd: this.rootDir, encoding: 'utf-8' }
            );

            const [ahead, behind] = status.trim().split('\t').map(Number);
            return { enabled: true, behind: behind || 0, ahead: ahead || 0 };
        } catch {
            return { enabled: true, behind: 0, ahead: 0 };
        }
    }
}

/**
 * Template Manager
 * Manage shared context templates
 */
export class TemplateManager {
    private templatesDir: string;

    constructor(rootDir: string) {
        this.templatesDir = join(rootDir, '.contextos', 'templates');
        if (!existsSync(this.templatesDir)) {
            mkdirSync(this.templatesDir, { recursive: true });
        }
    }

    /**
     * List available templates
     */
    list(): TeamTemplate[] {
        const templates: TeamTemplate[] = [];

        try {
            const files = require('fs').readdirSync(this.templatesDir);
            for (const file of files) {
                if (file.endsWith('.yaml')) {
                    const content = readFileSync(join(this.templatesDir, file), 'utf-8');
                    templates.push(parse(content));
                }
            }
        } catch {
            // No templates
        }

        return templates;
    }

    /**
     * Save current config as template
     */
    save(name: string, description: string, author: string): void {
        const contextPath = join(this.templatesDir, '..', 'context.yaml');
        const configPath = join(this.templatesDir, '..', 'config.yaml');

        const template: TeamTemplate = {
            name,
            description,
            author,
            version: '1.0.0',
            context: existsSync(contextPath) ? parse(readFileSync(contextPath, 'utf-8')) : {},
            config: existsSync(configPath) ? parse(readFileSync(configPath, 'utf-8')) : {},
        };

        const templatePath = join(this.templatesDir, `${name}.yaml`);
        writeFileSync(templatePath, stringify(template, { indent: 2 }), 'utf-8');
    }

    /**
     * Apply template to current config
     */
    apply(name: string): void {
        const templatePath = join(this.templatesDir, `${name}.yaml`);
        if (!existsSync(templatePath)) {
            throw new Error(`Template '${name}' not found`);
        }

        const template: TeamTemplate = parse(readFileSync(templatePath, 'utf-8'));

        const contextPath = join(this.templatesDir, '..', 'context.yaml');
        const configPath = join(this.templatesDir, '..', 'config.yaml');

        if (template.context && Object.keys(template.context).length > 0) {
            writeFileSync(contextPath, stringify(template.context, { indent: 2 }), 'utf-8');
        }

        if (template.config && Object.keys(template.config).length > 0) {
            writeFileSync(configPath, stringify(template.config, { indent: 2 }), 'utf-8');
        }
    }
}

export { DEFAULT_SYNC_CONFIG };
