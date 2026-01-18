/**
 * Proposal System (Transaction Layer)
 *
 * Implements the expert recommendation for "Transactional File System Layer"
 * Agents produce Proposals instead of direct writes; Merge Manager validates and applies
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Represents a proposed change to a file
 */
export interface FileChange {
    path: string;
    type: 'create' | 'modify' | 'delete' | 'rename';
    originalContent?: string;
    proposedContent?: string;
    newPath?: string; // For renames
    reason: string;
    confidence: number;
}

/**
 * A proposal is a collection of changes that should be applied atomically
 */
export interface Proposal {
    id: string;
    title: string;
    description: string;
    changes: FileChange[];
    createdAt: Date;
    agentId: string;
    parentProposalId?: string; // For sub-agent proposals
    status: 'pending' | 'approved' | 'rejected' | 'applied' | 'conflict';
    conflicts?: ConflictInfo[];
    validationResult?: ValidationResult;
}

export interface ConflictInfo {
    path: string;
    type: 'modified_since_read' | 'concurrent_modification' | 'file_deleted';
    otherProposalId?: string;
    description: string;
}

export interface ValidationResult {
    valid: boolean;
    syntaxErrors: Array<{ path: string; error: string; line?: number }>;
    warnings: string[];
}

/**
 * Manages proposals from agents and handles conflict detection
 */
export class ProposalManager {
    private proposals: Map<string, Proposal> = new Map();
    private fileSnapshots: Map<string, { hash: string; timestamp: Date }> = new Map();
    private appliedChanges: Map<string, string[]> = new Map(); // path -> proposalIds

    /**
     * Create a new proposal
     */
    createProposal(
        title: string,
        description: string,
        changes: FileChange[],
        agentId: string,
        parentProposalId?: string
    ): Proposal {
        const id = this.generateId();

        const proposal: Proposal = {
            id,
            title,
            description,
            changes,
            createdAt: new Date(),
            agentId,
            parentProposalId,
            status: 'pending',
        };

        this.proposals.set(id, proposal);
        return proposal;
    }

    /**
     * Validate a proposal for conflicts and syntax errors
     */
    validate(proposalId: string): ValidationResult {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) {
            return { valid: false, syntaxErrors: [], warnings: ['Proposal not found'] };
        }

        const conflicts: ConflictInfo[] = [];
        const syntaxErrors: Array<{ path: string; error: string; line?: number }> = [];
        const warnings: string[] = [];

        for (const change of proposal.changes) {
            // Check for concurrent modifications
            const snapshot = this.fileSnapshots.get(change.path);
            if (snapshot && change.originalContent) {
                const currentHash = this.hashContent(change.originalContent);
                if (currentHash !== snapshot.hash) {
                    conflicts.push({
                        path: change.path,
                        type: 'modified_since_read',
                        description: `File ${change.path} was modified after it was read`,
                    });
                }
            }

            // Check for pending proposals on same file
            const pendingOnPath = this.findPendingProposalsForPath(change.path, proposalId);
            for (const pending of pendingOnPath) {
                conflicts.push({
                    path: change.path,
                    type: 'concurrent_modification',
                    otherProposalId: pending.id,
                    description: `Proposal ${pending.id} also modifies ${change.path}`,
                });
            }

            // Basic syntax validation (check for common issues)
            if (change.proposedContent && change.type !== 'delete') {
                const syntaxIssues = this.checkBasicSyntax(change.path, change.proposedContent);
                syntaxErrors.push(...syntaxIssues);
            }

            // Confidence warning
            if (change.confidence < 0.7) {
                warnings.push(`Low confidence (${(change.confidence * 100).toFixed(0)}%) for change to ${change.path}`);
            }
        }

        proposal.conflicts = conflicts;
        proposal.validationResult = {
            valid: conflicts.length === 0 && syntaxErrors.length === 0,
            syntaxErrors,
            warnings,
        };

        if (conflicts.length > 0) {
            proposal.status = 'conflict';
        }

        return proposal.validationResult;
    }

    /**
     * Approve a proposal for application
     */
    approve(proposalId: string): boolean {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.status !== 'pending') {
            return false;
        }

        // Re-validate before approval
        const validation = this.validate(proposalId);
        if (!validation.valid) {
            return false;
        }

        proposal.status = 'approved';
        return true;
    }

    /**
     * Reject a proposal
     */
    reject(proposalId: string, reason?: string): boolean {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) return false;

        proposal.status = 'rejected';
        if (reason) {
            proposal.description += `\n\nRejection reason: ${reason}`;
        }
        return true;
    }

    /**
     * Mark a proposal as applied and record the changes
     */
    markApplied(proposalId: string): boolean {
        const proposal = this.proposals.get(proposalId);
        if (!proposal || proposal.status !== 'approved') {
            return false;
        }

        proposal.status = 'applied';

        // Record which proposals modified which files
        for (const change of proposal.changes) {
            const applied = this.appliedChanges.get(change.path) || [];
            applied.push(proposalId);
            this.appliedChanges.set(change.path, applied);

            // Update snapshot
            if (change.proposedContent) {
                this.fileSnapshots.set(change.path, {
                    hash: this.hashContent(change.proposedContent),
                    timestamp: new Date(),
                });
            }
        }

        return true;
    }

    /**
     * Get all pending proposals
     */
    getPending(): Proposal[] {
        return Array.from(this.proposals.values()).filter(p => p.status === 'pending');
    }

    /**
     * Get proposal by ID
     */
    get(proposalId: string): Proposal | undefined {
        return this.proposals.get(proposalId);
    }

    /**
     * Record a file read for conflict detection
     */
    recordFileRead(path: string, content: string): void {
        this.fileSnapshots.set(path, {
            hash: this.hashContent(content),
            timestamp: new Date(),
        });
    }

    /**
     * Generate diff preview for a proposal
     */
    generateDiffPreview(proposalId: string): string {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) return '';

        const lines: string[] = [
            `# Proposal: ${proposal.title}`,
            `ID: ${proposal.id}`,
            `Status: ${proposal.status}`,
            `Changes: ${proposal.changes.length} file(s)`,
            '',
        ];

        for (const change of proposal.changes) {
            lines.push(`## ${change.type.toUpperCase()}: ${change.path}`);
            lines.push(`Reason: ${change.reason}`);
            lines.push(`Confidence: ${(change.confidence * 100).toFixed(0)}%`);
            lines.push('');

            if (change.type === 'modify' && change.originalContent && change.proposedContent) {
                // Simple diff indication
                const origLines = change.originalContent.split('\n').length;
                const newLines = change.proposedContent.split('\n').length;
                lines.push(`Lines: ${origLines} → ${newLines} (${newLines - origLines >= 0 ? '+' : ''}${newLines - origLines})`);
            }
            lines.push('---');
        }

        return lines.join('\n');
    }

    // Private helpers
    private generateId(): string {
        // Use cryptographically secure random bytes (Fix N4: Weak Random ID)
        const bytes = randomBytes(16);
        const hex = bytes.toString('hex');
        const timestamp = Date.now().toString(36);
        return `prop_${timestamp}_${hex.substring(0, 16)}`;
    }

    private hashContent(content: string): string {
        return createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    private findPendingProposalsForPath(path: string, excludeId: string): Proposal[] {
        return Array.from(this.proposals.values()).filter(
            p => p.status === 'pending' && p.id !== excludeId && p.changes.some(c => c.path === path)
        );
    }

    private checkBasicSyntax(path: string, content: string): Array<{ path: string; error: string; line?: number }> {
        const errors: Array<{ path: string; error: string; line?: number }> = [];

        // Check for unbalanced braces/brackets (basic check)
        const brackets = { '{': 0, '[': 0, '(': 0 };
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const char of line) {
                if (char === '{') brackets['{']++;
                if (char === '}') brackets['{']--;
                if (char === '[') brackets['[']++;
                if (char === ']') brackets['[']--;
                if (char === '(') brackets['(']++;
                if (char === ')') brackets['(']--;
            }
        }

        if (brackets['{'] !== 0) {
            errors.push({ path, error: 'Unbalanced curly braces', line: undefined });
        }
        if (brackets['['] !== 0) {
            errors.push({ path, error: 'Unbalanced square brackets', line: undefined });
        }
        if (brackets['('] !== 0) {
            errors.push({ path, error: 'Unbalanced parentheses', line: undefined });
        }

        return errors;
    }
}

/**
 * Factory function
 */
export function createProposalManager(): ProposalManager {
    return new ProposalManager();
}
