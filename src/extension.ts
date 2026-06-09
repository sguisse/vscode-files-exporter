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
        // Protection robuste si clic droit fait en dehors d'un fichier explicite
        const uris = selectedUris || (uri ? [uri] : []);

        uris.forEach(u => {
            if (u && !state.selectedPaths.includes(u.fsPath)) {
                state.selectedPaths.push(u.fsPath);
            }
        });

        webviewPanelManager.show('add');
    });

    context.subscriptions.push(openCmd, addCmd);
}

export function deactivate() {}
