import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../services/config.service';
import { HistoryService } from '../services/history.service';
import { ProcessRunnerService } from '../services/process-runner.service';
import { ExtensionState } from '../interfaces/export.interface';
import { ExportOrchestratorService } from '../services/export-orchestrator.service';
import { MessageRouter } from '../handlers/message.router';

export class ExporterWebviewPanel {
    private _panel: vscode.WebviewPanel | undefined;
    private _currentLaunchType: 'open' | 'add' = 'open';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configService: ConfigService,
        private readonly historyService: HistoryService,
        private readonly processRunner: ProcessRunnerService,
        private readonly state: ExtensionState
    ) {}

    public show(launchType: 'open' | 'add') {
        this._currentLaunchType = launchType;

        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            if (launchType === 'add') this.updatePaths();

            this.pinPanelIfEnabled();
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            'filesExporterUI', 'Files Exporter Tool', vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview')]
            }
        );

        this._panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'icon.png');

        this._panel.webview.html = this.getHtmlContent();
        this._panel.onDidDispose(() => this._panel = undefined);

        this.registerMessageRouter();
        this.initWebviewData(this._currentLaunchType);

        this.pinPanelIfEnabled();
    }

    private pinPanelIfEnabled() {
        if (this.configService.shouldPinWebview()) {
            vscode.commands.executeCommand('workbench.action.pinEditor');
        }
    }

    private updatePaths() {
        this._panel?.webview.postMessage({ command: 'updatePaths', paths: this.state.selectedPaths });
    }

    private async initWebviewData(launchType: 'open' | 'add') {
        const currentRepo = this.configService.getRepoName();
        const wrapper = await this.historyService.getFullWrapper(currentRepo);
        const history = wrapper.history;

        const repoEntry = wrapper.config.repo.find((r: any) => r.repo === currentRepo);
        const historyViewMode = repoEntry ? repoEntry.historyViewMode : 'scope-current-repo';
        const lastRunId = repoEntry ? repoEntry.lastRunConfigId : 'default';

        const workspacePath = this.configService.getWorkspaceRootPath();
        const extensionConfig = this.configService.getConfiguration();
        const tooltipDelay = extensionConfig.get<number>('tooltipDelay') || 400;

        const defaultSettings = {
            src: workspacePath,
            dest: path.join(workspacePath, "exported-files"),
            format: extensionConfig.get<string>('defaultFormat') || 'yaml',
            max_file: (extensionConfig.get<number>('maxFileSizeKb') ?? 50).toString(),
            max_chunk: (extensionConfig.get<number>('maxChunkSizeKb') ?? 0).toString(),
            groupByExt: extensionConfig.get<boolean>('splitChunkByFileExtension') ?? false,
            copyGeneratedFilesToClipboard: extensionConfig.get<boolean>('copyGeneratedFilesToClipboard') ?? true,
            generateTreeView: extensionConfig.get<boolean>('generateTreeView') ?? true,
            logConsole: extensionConfig.get<boolean>('generateLogConsole') ?? true,
            logFile: extensionConfig.get<boolean>('generateLogFile') ?? false,
            inc_paths: extensionConfig.get<string>('includePathsRegex') || '.*',
            exc_paths: extensionConfig.get<string>('excludePathsRegex') || '',
            inc_ext: extensionConfig.get<string>('includeExtensionsRegex') || '',
            exc_ext: extensionConfig.get<string>('excludeExtensionsRegex') || ''
        };

        let targetSelectedId = 'default';
        let targetSettings = defaultSettings;

        if (launchType === 'open' && lastRunId !== 'default') {
            const foundEntry = history.find((h: any) => h.id === lastRunId);
            if (foundEntry) {
                targetSelectedId = lastRunId;
                targetSettings = foundEntry.config as any;
            }
        }

        const initialPaths = launchType === 'add' ? this.state.selectedPaths : [];

        this._panel?.webview.postMessage({
            command: 'initSettings',
            defaultSettings,
            currentSettings: targetSettings,
            history,
            selectedId: targetSelectedId,
            paths: initialPaths,
            tooltipDelay,
            historyViewMode,
            currentRepo
        });
    }

    private registerMessageRouter() {
        if (!this._panel) return;
        const orchestrator = new ExportOrchestratorService(this.context, this.configService, this.processRunner, this._panel);
        const router = new MessageRouter(this._panel, this.historyService, this.configService, orchestrator, this.state, this.processRunner);

        this._panel.webview.onDidReceiveMessage((msg) => {
            if (msg.command === 'webviewReady') {
                if (this._currentLaunchType === 'add') this.updatePaths();
            } else {
                router.handleMessage(msg);
            }
        });
    }

    private getHtmlContent(): string {
        const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'webview.html');
        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
        const baseUri = this._panel!.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'));
        return html.replace('<head>', `<head>\n        <base href="${baseUri}/">`);
    }
}
