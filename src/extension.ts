import * as vscode from 'vscode';
import { ConfigService } from './services/config.service';
import { HistoryService } from './services/history.service';
import { ProcessRunnerService } from './services/process-runner.service';
import { ExporterWebviewPanel } from './webview/webview.panel';
import { ExtensionState } from './interfaces/export.interface';
import { registerCommands } from './commands/extension-commands';

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

    registerCommands(context, webviewPanelManager, state);
}
export function deactivate() {}
