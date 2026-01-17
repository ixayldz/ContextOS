/**
 * Status bar manager for VS Code extension
 */

import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { join } from 'path';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'contextos.preview';
        this.statusBarItem.show();
    }

    update(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            this.statusBarItem.hide();
            return;
        }

        const contextosPath = join(workspaceFolder.uri.fsPath, '.contextos');

        if (existsSync(contextosPath)) {
            this.statusBarItem.text = '$(symbol-namespace) ContextOS';
            this.statusBarItem.tooltip = 'Click to preview context';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = '$(symbol-namespace) ContextOS (not initialized)';
            this.statusBarItem.tooltip = 'Click to initialize ContextOS';
            this.statusBarItem.command = 'contextos.init';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
