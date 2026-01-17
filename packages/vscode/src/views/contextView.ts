/**
 * Context View Provider
 * Shows context preview in sidebar
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ContextFile {
    path: string;
    score: number;
    tokens: number;
}

export class ContextViewProvider implements vscode.TreeDataProvider<ContextItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ContextItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private context: { files: ContextFile[]; goal: string; tokens: number } | null = null;

    constructor(private extensionUri: vscode.Uri) { }

    refresh(): void {
        this.loadContext().then(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
    }

    private async loadContext(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        try {
            const { stdout } = await execAsync('npx ctx build --json', {
                cwd: workspaceFolder.uri.fsPath,
            });

            // Parse the JSON output
            const lines = stdout.split('\n');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.files) {
                        this.context = {
                            files: parsed.files.map((f: any) => ({
                                path: f.path,
                                score: f.score?.final || 0,
                                tokens: f.tokens || 0,
                            })),
                            goal: parsed.goal || 'General development',
                            tokens: parsed.tokenCount || 0,
                        };
                        return;
                    }
                } catch {
                    // Not JSON, skip
                }
            }
        } catch (error) {
            console.error('Failed to load context:', error);
        }
    }

    getTreeItem(element: ContextItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ContextItem): Thenable<ContextItem[]> {
        if (!this.context) {
            return Promise.resolve([
                new ContextItem('No context loaded', 'info', vscode.TreeItemCollapsibleState.None),
            ]);
        }

        if (!element) {
            // Root level
            return Promise.resolve([
                new ContextItem(
                    `Goal: ${this.context.goal}`,
                    'goal',
                    vscode.TreeItemCollapsibleState.None
                ),
                new ContextItem(
                    `Total: ${this.context.tokens} tokens`,
                    'tokens',
                    vscode.TreeItemCollapsibleState.None
                ),
                new ContextItem(
                    'Files',
                    'folder',
                    vscode.TreeItemCollapsibleState.Expanded,
                    this.context.files
                ),
            ]);
        }

        // File children
        if (element.files) {
            return Promise.resolve(
                element.files.map(f => new ContextItem(
                    `${f.path} (${Math.round(f.score * 100)}%)`,
                    'file',
                    vscode.TreeItemCollapsibleState.None
                ))
            );
        }

        return Promise.resolve([]);
    }
}

class ContextItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: 'goal' | 'tokens' | 'folder' | 'file' | 'info',
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly files?: ContextFile[]
    ) {
        super(label, collapsibleState);

        switch (type) {
            case 'goal':
                this.iconPath = new vscode.ThemeIcon('target');
                break;
            case 'tokens':
                this.iconPath = new vscode.ThemeIcon('symbol-number');
                break;
            case 'folder':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'file':
                this.iconPath = new vscode.ThemeIcon('file-code');
                break;
            case 'info':
                this.iconPath = new vscode.ThemeIcon('info');
                break;
        }
    }
}
