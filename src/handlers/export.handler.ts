import * as vscode from 'vscode';
import { ExportOrchestratorService } from '../services/export-orchestrator.service';
import { HistoryService } from '../services/history.service';
import { ConfigService } from '../services/config.service';

export class ExportHandler {
    constructor(
        private panel: vscode.WebviewPanel,
        private orchestrator: ExportOrchestratorService,
        private historyService: HistoryService,
        private configService: ConfigService
    ) {}

    public async handleRunExport(message: any) {
        const repoRun = this.configService.getRepoName();
        const result = await this.historyService.saveHistory(message.data, message.currentHistoryId, repoRun);
        this.panel.webview.postMessage({ command: 'updateHistory', history: result.history, selectedId: result.selectedId, skipFieldSync: true });
        await this.orchestrator.run(message.data);
    }

    public handleKillExport() {
        const killed = this.orchestrator.cancelActiveExport();
        if (killed) {
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\n🛑 Export process killed manually via interface selection parameters.\n` });
            this.panel.webview.postMessage({ command: 'terminalLog', text: 'Export aborted.' });
            vscode.window.showWarningMessage("Export Process Terminated Successfully.");
        }
    }
}
