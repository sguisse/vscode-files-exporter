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
    private _configListener: vscode.Disposable | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configService: ConfigService,
        private readonly historyService: HistoryService,
        private readonly processRunner: ProcessRunnerService,
        private readonly state: ExtensionState
    ) {}


    public excludePathFromExplorer(fsPath: string) {
        this._panel?.webview.postMessage({ command: 'excludeExplorerPathSelection', path: fsPath });
    }

    public addExternalPaths(paths: string[]) {
        paths.forEach(p => {
            if (p && !this.state.selectedPaths.includes(p)) {
                this.state.selectedPaths.push(p);
            }
        });
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            this.updatePaths();
        } else {
            this.show('add');
        }
    }

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

        // ✨ Set custom context to TRUE when the panel is created
        vscode.commands.executeCommand('setContext', 'filesExporter.isToolOpened', true);

        this._panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'icon.png');
        this._panel.webview.html = this.getHtmlContent();

        this._panel.onDidDispose(() => {
            this._panel = undefined;

            // ✨ Set custom context to FALSE when the panel is closed
            vscode.commands.executeCommand('setContext', 'filesExporter.isToolOpened', false);

            if (this._configListener) {
                this._configListener.dispose();
                this._configListener = undefined;
            }
        });

        this.registerMessageRouter();

        this._configListener = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('filesExporter.fileExtsCategoryGroups')) {
                this._panel?.webview.postMessage({
                    command: 'updateFileExtsCategoryGroups',
                    fileExtsCategoryGroups: this.configService.getFileExtsCategoryGroups()
                });
            }
        });

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

        const exchangeFromHistory = wrapper.config?.exchange;
        const exchangeFromConfig = extensionConfig.get<any[]>('exchange');
        const fileExtsCategoryGroups = this.configService.getFileExtsCategoryGroups();

        const exchange = (exchangeFromHistory && exchangeFromHistory.length > 0)
            ? exchangeFromHistory
            : (exchangeFromConfig || []);

        this._panel?.webview.postMessage({
            command: 'initSettings',
            defaultSettings,
            currentSettings: targetSettings,
            history,
            selectedId: targetSelectedId,
            paths: initialPaths,
            tooltipDelay,
            historyViewMode,
            currentRepo,
            exchange,
            fileExtsCategoryGroups
        });
    }

    private registerMessageRouter() {
        if (!this._panel) return;
        const orchestrator = new ExportOrchestratorService(this.context, this.configService, this.processRunner, this._panel);
        const router = new MessageRouter(this._panel, this.historyService, this.configService, orchestrator, this.state, this.processRunner);

        this._panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'webviewReady') {
                await this.initWebviewData(this._currentLaunchType);
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

    public async exportSelectedPaths(paths: string[]) {
        this.show('open'); // Ensure the Webview panel is active to receive process logs

        const workspacePath = this.configService.getWorkspaceRootPath();
        const extensionConfig = this.configService.getConfiguration();

        // Assemble payload with default options while applying mode 'paths-export'
        const formData = {
            paths: paths,
            destDir: path.join(workspacePath, "exported-files"),
            format: extensionConfig.get<string>('defaultFormat') || 'yaml',
            maxFile: extensionConfig.get<number>('maxFileSizeKb') ?? 50,
            maxChunk: extensionConfig.get<number>('maxChunkSizeKb') ?? 0,
            groupByExt: extensionConfig.get<boolean>('splitChunkByFileExtension') ?? false,
            copyGeneratedFilesToClipboard: extensionConfig.get<boolean>('copyGeneratedFilesToClipboard') ?? true,
            generateTreeView: extensionConfig.get<boolean>('generateTreeView') ?? true,
            logConsole: extensionConfig.get<boolean>('generateLogConsole') ?? true,
            logFile: extensionConfig.get<boolean>('generateLogFile') ?? false,
            incPaths: '',
            excPaths: '',
            incExts: '',
            excExts: '',
            mode: 'paths-export' // Explicitly triggers regex bypass in python script
        };

        if (this._panel) {
            const orchestrator = new ExportOrchestratorService(this.context, this.configService, this.processRunner, this._panel);
            await orchestrator.run(formData);
        }
    }

    public get panel(): vscode.WebviewPanel | undefined {
        return this._panel;
    }
}
