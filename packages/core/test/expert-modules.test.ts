/**
 * Tests for Expert-Recommended Modules
 * Proposal System, Blackboard, and Scope Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    ProposalManager,
    createProposalManager,
    Blackboard,
    createBlackboard,
    getGlobalBlackboard,
    resetGlobalBlackboard,
    ScopeManager,
    createScopeManager,
} from '../src/rlm/index.js';

describe('ProposalManager (Transaction Layer)', () => {
    let manager: ProposalManager;

    beforeEach(() => {
        manager = createProposalManager();
    });

    describe('createProposal', () => {
        it('should create a proposal with pending status', () => {
            const proposal = manager.createProposal(
                'Rename function',
                'Rename auth() to authenticate()',
                [{
                    path: 'src/auth.ts',
                    type: 'modify',
                    originalContent: 'function auth() {}',
                    proposedContent: 'function authenticate() {}',
                    reason: 'Better naming',
                    confidence: 0.9,
                }],
                'agent-1'
            );

            expect(proposal.id).toMatch(/^prop_/);
            expect(proposal.status).toBe('pending');
            expect(proposal.changes).toHaveLength(1);
        });
    });

    describe('validate', () => {
        it('should validate proposal syntax', () => {
            const proposal = manager.createProposal(
                'Add feature',
                'Add new function',
                [{
                    path: 'src/utils.ts',
                    type: 'modify',
                    proposedContent: 'function test() { return true; }',
                    reason: 'New feature',
                    confidence: 0.95,
                }],
                'agent-1'
            );

            const result = manager.validate(proposal.id);
            expect(result.valid).toBe(true);
            expect(result.syntaxErrors).toHaveLength(0);
        });

        it('should detect syntax errors', () => {
            const proposal = manager.createProposal(
                'Bad code',
                'Unbalanced braces',
                [{
                    path: 'src/broken.ts',
                    type: 'modify',
                    proposedContent: 'function test() {',
                    reason: 'Test',
                    confidence: 0.5,
                }],
                'agent-1'
            );

            const result = manager.validate(proposal.id);
            expect(result.valid).toBe(false);
            expect(result.syntaxErrors.length).toBeGreaterThan(0);
        });

        it('should warn on low confidence', () => {
            const proposal = manager.createProposal(
                'Low confidence',
                'Uncertain change',
                [{
                    path: 'src/test.ts',
                    type: 'modify',
                    proposedContent: 'x = 1',
                    reason: 'Not sure',
                    confidence: 0.3,
                }],
                'agent-1'
            );

            const result = manager.validate(proposal.id);
            expect(result.warnings.some(w => w.includes('Low confidence'))).toBe(true);
        });
    });

    describe('approve/reject', () => {
        it('should approve valid proposals', () => {
            const proposal = manager.createProposal(
                'Valid change',
                'Test',
                [{
                    path: 'src/test.ts',
                    type: 'create',
                    proposedContent: 'export const x = 1;',
                    reason: 'New file',
                    confidence: 0.9,
                }],
                'agent-1'
            );

            const approved = manager.approve(proposal.id);
            expect(approved).toBe(true);
            expect(manager.get(proposal.id)?.status).toBe('approved');
        });

        it('should reject proposals', () => {
            const proposal = manager.createProposal(
                'Rejected',
                'Test',
                [],
                'agent-1'
            );

            const rejected = manager.reject(proposal.id, 'Not needed');
            expect(rejected).toBe(true);
            expect(manager.get(proposal.id)?.status).toBe('rejected');
        });
    });

    describe('generateDiffPreview', () => {
        it('should generate readable diff preview', () => {
            const proposal = manager.createProposal(
                'Update config',
                'Change settings',
                [{
                    path: 'config.ts',
                    type: 'modify',
                    originalContent: 'const x = 1;',
                    proposedContent: 'const x = 2;',
                    reason: 'Update value',
                    confidence: 0.85,
                }],
                'agent-1'
            );

            const preview = manager.generateDiffPreview(proposal.id);
            expect(preview).toContain('Update config');
            expect(preview).toContain('MODIFY: config.ts');
            expect(preview).toContain('85%');
        });
    });
});

describe('Blackboard (Shared State)', () => {
    let blackboard: Blackboard;

    beforeEach(() => {
        blackboard = createBlackboard();
    });

    describe('post and query', () => {
        it('should post and retrieve facts', () => {
            const fact = blackboard.post(
                'discovery',
                'Found global variable usage',
                'agent-1',
                { path: 'src/index.ts', confidence: 0.9 }
            );

            expect(fact.id).toMatch(/^fact_/);
            expect(blackboard.get(fact.id)).toEqual(fact);
        });

        it('should query by type', () => {
            blackboard.post('warning', 'Security issue', 'agent-1');
            blackboard.post('discovery', 'Pattern found', 'agent-1');
            blackboard.post('warning', 'Performance issue', 'agent-2');

            const warnings = blackboard.query({ type: 'warning' });
            expect(warnings).toHaveLength(2);
        });

        it('should query by path', () => {
            blackboard.post('discovery', 'Fact 1', 'agent-1', { path: 'src/a.ts' });
            blackboard.post('discovery', 'Fact 2', 'agent-1', { path: 'src/b.ts' });
            blackboard.post('discovery', 'Fact 3', 'agent-1', { path: 'src/a.ts' });

            const results = blackboard.getForPath('src/a.ts');
            expect(results).toHaveLength(2);
        });
    });

    describe('getSummary', () => {
        it('should provide summary statistics', () => {
            blackboard.post('warning', 'W1', 'agent-1');
            blackboard.post('discovery', 'D1', 'agent-2');
            blackboard.post('discovery', 'D2', 'agent-1');

            const summary = blackboard.getSummary();
            expect(summary.total).toBe(3);
            expect(summary.byType['warning']).toBe(1);
            expect(summary.byType['discovery']).toBe(2);
            expect(summary.byAgent['agent-1']).toBe(2);
        });
    });

    describe('global blackboard', () => {
        it('should provide singleton access', () => {
            resetGlobalBlackboard();
            const bb1 = getGlobalBlackboard();
            const bb2 = getGlobalBlackboard();
            expect(bb1).toBe(bb2);
        });
    });
});

describe('ScopeManager (Anti-Indexing)', () => {
    let manager: ScopeManager;

    beforeEach(() => {
        manager = createScopeManager();
    });

    describe('calculateScope', () => {
        it('should apply frontend rules for frontend goals', () => {
            const scope = manager.calculateScope('Add new React component');

            expect(scope.rules.some(r => r.name === 'frontend-focus')).toBe(true);
            expect(scope.effectiveExcludes).toContain('src/api/**');
        });

        it('should apply backend rules for backend goals', () => {
            const scope = manager.calculateScope('Fix API endpoint bug');

            expect(scope.rules.some(r => r.name === 'backend-focus')).toBe(true);
            expect(scope.effectiveExcludes).toContain('src/components/**');
        });

        it('should apply security rules for security goals', () => {
            const scope = manager.calculateScope('Analyze authentication vulnerabilities');

            expect(scope.rules.some(r => r.name === 'security-focus')).toBe(true);
            expect(scope.effectiveIncludes).toContain('**/auth/**');
        });
    });

    describe('shouldInclude', () => {
        it('should exclude node_modules by default', () => {
            const scope = manager.calculateScope('Any goal');

            expect(manager.shouldInclude('node_modules/lodash/index.js', scope)).toBe(false);
        });

        it('should respect scope includes', () => {
            const scope = manager.calculateScope('Add React component');

            // Frontend files should be included
            expect(manager.shouldInclude('src/components/Button.tsx', scope)).toBe(true);
        });
    });

    describe('addRule', () => {
        it('should add custom rules', () => {
            manager.addRule({
                name: 'custom-rule',
                description: 'Custom test rule',
                when: { type: 'goal_contains', value: 'custom' },
                include: ['custom/**'],
                exclude: ['other/**'],
                priority: 100,
            });

            const scope = manager.calculateScope('Do custom task');
            expect(scope.rules.some(r => r.name === 'custom-rule')).toBe(true);
        });
    });
});
