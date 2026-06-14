import * as vscode from 'vscode';
import { ExporterWebviewPanel } from '../webview/webview.panel';
import { ExtensionState } from '../interfaces/export.interface';

export function registerCommands(context: vscode.ExtensionContext, webviewPanelManager: ExporterWebviewPanel, state: ExtensionState) {
    const openCmd = vscode.commands.registerCommand('files-exporter.openTool', () => handleOpenTool(webviewPanelManager));
    const addCmd = vscode.commands.registerCommand('files-exporter.addFromExplorer', (uri: vscode.Uri, selectedUris: vscode.Uri[]) => handleAddFromExplorer(uri, selectedUris, state, webviewPanelManager));
    const excludeCmd = vscode.commands.registerCommand('files-exporter.ExcludeFromExplorer', (uri: vscode.Uri, selectedUris: vscode.Uri[]) => handleExcludeFromExplorer(uri, selectedUris, webviewPanelManager));

    context.subscriptions.push(openCmd, addCmd, excludeCmd);
}

function handleOpenTool(webviewPanelManager: ExporterWebviewPanel) {
    webviewPanelManager.show('open');
}

function handleAddFromExplorer(uri: vscode.Uri, selectedUris: vscode.Uri[], state: ExtensionState, webviewPanelManager: ExporterWebviewPanel) {
    const uris = selectedUris || (uri ? [uri] : []);
    uris.forEach(u => {
        if (u && !state.selectedPaths.includes(u.fsPath)) {
            state.selectedPaths.push(u.fsPath);
        }
    });
    webviewPanelManager.show('add');
}

function handleExcludeFromExplorer(uri: vscode.Uri, selectedUris: vscode.Uri[], webviewPanelManager: ExporterWebviewPanel) {
    const uris = selectedUris || (uri ? [uri] : []);
    uris.forEach(u => {
        if (u) {
            webviewPanelManager.excludePathFromExplorer(u.fsPath);
        }
    });
}
