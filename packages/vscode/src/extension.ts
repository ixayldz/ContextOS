/**
 * ContextOS VS Code Extension
 * Provides IDE integration for context management
 */

import * as vscode from 'vscode';
import { ContextViewProvider } from './views/contextView';
import { RulesViewProvider } from './views/rulesView';
import { StatusBarManager } from './statusBar';
import * as commands from './commands';

let statusBar: StatusBarManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('ContextOS extension is now active');

    // Initialize status bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // Register tree view providers
    const contextViewProvider = new ContextViewProvider(context.extensionUri);
    const rulesViewProvider = new RulesViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('contextos.contextView', contextViewProvider),
        vscode.window.registerTreeDataProvider('contextos.rulesView', rulesViewProvider)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('contextos.init', () => commands.init()),
        vscode.commands.registerCommand('contextos.build', () => commands.build()),
        vscode.commands.registerCommand('contextos.copy', () => commands.copy()),
        vscode.commands.registerCommand('contextos.preview', () => {
            contextViewProvider.refresh();
            vscode.commands.executeCommand('contextos.contextView.focus');
        }),
        vscode.commands.registerCommand('contextos.doctor', () => commands.doctor()),
        vscode.commands.registerCommand('contextos.suggestRules', () => commands.suggestRules())
    );

    // Auto-index on save if enabled
    const config = vscode.workspace.getConfiguration('contextos');
    if (config.get('autoIndex')) {
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (doc) => {
                if (shouldIndex(doc)) {
                    await commands.indexFile(doc.fileName);
                    statusBar.update();
                }
            })
        );
    }

    // Update status bar
    statusBar.update();
}

export function deactivate() {
    if (statusBar) {
        statusBar.dispose();
    }
}

function shouldIndex(doc: vscode.TextDocument): boolean {
    const ignoredExtensions = ['.json', '.md', '.txt', '.yml', '.yaml'];
    const ignoredPaths = ['node_modules', 'dist', '.git', '.contextos'];

    const uri = doc.uri.fsPath;

    if (ignoredExtensions.some(ext => uri.endsWith(ext))) {
        return false;
    }

    if (ignoredPaths.some(path => uri.includes(path))) {
        return false;
    }

    return true;
}
