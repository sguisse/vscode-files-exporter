import * as vscode from 'vscode';
import { ConfigService } from './services/config.service';
import { HistoryService } from './services/history.service';
import { ProcessRunnerService } from './services/process-runner.service';
import { ExporterWebviewPanel } from './webview/webview.panel';
import { ExtensionState } from './interfaces/export.interface';

export function activate(context: vscode.ExtensionContext) {
    const configService = new ConfigService();
    const historyService = new HistoryService(configService.getHistoryFilePath());
    const processRunner = new ProcessRunnerService();

    const state: ExtensionState = { selectedPaths: [] };

    const webviewPanelManager = new ExporterWebviewPanel(
        context,
        configService,
        historyService,
        processRunner,
        state
    );

    const openCmd = vscode.commands.registerCommand('files-exporter.openTool', () => {
        webviewPanelManager.show('open');
    });

    const addCmd = vscode.commands.registerCommand('files-exporter.addFromExplorer', (uri: vscode.Uri, selectedUris: vscode.Uri[]) => {
        const uris = selectedUris || (uri ? [uri] : []);

        uris.forEach(u => {
            if (u && !state.selectedPaths.includes(u.fsPath)) {
                state.selectedPaths.push(u.fsPath);
            }
        });

        webviewPanelManager.show('add');
    });

    const excludeCmd = vscode.commands.registerCommand('files-exporter.ExcludeFromExplorer', (uri: vscode.Uri, selectedUris: vscode.Uri[]) => {
        const uris = selectedUris || (uri ? [uri] : []);
        uris.forEach(u => {
            if (u) {
                webviewPanelManager.excludePathFromExplorer(u.fsPath);
            }
        });
    });

    context.subscriptions.push(openCmd, addCmd, excludeCmd);
}

export function deactivate() {}
