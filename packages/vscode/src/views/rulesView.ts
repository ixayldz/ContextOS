/**
 * Rules View Provider
 * Shows coding rules in sidebar
 */

import * as vscode from 'vscode';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

interface Rule {
    rule: string;
    severity: 'error' | 'warning' | 'info';
    scope?: string;
}

export class RulesViewProvider implements vscode.TreeDataProvider<RuleItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<RuleItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private rules: Rule[] = [];

    constructor(private extensionUri: vscode.Uri) {
        this.loadRules();

        // Watch for context.yaml changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/.contextos/context.yaml');
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
    }

    refresh(): void {
        this.loadRules();
        this._onDidChangeTreeData.fire(undefined);
    }

    private loadRules(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const contextPath = join(workspaceFolder.uri.fsPath, '.contextos', 'context.yaml');

        if (!existsSync(contextPath)) {
            this.rules = [];
            return;
        }

        try {
            const content = readFileSync(contextPath, 'utf-8');
            const yaml = parse(content);
            this.rules = yaml.constraints || [];
        } catch (error) {
            console.error('Failed to load rules:', error);
            this.rules = [];
        }
    }

    getTreeItem(element: RuleItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: RuleItem): Thenable<RuleItem[]> {
        if (!element) {
            if (this.rules.length === 0) {
                return Promise.resolve([
                    new RuleItem('No rules defined', 'info'),
                ]);
            }

            return Promise.resolve(
                this.rules.map(rule => new RuleItem(rule.rule, rule.severity, rule.scope))
            );
        }

        return Promise.resolve([]);
    }
}

class RuleItem extends vscode.TreeItem {
    constructor(
        public readonly rule: string,
        public readonly severity: 'error' | 'warning' | 'info',
        public readonly scope?: string
    ) {
        super(rule, vscode.TreeItemCollapsibleState.None);

        this.tooltip = scope ? `Scope: ${scope}` : undefined;
        this.description = scope;

        switch (severity) {
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
                break;
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
                break;
            case 'info':
                this.iconPath = new vscode.ThemeIcon('info');
                break;
        }
    }
}
