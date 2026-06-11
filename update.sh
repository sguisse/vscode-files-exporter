#!/usr/bin/env bash
# ===================================================================================================
# FILES EXPORTER WORKSPACE INTEGRATION PATCH
# Target: Parameterize exchange interface panels and implement adaptive pinning setups.
# ===================================================================================================

# Ensure target folder structures exist
mkdir -p src/services src/handlers src/webview

# 1. Update Config Service to expose Browser Tab Pin state rules safely
cat << 'EOF' > src/services/config.service.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export class ConfigService {
    private static readonly PREFIX = 'filesExporter';

    public getConfiguration() {
        return vscode.workspace.getConfiguration(ConfigService.PREFIX);
    }

    public shouldPinWebview(): boolean {
        return this.getConfiguration().get<boolean>('pinFilesExporter') ?? true;
    }

    public shouldPinBrowserTab(): boolean {
        return this.getConfiguration().get<boolean>('pinBrowserTab') ?? true;
    }

    public getPythonScriptPath(extensionPath: string): string {
        const customPath = this.getConfiguration().get<string>('scriptPythonPath');
        return customPath || path.join(extensionPath, 'scripts', 'files-exporter.py');
    }

    public getHistoryFilePath(): string {
        const rawPath = this.getConfiguration().get<string>('historyYamlPath') || '~/.files-exporter-history.yaml';
        if (rawPath.startsWith('~')) {
            return path.join(os.homedir(), rawPath.slice(1));
        }
        return rawPath;
    }

    public getWorkspaceRootPath(): string {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        return os.homedir();
    }

    public getRepoName(): string {
        const wsPath = this.getWorkspaceRootPath();
        try {
            const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: wsPath, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
            return path.basename(gitRoot);
        } catch {
            return path.basename(wsPath);
        }
    }
}
EOF

# 2. Update Message Router to safely execute integrated browser pinning when true
cat << 'EOF' > src/handlers/message.router.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { HistoryService } from '../services/history.service';
import { ConfigService } from '../services/config.service';
import { ExportOrchestratorService } from '../services/export-orchestrator.service';
import { ExtensionState } from '../interfaces/export.interface';
import { ProcessRunnerService } from '../services/process-runner.service';

export class MessageRouter {
    constructor(
        private panel: vscode.WebviewPanel,
        private historyService: HistoryService,
        private configService: ConfigService,
        private orchestrator: ExportOrchestratorService,
        private state: ExtensionState,
        private processRunner: ProcessRunnerService
    ) {}

    public async handleMessage(message: any) {
        switch (message.command) {
            case 'checkPaths': await this.handleCheckPaths(message); break;
            case 'syncPaths': this.state.selectedPaths = message.paths || []; break;
            case 'updateHistoryViewMode':
                const activeRepo = this.configService.getRepoName();
                await this.historyService.setHistoryViewMode(message.mode, activeRepo);
                break;
            case 'runExport':
                const repoRun = this.configService.getRepoName();
                const result = await this.historyService.saveHistory(message.data, message.currentHistoryId, repoRun);
                this.panel.webview.postMessage({ command: 'updateHistory', history: result.history, selectedId: result.selectedId, skipFieldSync: true });
                await this.orchestrator.run(message.data);
                break;
            case 'duplicateHistory':
                if (message.id) {
                    const repoDup = this.configService.getRepoName();
                    const dup = await this.historyService.duplicateEntry(message.id, repoDup);
                    this.panel.webview.postMessage({ command: 'updateHistory', history: dup.history, selectedId: dup.newId });
                }
                break;
            case 'addNewConfigProfile':
                const defaultSettingsObj = this.getDefaultSettings();
                const wsPath = this.configService.getWorkspaceRootPath();
                const wsName = path.basename(wsPath);
                const repoNew = this.configService.getRepoName();
                const fresh = await this.historyService.addNewEntry(defaultSettingsObj, wsName, repoNew);
                this.panel.webview.postMessage({ command: 'updateHistory', history: fresh.history, selectedId: fresh.newId });
                break;
            case 'toggleFreezeHistory':
                if (message.id) {
                    const modifiedHistory = await this.historyService.toggleFreeze(message.id, message.frozen);
                    this.panel.webview.postMessage({ command: 'updateHistory', history: modifiedHistory, selectedId: message.id, skipFieldSync: true });
                }
                break;
            case 'openHistoryInVSCode': await this.handleOpenHistoryInVSCode(); break;
            case 'revealHistoryInOS': await this.handleRevealHistory(); break;
            case 'applyFileFilter': await this.handleApplyFileFilter(message); break;
            case 'editHistoryName': await this.handleEditHistoryName(message); break;
            case 'clearHistory': await this.handleClearHistory(message); break;
            case 'clearPaths': this.state.selectedPaths = []; break;
            case 'addOpenFiles': await this.handleAddOpenFiles(message); break;
            case 'addGitDiffFiles': await this.handleAddGitDiffFiles(message); break;
            case 'copyLatestExportedFiles': await this.handleCopyLatestExportedFiles(message); break;
            case 'clearDestDirectory': await this.handleClearDestDirectory(message); break;
            case 'openFile':
                try {
                    const doc = await vscode.workspace.openTextDocument(message.path);
                    await vscode.window.showTextDocument(doc);
                } catch (err: any) { vscode.window.showErrorMessage(`Opening failed: ${err.message}`); }
                break;
            case 'openFinder':
                if (message.path) await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.path));
                break;
            case 'openBrowserTab':
                await this.handleOpenBrowserTab(message.url);
                break;
            case 'showNotification':
                if (message.type === 'info') vscode.window.showInformationMessage(message.text);
                else if (message.type === 'error') vscode.window.showErrorMessage(message.text);
                else if (message.type === 'warn') vscode.window.showWarningMessage(message.text);
                break;
        }
    }

    private async handleOpenBrowserTab(url: string) {
        try {
            const labelTarget = url.includes('gemini') ? 'Gemini' : 'NotebookLM';
            let foundTab: vscode.Tab | undefined;
            let targetGroup: vscode.TabGroup | undefined;

            for (const group of vscode.window.tabGroups.all) {
                for (const tab of group.tabs) {
                    const inputUrl = (tab.input as any)?.uri?.toString() || '';
                    if (tab.label === labelTarget || inputUrl.includes(url) || tab.label.toLowerCase().includes(labelTarget.toLowerCase())) {
                        foundTab = tab;
                        targetGroup = group;
                        break;
                    }
                }
                if (foundTab) { break; }
            }

            let finalColumn = vscode.ViewColumn.Two;

            if (foundTab && targetGroup) {
                if (targetGroup.viewColumn !== undefined) {
                    finalColumn = targetGroup.viewColumn;
                }

                if (targetGroup.viewColumn === vscode.ViewColumn.One) {
                    await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
                } else if (targetGroup.viewColumn === vscode.ViewColumn.Two) {
                    await vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup');
                } else if (targetGroup.viewColumn === vscode.ViewColumn.Three) {
                    await vscode.commands.executeCommand('workbench.action.focusThirdEditorGroup');
                }

                const index = targetGroup.tabs.indexOf(foundTab);
                if (index !== -1) {
                    await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', index);
                }
            }

            await vscode.commands.executeCommand('simpleBrowser.show', url, {
                viewColumn: finalColumn,
                preserveFocus: false
            });

            if (this.configService.shouldPinBrowserTab()) {
                await vscode.commands.executeCommand('workbench.action.pinEditor');
            }

        } catch (err: any) {
            vscode.window.showErrorMessage(`Unable to manage integrated browser tab: ${err.message}`);
        }
    }

    private async handleCheckPaths(message: any) {
        try {
            const invalidPaths: string[] = [];
            const wsPath = this.configService.getWorkspaceRootPath();
            for (const rawPath of message.paths) {
                let cleanPath = rawPath.replace(/^['"]|['"]$/g, '').trim();
                if (!cleanPath) continue;
                if (!path.isAbsolute(cleanPath)) cleanPath = path.join(wsPath, cleanPath);
                if (!fs.existsSync(cleanPath)) invalidPaths.push(rawPath);
            }
            this.panel.webview.postMessage({ command: 'checkPathsResult', invalidPaths });
        } catch (e) { console.error(e); }
    }

    private async handleAddOpenFiles(message: any) {
        const existingPaths: string[] = message.currentPaths || [];
        const openFiles: string[] = [...existingPaths];
        vscode.window.tabGroups.all.forEach(group => {
            group.tabs.forEach(tab => {
                if (tab.input instanceof vscode.TabInputText) {
                    const fsPath = tab.input.uri.fsPath;
                    if (!openFiles.includes(fsPath)) openFiles.push(fsPath);
                }
            });
        });
        this.state.selectedPaths = openFiles;
        this.panel.webview.postMessage({ command: 'updatePaths', paths: this.state.selectedPaths });
    }

    private async handleAddGitDiffFiles(message: any) {
        const existingPaths: string[] = message.currentPaths || [];
        const gitFiles: string[] = [...existingPaths];
        const wsPath = this.configService.getWorkspaceRootPath();

        exec('git fetch', { cwd: wsPath }, (fetchErr) => {
            const diffCommand = 'git diff $(git merge-base HEAD @{upstream})..HEAD --name-only';

            exec(diffCommand, { cwd: wsPath }, (err: any, stdout: string) => {
                if (err) {
                    exec('git diff origin/HEAD..HEAD --name-only', { cwd: wsPath }, (fallbackErr, fallbackStdout) => {
                        if (!fallbackErr && fallbackStdout) {
                            this.processGitOutput(fallbackStdout, gitFiles, wsPath);
                        } else {
                            this.panel.webview.postMessage({ command: 'terminalLog', text: `\x1b[93m[Git Diff Warning]: No upstream tracking configuration found for the active branch.\x1b[0m\n` });
                        }
                    });
                    return;
                }

                if (stdout) {
                    this.processGitOutput(stdout, gitFiles, wsPath);
                } else {
                    this.panel.webview.postMessage({ command: 'terminalLog', text: `\n✨ [Git Diff Sync]: Up-to-date. No changes detected between active branch and remote origin.\n` });
                }
            });
        });
    }

    private processGitOutput(stdout: string, gitFiles: string[], wsPath: string) {
        const lines = stdout.split('\n').map(l => l.trim()).filter(l => l);
        let additionsCount = 0;

        lines.forEach(line => {
            const fullPath = path.isAbsolute(line) ? line : path.join(wsPath, line);
            if (!gitFiles.includes(fullPath) && fs.existsSync(fullPath)) {
                gitFiles.push(fullPath);
                additionsCount++;
            }
        });

        this.state.selectedPaths = gitFiles;
        this.panel.webview.postMessage({ command: 'updatePaths', paths: this.state.selectedPaths });
        this.panel.webview.postMessage({ command: 'terminalLog', text: `\n🌿 [Git Diff Sync Complete]: Injected ${additionsCount} remote delta file(s) into Source Manifest layout.\n` });
    }

    private async handleCopyLatestExportedFiles(message: any) {
        try {
            const destDir = message.path;
            if (!destDir || !fs.existsSync(destDir)) {
                vscode.window.showWarningMessage("⚠️ No files to copy, do an export before !");
                return;
            }

            const files = fs.readdirSync(destDir);
            let maxTimestamp = '';
            const fileTimestamps: { file: string, timestamp: string }[] = [];

            for (const file of files) {
                if (file.endsWith('.log') || file.endsWith('-report.json') || file.endsWith('-tree.json')) continue;
                const match = file.match(/^export-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
                if (match) {
                    const ts = match[1];
                    fileTimestamps.push({ file, timestamp: ts });
                    if (ts > maxTimestamp) maxTimestamp = ts;
                }
            }

            const latestFiles = fileTimestamps.filter(f => f.timestamp === maxTimestamp).map(f => path.join(destDir, f.file));

            if (latestFiles.length === 0) {
                vscode.window.showWarningMessage("⚠️ No files to copy, do an export before !");
                return;
            }

            const timeoutMs = this.configService.getConfiguration().get<number>('copyFilesToClipboardTimeout') ?? 10000;

            await this.processRunner.copyFilesToClipboard(latestFiles, timeoutMs);
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\n📋 Copied and verified ${latestFiles.length} file(s) to OS clipboard.\n` });
            vscode.window.showInformationMessage(`Copied and verified ${latestFiles.length} file(s) to clipboard.`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to copy files: ${err.message}`);
        }
    }

    private async handleClearDestDirectory(message: any) {
        try {
            const destDir = message.path;
            if (!destDir || !fs.existsSync(destDir)) {
                vscode.window.showWarningMessage("Destination directory does not exist or is empty.");
                return;
            }
            const choice = await vscode.window.showWarningMessage(
                `Are you sure you want to permanently delete all contents inside: ${destDir}?`,
                { modal: true }, "Clean Directory"
            );
            if (choice === "Clean Directory") {
                const files = await fs.promises.readdir(destDir);
                for (const file of files) {
                    await fs.promises.rm(path.join(destDir, file), { recursive: true, force: true });
                }
                vscode.window.showInformationMessage("Destination directory content successfully cleaned.");
                this.panel.webview.postMessage({ command: 'terminalLog', text: `\n057f Destination directory cleared: ${destDir}\n` });
            }
        } catch (err: any) { vscode.window.showErrorMessage(`Failed to clean destination directory: ${err.message}`); }
    }

    private getDefaultSettings() {
        const workspacePath = this.configService.getWorkspaceRootPath();
        const extensionConfig = this.configService.getConfiguration();
        return {
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
    }

    private async handleOpenHistoryInVSCode() {
        try {
            const historyPath = this.configService.getHistoryFilePath();
            if (fs.existsSync(historyPath)) {
                const doc = await vscode.workspace.openTextDocument(historyPath);
                await vscode.window.showTextDocument(doc);
            } else {
                vscode.window.showWarningMessage("History log file does not exist yet.");
            }
        } catch (err: any) { vscode.window.showErrorMessage(`Unable to open history file: ${err.message}`); }
    }

    private async handleRevealHistory() {
        try {
            const historyPath = this.configService.getHistoryFilePath();
            if (fs.existsSync(historyPath)) {
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(historyPath));
            } else {
                const parentDir = path.dirname(historyPath);
                await fs.promises.mkdir(parentDir, { recursive: true });
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(parentDir));
            }
        } catch (err: any) { vscode.window.showErrorMessage(`Unable to open targeted file location: ${err.message}`); }
    }

    private async handleApplyFileFilter(message: any) {
        try {
            const { fileNameRegex, fileContentRegex, destDir, files } = message.data;
            let filteredList = [...files];
            if (fileNameRegex && fileNameRegex.trim()) {
                const nameReg = new RegExp(fileNameRegex.trim());
                filteredList = filteredList.filter(fileItem => nameReg.test(fileItem.split(/[\\/]/).pop() || ''));
            }
            if (fileContentRegex && fileContentRegex.trim() && filteredList.length > 0) {
                const contentReg = new RegExp(fileContentRegex.trim());
                const cleanDestDir = (destDir || '').replace(/[\\/]$/, '');
                const sep = cleanDestDir.includes('\\') ? '\\' : '/';
                const validContentFiles: string[] = [];
                for (const fileItem of filteredList) {
                    const baseName = fileItem.split(/[\\/]/).pop() || '';
                    const fullPath = path.isAbsolute(fileItem) ? fileItem : `${cleanDestDir}${sep}${baseName}`;
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        if (contentReg.test(content)) validContentFiles.push(fileItem);
                    }
                }
                filteredList = validContentFiles;
            }
            this.panel.webview.postMessage({ command: 'filteredFilesResult', files: filteredList });
        } catch (err: any) { this.panel.webview.postMessage({ command: 'terminalLog', text: `Filter Error: ${err.message}\n` }); }
    }

    private async handleEditHistoryName(message: any) {
        if (message.newName && message.newName.trim()) {
            const newHistory = await this.historyService.updateEntryDisplay(message.id, message.newName.trim());
            this.panel.webview.postMessage({ command: 'updateHistory', history: newHistory, selectedId: message.id });
        }
    }

    private async handleClearHistory(message: any) {
        const activeId = message.selectedId;
        const options: string[] = [];
        if (activeId && activeId !== 'default') options.push("Remove Selected Item (Hard)", "Remove Selected Item (Soft .del)");
        options.push("Clear All History (Hard)", "Clear All History (Soft .del)");
        const choice = await vscode.window.showWarningMessage("History logs removal workspace management console.", { modal: true }, ...options);
        if (!choice) return;
        if (choice.includes("Selected Item")) {
            if (choice.includes("Soft .del")) await this.historyService.softClearHistory();
            const finalHist = await this.historyService.removeEntry(activeId);
            this.panel.webview.postMessage({ command: 'updateHistory', history: finalHist, selectedId: 'default' });
        } else {
            if (choice.includes("Soft .del")) await this.historyService.softClearHistory();
            await this.historyService.clearHistory();
            this.panel.webview.postMessage({ command: 'updateHistory', history: [], selectedId: 'default' });
        }
    }
}
EOF

# 3. Update Webview Panel Manager to inject exchange options schema into init settings
cat << 'EOF' > src/webview/webview.panel.ts
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

        const exchange = wrapper.config?.exchange || [
            {
                icon: "assets/brands/gemini.svg",
                url: "https://gemini.google.com/",
                tooltip: "Open Gemini",
                height: "64px",
                width: "64px"
            },
            {
                icon: "assets/brands/notebookLM.svg",
                url: "https://notebooklm.google.com/",
                tooltip: "Open NotebookLM",
                height: "64px",
                width: "64px"
            }
        ];

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
            exchange
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
EOF

# 4. Update webview canvas HTML to accept parameterized component entries
cat << 'EOF' > src/webview/webview.html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Files Exporter</title>
        <meta http-equiv="Content-Security-Policy"
            content="default-src 'none'; img-src vscode-webview-resource: https: data:; font-src https://cdn.jsdelivr.net vscode-webview-resource:; style-src 'unsafe-inline' https://cdn.jsdelivr.net vscode-webview-resource:; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net vscode-webview-resource:;">
        <link href="https://cdn.jsdelivr.net/npm/@vscode/codicons/dist/codicon.css" rel="stylesheet">
        <script type="module"
            src="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit@latest/dist/toolkit.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
            .grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .full-width { width: 100%; }
            .section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; box-shadow: 0px 4px 5px -3px rgba(0, 0, 0, 0.25); }
            .paths-list { background: var(--vscode-input-background); padding: 10px; border: 1px solid var(--vscode-input-border); border-radius: 3px; max-height: 150px; overflow-y: auto; font-family: var(--vscode-editor-font-family); font-size: 12px;}
            .terminal { background: #1e1e1e; color: #d4d4d4; padding: 10px; font-family: 'Menlo', monospace; font-size: 12px; height: 100%; overflow-y: auto; border-radius: 4px; }
            .terminal-container { display: flex; flex-direction: column; flex-grow: 1; height: 100%; }
            .chart-container { position: relative; height: 300px; width: 100%; margin-top: 20px; }
            .selected-row { background-color: var(--vscode-list-activeSelectionBackground) !important; color: var(--vscode-list-activeSelectionForeground) !important; }
            #terminal-cmd, #terminal-cmd::part(control) { color: #d4d4d4 !important; --text-color: #d4d4d4 !important; --input-text-color: #d4d4d4 !important; }
            th { cursor: pointer; }

            #exportedFilesList { resize: vertical; overflow: auto; min-height: 80px; max-height: 400px; }
            .field-label { display: inline-block; margin-bottom: 4px; }

            .history-actions-container { display: flex; gap: 5px; align-items: center; width: 100%; }
            .icon-btn, .history-actions-container vscode-button { width: 26px !important; height: 26px !important; min-width: 26px !important; padding: 0px !important; --button-padding-horizontal: 0px !important; --button-padding-vertical: 0px !important; }

            .vertical-divider { width: 1px; height: 18px; background-color: var(--vscode-panel-border); margin: 0 3px; flex-shrink: 0; }
            #btn-copy-cmd { color: var(--vscode-button-foreground, #ffffff) !important; }

            .tree-folder > .tree-children { display: none; padding-left: 14px; border-left: 1px solid var(--vscode-panel-border); margin-left: 5px; margin-top: 2px;}
            .tree-folder.expanded > .tree-children { display: block; }
            .tree-folder-header { cursor: pointer; display: flex; align-items: center; padding: 2px 0; }
            .tree-folder-header:hover { background-color: var(--vscode-list-hoverBackground); }
            .tree-toggle { display: inline-block; width: 14px; font-size: 10px; text-align: center; margin-right: 4px; color: var(--vscode-icon-foreground); transition: transform 0.15s ease;}
            .tree-folder.expanded > .tree-folder-header .tree-toggle { transform: rotate(90deg); }
            .tree-item { display: flex; align-items: center; padding: 2px 0; padding-left: 14px; }
            .tree-item:hover { background-color: var(--vscode-list-hoverBackground); }
            .tree-icon { margin-right: 4px; font-size: 14px; }

            #treeSearchInput { max-width: 250px !important; width: 250px !important; }

            .tree-cb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                border: 1px solid var(--vscode-checkbox-border, #858585);
                background-color: var(--vscode-input-background, #ffffff);
                border-radius: 3px;
                margin: 0 6px 0 0;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                position: relative;
                box-sizing: border-box;
                vertical-align: middle;
            }

            .tree-cb:checked, .tree-cb.is-indeterminate {
                background-color: var(--vscode-checkbox-background, #007fd4);
                border-color: var(--vscode-checkbox-selectBorder, var(--vscode-checkbox-background), #007fd4);
            }

            .tree-cb:checked::after {
                content: '';
                width: 3px;
                height: 6px;
                border: solid var(--vscode-checkbox-foreground, #ffffff);
                border-width: 0 2px 2px 0;
                transform: translate(-50%, -60%) rotate(45deg);
                position: absolute;
                top: 50%;
                left: 50%;
            }

            .tree-cb.is-indeterminate::after {
                content: '';
                width: 8px;
                height: 2px;
                background-color: var(--vscode-checkbox-foreground, #ffffff);
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }

            #global-cursor-tooltip { position: fixed; background-color: #000000; color: #ffffff; border: 1px solid #454545; box-shadow: 0px 5px 12px rgba(0, 0, 0, 0.6); padding: 6px 10px; border-radius: 4px; font-family: var(--vscode-font-family, sans-serif); font-size: 11px; font-weight: normal; z-index: 999999; pointer-events: none; display: none; width: max-content; max-width: 200px; white-space: normal; word-wrap: break-word; height: auto; }

            .btn-run-custom {
                width: 60%;
                margin: 0px auto 0px auto;
                background: linear-gradient(135deg, var(--vscode-button-background), #6b21a8);
                color: var(--vscode-button-foreground);
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 12px 20px;
                font-size: 14px;
                font-family: var(--vscode-font-family);
                font-weight: 600;
                letter-spacing: 1px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .btn-run-custom:hover {
                background: linear-gradient(135deg, var(--vscode-button-hoverBackground), #9333ea);
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
                transform: translateY(-1px);
            }
            .btn-run-custom:active {
                transform: translateY(1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            .btn-run-custom.loading {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
                border: 1px solid var(--vscode-panel-border);
            }

            @keyframes spin { 100% { transform: rotate(360deg); } }
            .spin-anim { animation: spin 1s linear infinite; display: inline-block; }

            vscode-panels {
               margin-top: 10px;
               min-height: 500px;
               border-top: 1px solid var(--vscode-panel-border);
               padding-top: 0px;
            }
        </style>
    </head>
    <body>
        <div>
            <div class="tooltip-bottom section-title"
                data-tooltip="History log containing previously executed configuration profiles">🕒 Configuration
                History (Auto-Saved on Run)</div>
            <div class="history-actions-container">
                <vscode-button id="btn-toggle-history-view" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Toggle history scope: Current Repo (🏠) / All Repos (🌐)">🏠</vscode-button>
                <vscode-dropdown id="historyCombo" style="flex-grow: 1;"></vscode-dropdown>
                <vscode-text-field id="historyRenameInput" style="display: none; flex-grow: 1;" placeholder="Enter profile name display identifier..." data-tooltip="Press 'Enter' to confirm or 'Escape' to cancel layout edits"></vscode-text-field>
                <vscode-button id="btn-freeze-history" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Freeze or unfreeze profile. Unfreezing allows overwriting and re-naming configurations"
                    disabled><span class="codicon codicon-unlock"></span></vscode-button>
                <vscode-button id="btn-reset-config" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Reset configuration to last saved values."
                    disabled><span class="codicon codicon-debug-restart"></span></vscode-button>
                <vscode-button id="btn-edit-history" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Rename the selected profile item display name" disabled><span
                        class="codicon codicon-edit"></span></vscode-button>
                <vscode-button id="btn-duplicate-history" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Duplicate selected profile configuration profile" disabled><span
                        class="codicon codicon-files"></span></vscode-button>
                <vscode-button id="btn-add-history" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Create a new fresh profile configuration from default settings"><span
                        class="codicon codicon-add"></span></vscode-button>

                <div class="vertical-divider"></div>

                <vscode-button id="btn-open-history-file" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Open history log file config directly in VS Code"><span
                        class="codicon codicon-file"></span></vscode-button>
                <vscode-button id="btn-reveal-history-folder" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Reveal the physical history log file database in OS Finder / Explorer"><span
                        class="codicon codicon-folder-opened"></span></vscode-button>
                <vscode-button id="btn-clear-history" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Remove items or clear all saved configuration history entries"><span
                        class="codicon codicon-trash"></span></vscode-button>
            </div>
        </div>

        <div>
            <div class="section-title"
                data-tooltip="Absolute folder or files locations targeted for compilation (one path per line)">📁 Source
                Paths (Editable)</div>
            <div style="display: flex; gap: 5px; align-items: center;">
                <vscode-text-area id="pathList" rows="4" resize="vertical"
                    placeholder="Enter source paths (one per line)"
                    style="flex-grow: 1; width: 100%;"></vscode-text-area>
                <vscode-button id="btn-add-open-files" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Add all currently open files to source path selection"><span
                        class="codicon-go-to-file codicon"></span></vscode-button>
                <vscode-button id="btn-add-git-diff" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Identify and add files changed with git diff to source path selection"><span
                        class="codicon codicon-git-compare"></span></vscode-button>
                <vscode-button id="btn-clear-paths" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Clear current source paths selection"><span
                        class="codicon-clear-all codicon"></span></vscode-button>
            </div>
        </div>

        <div style="display: flex; gap: 15px; width: 100%;">
            <div>
                <span class="field-label"
                    data-tooltip="Max authorized physical size for a single file in Kilobytes. Larger files are skipped.">🏋️
                    Max File (KB)</span><br />
                <vscode-text-field id="maxFile" value="50" style="width: 110px;"></vscode-text-field>
            </div>
            <div style="flex-grow:1;">
                <span class="field-label"
                    data-tooltip="Regex mapping specifying inside-folder structures to explicitly allow.">✅ Include
                    Paths</span>
                <vscode-text-area id="incPaths" class="full-width" rows="4" resize="vertical"></vscode-text-area>
            </div>
            <div style="flex-grow:1;">
                <span class="field-label"
                    data-tooltip="Regex checklist specifying file extensions to let through during discovery.">🟢
                    Include Exts</span>
                <vscode-text-area id="incExts" class="full-width" rows="4" resize="vertical"></vscode-text-area>
            </div>
            <div style="flex-grow:1;">
                <span class="field-label"
                    data-tooltip="Regex blacklisting targeted folder structures (e.g. node_modules, .git) to skip.">🚫
                    Exclude Paths</span>
                <vscode-text-area id="excPaths" class="full-width" rows="4" resize="vertical"></vscode-text-area>
            </div>
            <div style="flex-grow:1;">
                <span class="field-label"
                    data-tooltip="Regex mapping identifying forbidden raw formats (e.g. log, exe, png) to skip.">🔴
                    Exclude Exts</span>
                <vscode-text-area id="excExts" class="full-width" rows="4" resize="vertical"></vscode-text-area>
            </div>
        </div>

        <div>
            <div class="section-title"
                data-tooltip="Absolute storage target destination where compiled text files will be written.">💾
                Destination Directory</div>
            <div style="display: flex; gap: 5px; align-items: center;">
                <vscode-text-field id="destDir" class="full-width"
                    placeholder="/absolute/path/to/output"></vscode-text-field>
                <vscode-button id="btn-copy-latest-files" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Copy last exported files to OS clipboard"><span
                        class="codicon codicon-clippy"></span></vscode-button>
                <vscode-button id="btn-open-finder-dest" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Open destination directory in OS Finder / Explorer"><span
                        class="codicon codicon-folder-opened"></span></vscode-button>
                <vscode-button id="btn-clear-dest" appearance="secondary" class="tooltip-right icon-btn"
                    data-tooltip="Clean destination directory content"><span
                        class="codicon codicon-trash"></span></vscode-button>
            </div>
        </div>

        <div
            style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; align-items: end; margin-bottom: 10px;">
            <div style="margin-bottom: 1px;">
                <span class="field-label"
                    data-tooltip="Structured file format schema template applied to aggregate the files contents.">Output
                    Format</span>
                <vscode-dropdown id="format" class="full-width">
                    <vscode-option value="yaml">YAML</vscode-option>
                    <vscode-option value="json">JSON</vscode-option>
                    <vscode-option value="xml">XML</vscode-option>
                    <vscode-option value="toml">TOML</vscode-option>
                    <vscode-option value="txt">TXT</vscode-option>
                </vscode-dropdown>
            </div>
            <div>
                <span class="field-label"
                    data-tooltip="Maximum payload slice limit for chunk splitting in Kilobytes (0 means unlimitted size).">Max
                    Chunk (KB)</span>
                <vscode-text-field id="maxChunk" class="full-width" value="0"></vscode-text-field>
            </div>
            <div style="margin-bottom: 2px;">
                <vscode-checkbox id="splitChunkByFileExtension"
                    data-tooltip="Force the export runner to partition output chunks whenever a change of file extension occurs.">Split
                    by Ext</vscode-checkbox>
            </div>
            <div style="margin-bottom: 2px;">
                <vscode-checkbox id="copyGeneratedFilesToClipboard"
                    data-tooltip="Automatically copy generated export files to the OS clipboard after each successful run, making them easy to paste into Finder, Explorer, LLM chat interfaces, and other tools.">Copy
                    to clipboard</vscode-checkbox>
            </div>
            <div style="margin-bottom: 2px;">
                <vscode-checkbox id="generateTreeView"
                    data-tooltip="Instruct the backend engine to build an isolated hierarchical JSON manifest describing all processed source components."
                    checked>Tree View</vscode-checkbox>
            </div>
            <div style="margin-bottom: 5px;">
                <vscode-checkbox id="generateLogConsole"
                    data-tooltip="Enable standard output logging directly streaming into this extension terminal window view.">Log
                    Console</vscode-checkbox>
            </div>
            <div style="margin-bottom: 5px;">
                <vscode-checkbox id="generateLogFile"
                    data-tooltip="Instruct the exporter engine to save a physical log tracing history report in the destination directory.">Log
                    File</vscode-checkbox>
            </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;">
            <button id="btn-run" class="btn-run-custom" style="margin: 0; width: 60%;">
                <span class="codicon codicon-play"></span> RUN EXPORT
            </button>
            <div id="exchange-buttons-container" style="display: flex; gap: 10px; align-items: center;"></div>
        </div>

        <vscode-panels>
            <vscode-panel-tab id="tab-report">REPORT</vscode-panel-tab>
            <vscode-panel-tab id="tab-files">FILES</vscode-panel-tab>
            <vscode-panel-tab id="tab-tree">TREE VIEW</vscode-panel-tab>
            <vscode-panel-tab id="tab-terminal">TERMINAL</vscode-panel-tab>
            <vscode-panel-tab id="tab-help">HELP</vscode-panel-tab>

            <vscode-panel-view id="view-report">
                <div style="width: 100%; display: flex; flex-direction: column; gap: 20px;">
                    <div id="reportTableSection" style="none;">
                        <div class="section-title">📊 Export Report (by Extension)</div>
                        <table id="reportTable"
                            style="width: 100%; border-collapse: collapse; font-family: var(--vscode-editor-font-family); font-size: 12px; border: 1px solid var(--vscode-panel-border);">
                            <thead>
                                <tr
                                    style="background: var(--vscode-sideBar-background); color: #00bcd4; text-align: left;">
                                    <th id="th-ext"
                                        style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Extension
                                        ↕</th>
                                    <th id="th-exported"
                                        style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Exported
                                        ↕</th>
                                    <th id="th-rejected"
                                        style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Size
                                        Rejected ↕</th>
                                    <th id="th-excluded"
                                        style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Excluded
                                        ↕</th>
                                </tr>
                            </thead>
                            <tbody id="reportTableBody"></tbody>
                            <tfoot id="reportTableFooter"></tfoot>
                        </table>
                    </div>
                    <div id="reportGraphSection" style="none;">
                        <div class="section-title">🥧 Distribution (Pie Chart)</div>
                        <div class="chart-container"><canvas id="reportChart"></canvas></div>
                    </div>
                </div>
            </vscode-panel-view>

            <vscode-panel-view id="view-files">
                <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
                    <div id="exportedFilesTitle" class="section-title"
                        data-tooltip="Alphabetical listing of all chunks generated during the last cycle. Display (NB gen Files / NB Filtered Files)">📂
                        Exported Files</div>
                    <div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 5px; width: 100%;">
                        <div style="flex-grow: 1;">
                            <span
                                data-tooltip="Filter on generated files by their name using a regular expression. Useful in case split chunks are generated, to search a specific output file extension."
                                class="field-label">File Name</span>
                            <vscode-text-field id="filterFileName" placeholder="Regex pattern"
                                class="full-width"></vscode-text-field>
                        </div>
                        <div style="flex-grow: 1;">
                            <span
                                data-tooltip="Filter on generated files by their content using a regular expression. To search if a generated file contains specific text, use this filter."
                                class="field-label">File Content</span>
                            <vscode-text-field id="filterFileContent" placeholder="Regex pattern"
                                class="full-width"></vscode-text-field>
                        </div>
                        <vscode-button id="btn-filter-files" appearance="primary">Filter</vscode-button>
                        <vscode-button id="btn-reset-filter" appearance="secondary"><span
                                class="codicon codicon-debug-restart"></span></vscode-button>
                    </div>
                    <div id="exportedFilesList" class="paths-list"></div>
                    <div class="section-title">📝 Logs</div>
                    <div id="logsList" class="paths-list" style="max-height: 100px;"></div>
                    <div class="section-title">📑 Reports</div>
                    <div id="reportsList" class="paths-list" style="max-height: 100px;"></div>
                </div>
            </vscode-panel-view>

            <vscode-panel-view id="view-tree">
                <div style="width: 100%; display: flex; flex-direction: column; gap: 10px; height: 100%;">
                    <div
                        style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; margin-bottom: 2px; box-shadow: 0px 4px 5px -3px rgba(0, 0, 0, 0.25);">
                        <div style="font-size: 14px; font-weight: 600;" class="tooltip-bottom"
                            data-tooltip="Hierarchical structure view of all processed outputs dynamically organized by directories.">🪾
                            Exported Source Files Explorer</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <vscode-button id="btnTreeToggleMode" appearance="icon" class="tooltip-bottom icon-btn"
                            data-tooltip="Toggle structure mapping mode (Standard Directory vs Extension Grouping)">
                            <span class="codicon-list-flat codicon"></span>
                        </vscode-button>
                        <vscode-text-field id="treeSearchInput" placeholder="Search files/extensions..."
                            style="flex-grow: 1;"></vscode-text-field>
                        <vscode-checkbox id="cbTreeRegexp"
                            data-tooltip="Use Regular Expression for search">.*</vscode-checkbox>

                        <vscode-button id="btnTreeClearSearch" appearance="icon" class="tooltip-bottom icon-btn"
                            data-tooltip="Clear search filters and reset views">
                            <span class="codicon-clear-all codicon"></span>
                        </vscode-button>

                        <vscode-button id="btnTreeExpandAll" appearance="icon" class="tooltip-bottom icon-btn"
                            data-tooltip="Expand All">
                            <span class="codicon codicon-expand-all"></span>
                        </vscode-button>
                        <vscode-button id="btnTreeCollapseAll" appearance="icon" class="tooltip-bottom icon-btn"
                            data-tooltip="Collapse All">
                            <span class="codicon-collapse-all codicon"></span>
                        </vscode-button>

                        <vscode-button id="btnTreeExport" appearance="icon" class="tooltip-left icon-btn"
                            data-tooltip="Export checked manifest selection items into background task dispatcher">
                            <span class="codicon codicon-export"></span>
                        </vscode-button>
                    </div>
                    <div id="view-tree-content"
                        style="overflow-y: auto; flex-grow: 1; font-family: var(--vscode-editor-font-family); font-size: 13px;">
                    </div>
                </div>
            </vscode-panel-view>

            <vscode-panel-view id="view-terminal">
                <div class="terminal-container"
                    style="width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px;">

                    <div
                        style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; margin-bottom: 2px; box-shadow: 0px 4px 5px -3px rgba(0, 0, 0, 0.25);">
                        <div style="font-size: 14px; font-weight: 600;" class="tooltip-bottom"
                            data-tooltip="To copy/paste in your terminal or add to sh script for automation.">⚙️
                            Bash command run by the tool</div>
                    </div>
                    <div style="display: flex; flex-direction: column; width: 100%;">
                        <div
                            style="display: flex; flex-direction: row; align-items: flex-start; background: #1e1e1e; padding: 4px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); box-sizing: border-box; width: 100%;">
                            <vscode-text-area id="terminal-cmd" rows="6" resize="vertical" readonly
                                style="flex-grow: 1; font-family: var(--vscode-editor-font-family, 'Menlo', monospace); font-size: 11px; margin: 0; --background-color: #1e1e1e; --input-background: #1e1e1e; --control-corner-radius: 4px 0 0 4px; --border-width: 0; --stroke-width: 0; --input-border-width: 0;"></vscode-text-area>
                            <div
                                style="background: #1e1e1e; display: flex; align-items: flex-start; justify-content: center; padding: 4px 8px 0 4px; border-radius: 0 4px 4px 0;">
                                <vscode-button id="btn-copy-cmd" appearance="icon" class="tooltip-right icon-btn"
                                    data-tooltip="Copy compiled Python command to clipboard"><span
                                        class="codicon codicon-copy"></span></vscode-button>
                            </div>
                        </div>
                    </div>

                    <div
                        style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; margin-bottom: 2px; box-shadow: 0px 4px 5px -3px rgba(0, 0, 0, 0.25);">
                        <div style="font-size: 14px; font-weight: 600;" class="tooltip-bottom"
                            data-tooltip="Logs generated by the Python script execution.">🐍 Python
                            script Logs</div>
                    </div>
                    <div style="display: flex; flex-direction: column; width: 100%;">
                        <div class="terminal" id="terminal"
                            style="width: 100%; box-sizing: border-box; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; border: 1px solid var(--vscode-panel-border); padding: 12px; min-height: 150px; height: 280px; resize: vertical; overflow: auto; font-family: var(--vscode-editor-font-family, 'Menlo', monospace); font-size: 12px;"></div>
                    </div>

                </div>
            </vscode-panel-view>

            <vscode-panel-view id="view-help"></vscode-panel-view>
        </vscode-panels>

        <div id="global-cursor-tooltip"></div>
        <script type="module" src="main.js"></script>
    </body>
</html>
EOF

# 5. Update main script layer to factory-render external target exchange links dynamically
cat << 'EOF' > src/webview/main.js
import { bridge } from './js/core/vscode.bridge.js';
import { state } from './js/core/state.manager.js';
import { ValidatorService } from './js/services/validator.service.js';
import { UIController } from './js/core/ui.controller.js';
import { ReportTab } from './components/report-tab.js';
import { FilesTab } from './components/files-tab.js';
import { TreeViewTab } from './components/tree-view-tab.js';
import { TerminalTab } from './components/terminal-tab.js';
import { HelpTab } from './components/help-tab.js';

const reportTab = new ReportTab();
const filesTab = new FilesTab();
const treeViewTab = new TreeViewTab();
const terminalTab = new TerminalTab();
const helpTab = new HelpTab();

const setRunButtonLoading = () => {
    const btn = document.getElementById('btn-run');
    if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = '<span class="codicon codicon-sync spin-anim"></span> PROCESSING EXPORT...';
    }
};

const resetRunButton = () => {
    const btn = document.getElementById('btn-run');
    if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = '<span class="codicon codicon-play"></span> RUN EXPORT';
    }
};

const updateHistoryViewToggleButton = () => {
    const btn = document.getElementById('btn-toggle-history-view');
    if (btn) {
        btn.innerHTML = state.historyViewMode === 'scope-current-repo' ? '🏠' : '🌐';
    }
};

const cancelInlineHistoryRename = () => {
    const combo = document.getElementById('historyCombo');
    const input = document.getElementById('historyRenameInput');
    if (combo && input) {
        input.style.display = 'none';
        combo.style.display = 'block';
    }
};

const enterInlineRenameMode = () => {
    if (!state.currentSelectedId || state.currentSelectedId === 'default') return;
    const combo = document.getElementById('historyCombo');
    const input = document.getElementById('historyRenameInput');
    const entry = state.historyList.find(h => h.id === state.currentSelectedId);

    if (combo && input && entry) {
        combo.style.display = 'none';
        input.style.display = 'block';
        input.value = entry.display;

        setTimeout(() => {
            const targetBox = input.shadowRoot?.querySelector('input') || input;
            targetBox.focus();
            if (typeof targetBox.select === 'function') targetBox.select();
        }, 50);
    }
};

const renderExchangeIconButtons = (exchangeItems) => {
    const container = document.getElementById('exchange-buttons-container');
    if (!container) return;
    container.innerHTML = '';

    if (!exchangeItems || !Array.isArray(exchangeItems)) return;

    exchangeItems.forEach(item => {
        const btn = document.createElement('vscode-button');
        btn.setAttribute('appearance', 'icon');
        btn.style.width = item.width || '64px';
        btn.style.height = item.height || '64px';
        if (item.tooltip) {
            btn.setAttribute('data-tooltip', item.tooltip);
        }

        const img = document.createElement('img');
        img.src = item.icon;
        img.alt = item.tooltip || 'Exchange Link';
        img.style.width = item.width || '64px';
        img.style.height = item.height || '64px';

        btn.appendChild(img);
        btn.addEventListener('click', () => {
            bridge.postMessage('openBrowserTab', { url: item.url });
        });

        container.appendChild(btn);
    });
};

const init = () => {
    UIController.injectShadowDomStyles();
    UIController.initCursorTooltipTracker();

    helpTab.render();

    document.getElementById('btn-toggle-history-view')?.addEventListener('click', () => {
        state.historyViewMode = state.historyViewMode === 'scope-current-repo' ? 'scope-all-repo' : 'scope-current-repo';
        updateHistoryViewToggleButton();
        updateHistoryCombo(state.currentSelectedId);
        bridge.postMessage('updateHistoryViewMode', { mode: state.historyViewMode });
    });

    document.getElementById('historyCombo')?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val || state.isInitializing) return;
        state.currentSelectedId = val;
        applyHistorySelection(val);
        UIController.syncButtonsState(val);
        ValidatorService.clearAllValidationStyles();
        UIController.checkSyncStatus();
    });

    document.getElementById('btn-freeze-history')?.addEventListener('click', () => {
        if (state.currentSelectedId && state.currentSelectedId !== 'default') {
            const entry = state.historyList.find(h => h.id === state.currentSelectedId);
            if (entry) bridge.postMessage('toggleFreezeHistory', { id: state.currentSelectedId, frozen: !entry.frozen });
        }
    });

    document.getElementById('btn-reset-config')?.addEventListener('click', () => {
        resetCurrentConfigFields();
    });

    document.getElementById('btn-edit-history')?.addEventListener('click', enterInlineRenameMode);

    document.getElementById('historyRenameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = e.target.value.trim();
            if (val && state.currentSelectedId && state.currentSelectedId !== 'default') {
                bridge.postMessage('editHistoryName', { id: state.currentSelectedId, newName: val });
            }
            cancelInlineHistoryRename();
        } else if (e.key === 'Escape') {
            cancelInlineHistoryRename();
        }
    });

    document.getElementById('historyRenameInput')?.addEventListener('blur', () => {
        setTimeout(() => {
            cancelInlineHistoryRename();
        }, 180);
    });

    document.getElementById('btn-duplicate-history')?.addEventListener('click', () => {
        if (state.currentSelectedId && state.currentSelectedId !== 'default') bridge.postMessage('duplicateHistory', { id: state.currentSelectedId });
    });

    document.getElementById('btn-add-history')?.addEventListener('click', () => bridge.postMessage('addNewConfigProfile'));
    document.getElementById('btn-open-history-file')?.addEventListener('click', () => bridge.postMessage('openHistoryInVSCode'));
    document.getElementById('btn-reveal-history-folder')?.addEventListener('click', () => bridge.postMessage('revealHistoryInOS'));
    document.getElementById('btn-clear-history')?.addEventListener('click', () => bridge.postMessage('clearHistory', { selectedId: state.currentSelectedId }));

    document.getElementById('btn-clear-paths')?.addEventListener('click', () => {
        state.selectedPaths = [];
        const pathEl = document.getElementById('pathList');
        if (pathEl) pathEl.value = '';
        bridge.postMessage('clearPaths');
        UIController.checkSyncStatus();
    });

    document.getElementById('btn-add-open-files')?.addEventListener('click', () => {
        const currentPaths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
        bridge.postMessage('addOpenFiles', { currentPaths });
    });

    document.getElementById('btn-add-git-diff')?.addEventListener('click', () => {
        const currentPaths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
        bridge.postMessage('addGitDiffFiles', { currentPaths });
    });

    document.getElementById('btn-run')?.addEventListener('click', runExport);
    document.getElementById('btn-copy-cmd')?.addEventListener('click', () => terminalTab.copyCommand());

    document.getElementById('btn-copy-latest-files')?.addEventListener('click', () => {
        const destDir = document.getElementById('destDir').value;
        if (destDir) bridge.postMessage('copyLatestExportedFiles', { path: destDir });
    });

    document.getElementById('btn-open-finder-dest')?.addEventListener('click', () => {
        const destDir = document.getElementById('destDir').value;
        if (destDir) bridge.postMessage('openFinder', { path: destDir });
    });

    document.getElementById('btn-clear-dest')?.addEventListener('click', () => {
        const destDir = document.getElementById('destDir').value;
        if (destDir) bridge.postMessage('clearDestDirectory', { path: destDir });
    });

    document.getElementById('btn-filter-files')?.addEventListener('click', () => {
        if (!state.lastGeneratedFilesPayload) return;
        bridge.postMessage('applyFileFilter', {
            data: {
                fileNameRegex: document.getElementById('filterFileName').value,
                fileContentRegex: document.getElementById('filterFileContent').value,
                destDir: document.getElementById('destDir').value,
                files: state.lastGeneratedFilesPayload.exports || []
            }
        });
    });

    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
        if (document.getElementById('filterFileName')) document.getElementById('filterFileName').value = '';
        if (document.getElementById('filterFileContent')) document.getElementById('filterFileContent').value = '';
        if (state.lastGeneratedFilesPayload) {
            filesTab.render(
                state.lastGeneratedFilesPayload,
                document.getElementById('destDir').value,
                (p) => bridge.postMessage('openFile', {path:p}),
                (p) => bridge.postMessage('openFinder', {path:p}),
                document.getElementById('splitChunkByFileExtension').checked,
                state.totalExportedSourceFiles
            );
        }
        if (state.lastReportPayload) {
            treeViewTab.render(state.lastReportPayload, (p) => bridge.postMessage('openFile', {path:p}), (p) => bridge.postMessage('openFinder', {path:p}));
        }
    });

    ['ext', 'exported', 'rejected', 'excluded'].forEach(col => {
        document.getElementById(`th-${col}`)?.addEventListener('click', (e) => reportTab.sort(e, col));
    });

    document.addEventListener('blur', (e) => {
        if (e.target && e.target.id && ValidatorService.validators[e.target.id]) ValidatorService.executeFieldValidation(e.target.id);
    }, true);

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id) {
            if (ValidatorService.validators[e.target.id]) {
                ValidatorService.executeFieldValidation(e.target.id, true);
            }
            if (e.target.id === 'pathList') {
                state.selectedPaths = e.target.value.split('\n').map(p => p.trim()).filter(p => p);
                bridge.postMessage('syncPaths', { paths: state.selectedPaths });
            }
            UIController.checkSyncStatus();
        }
    }, true);

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id) {
            if (ValidatorService.validators[e.target.id]) {
                ValidatorService.executeFieldValidation(e.target.id);
            }
            if (e.target.id === 'pathList') {
                state.selectedPaths = e.target.value.split('\n').map(p => p.trim()).filter(p => p);
                bridge.postMessage('syncPaths', { paths: state.selectedPaths });
            }
            UIController.checkSyncStatus();
        }
    }, true);

    bridge.postMessage('webviewReady');
};

const runExport = () => {
    let isFormValid = true;
    Object.keys(ValidatorService.validators).forEach(id => {
        if (!ValidatorService.executeFieldValidation(id)) isFormValid = false;
    });
    if (state.pathListInvalid) isFormValid = false;
    if (!isFormValid) {
        terminalTab.append("\n❌ Export aborted: Please fix the highlighted fields in red pastel before running.\n");
        return;
    }

    setRunButtonLoading();
    terminalTab.clear();
    terminalTab.append("⏳ Starting export process...\n");
    const pathsArray = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);

    bridge.postMessage('runExport', {
        currentHistoryId: state.currentSelectedId,
        data: {
            paths: pathsArray,
            destDir: document.getElementById('destDir')?.value || '',
            format: document.getElementById('format')?.value || 'yaml',
            maxFile: document.getElementById('maxFile')?.value || '50',
            maxChunk: document.getElementById('maxChunk')?.value || '0',
            groupByExt: !!document.getElementById('splitChunkByFileExtension')?.checked,
            copyGeneratedFilesToClipboard: !!document.getElementById('copyGeneratedFilesToClipboard')?.checked,
            logConsole: !!document.getElementById('generateLogConsole')?.checked,
            logFile: !!document.getElementById('generateLogFile')?.checked,
            generateTreeView: !!document.getElementById('generateTreeView')?.checked,
            incPaths: document.getElementById('incPaths')?.value || '',
            excPaths: document.getElementById('excPaths')?.value || '',
            incExts: document.getElementById('incExts')?.value || '',
            excExts: document.getElementById('excExts')?.value || ''
        }
    });
};

const applyHistorySelection = (val) => {
    reportTab.clear(); filesTab.clear(); treeViewTab.clear(); terminalTab.clear();
    const targetConfig = val === 'default' ? state.defaultSettings : state.historyList.find(h => h.id === val)?.config;
    applyFormFields(targetConfig);
    setTimeout(() => ValidatorService.executeFieldValidation('pathList'), 10);
};

const resetCurrentConfigFields = () => {
    const targetConfig = state.currentSelectedId === 'default'
        ? state.defaultSettings
        : state.historyList.find(h => h.id === state.currentSelectedId)?.config;

    applyFormFields(targetConfig);
    ValidatorService.clearAllValidationStyles();
    setTimeout(() => {
        ValidatorService.executeFieldValidation('pathList');
        UIController.checkSyncStatus();
    }, 10);
};

const applyFormFields = (cfg) => {
    if (!cfg) return;
    state.selectedPaths = cfg.src ? cfg.src.split(/[\n,;]/).map(p => p.trim()).filter(p => p) : [];
    document.getElementById('pathList').value = state.selectedPaths.join('\n');
    bridge.postMessage('syncPaths', { paths: state.selectedPaths });

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    setVal('destDir', cfg.dest); setVal('format', cfg.format || 'yaml');
    setVal('maxFile', cfg.max_file || '50'); setVal('maxChunk', cfg.max_chunk || '0');
    setCheck('splitChunkByFileExtension', !!cfg.groupByExt);
    setCheck('copyGeneratedFilesToClipboard', !!cfg.copyGeneratedFilesToClipboard);
    setCheck('generateLogConsole', cfg.logConsole !== false);
    setCheck('generateLogFile', !!cfg.logFile);
    setCheck('generateTreeView', cfg.generateTreeView !== false);
    setVal('incPaths', cfg.inc_paths); setVal('excPaths', cfg.exc_paths);
    setVal('incExts', cfg.inc_ext); setVal('excExts', cfg.exc_ext);
};

const updateHistoryCombo = (selectedId) => {
    const combo = document.getElementById('historyCombo');
    if (!combo) return;

    while (combo.firstChild) {
        combo.removeChild(combo.firstChild);
    }

    const defOpt = document.createElement('vscode-option');
    defOpt.value = 'default'; defOpt.textContent = '< Default Configuration >';
    if (selectedId === 'default' || !selectedId) defOpt.selected = true;
    combo.appendChild(defOpt);

    let matchCount = 0;
    state.historyList.forEach(item => {
        if (state.historyViewMode === 'scope-current-repo' && item.repo !== state.currentRepo) {
            return;
        }
        matchCount++;
        const opt = document.createElement('vscode-option');
        opt.value = item.id; opt.textContent = item.display;
        if (item.id === selectedId) opt.selected = true;
        combo.appendChild(opt);
    });

    let isSelectedHidden = state.historyViewMode === 'scope-current-repo' &&
        selectedId !== 'default' &&
        !state.historyList.some(h => h.id === selectedId && h.repo === state.currentRepo);

    const finalId = isSelectedHidden ? 'default' : (selectedId || 'default');
    if (isSelectedHidden) {
        state.currentSelectedId = 'default';
        applyHistorySelection('default');
    }

    combo.value = finalId;
    UIController.syncButtonsState(finalId);

    setTimeout(() => {
        combo.value = finalId;
        UIController.syncButtonsState(finalId);
    }, 50);
};

window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'checkPathsResult':
            const pathEl = document.getElementById('pathList');
            if (!pathEl) return;
            if (message.invalidPaths && message.invalidPaths.length > 0) {
                state.pathListInvalid = true;
                pathEl.classList.add('field-invalid');
                if (!pathEl.hasAttribute('data-orig-tooltip')) pathEl.setAttribute('data-orig-tooltip', pathEl.getAttribute('data-tooltip') || '');
                pathEl.setAttribute('data-tooltip', `⚠️ Error: The following paths do not exist:\n${message.invalidPaths.join('\n')}`);
            } else {
                state.pathListInvalid = false;
                if (pathEl.value.trim().length > 0) {
                    pathEl.classList.remove('field-invalid');
                    if (pathEl.hasAttribute('data-orig-tooltip')) {
                        pathEl.setAttribute('data-tooltip', pathEl.getAttribute('data-orig-tooltip'));
                        pathEl.removeAttribute('data-orig-tooltip');
                    }
                }
            }
            break;
        case 'updatePaths':
            state.selectedPaths = message.paths || [];
            document.getElementById('pathList').value = state.selectedPaths.join('\n');
            UIController.checkSyncStatus();
            ValidatorService.executeFieldValidation('pathList');
            break;
        case 'initSettings':
            state.defaultSettings = message.defaultSettings || {};
            if (message.tooltipDelay !== undefined) state.tooltipDelayValue = message.tooltipDelay;
            state.isInitializing = true;
            state.historyList = message.history || [];
            state.currentSelectedId = message.selectedId || 'default';
            state.historyViewMode = message.historyViewMode || 'scope-current-repo';
            state.currentRepo = message.currentRepo || '';

            const matchedEntriesCount = state.historyList.filter(h => state.historyViewMode === 'scope-all-repo' || h.repo === state.currentRepo).length;
            console.log(`[History Combo Init] ViewMode: "${state.historyViewMode}" | RepoName: "${state.currentRepo}" | MatchingEntries: ${matchedEntriesCount} / Total: ${state.historyList.length}`);

            updateHistoryViewToggleButton();
            updateHistoryCombo(state.currentSelectedId);
            applyFormFields(message.currentSettings);
            if (message.paths && message.paths.length > 0) {
                state.selectedPaths = message.paths;
                document.getElementById('pathList').value = state.selectedPaths.join('\n');
            }

            renderExchangeIconButtons(message.exchange);

            setTimeout(() => {
                state.isInitializing = false;
                UIController.checkSyncStatus();
                ValidatorService.executeFieldValidation('pathList');
            }, 50);
            break;
        case 'updateHistory':
            state.historyList = message.history || [];
            state.currentSelectedId = message.selectedId || state.currentSelectedId || 'default';
            updateHistoryCombo(state.currentSelectedId);
            if (!message.skipFieldSync) applyHistorySelection(state.currentSelectedId);
            UIController.checkSyncStatus();

            if (state.currentSelectedId && state.currentSelectedId.endsWith('-new')) {
                enterInlineRenameMode();
            }
            break;
        case 'terminalLog':
            terminalTab.append(message.text);
            if (message.text.includes('Export complete!') || message.text.includes('Export aborted') || message.text.includes('ERROR:')) {
                resetRunButton();
            }
            break;
        case 'updateCommand': terminalTab.updateCommand(message.text); break;
        case 'updateExportReport':
            resetRunButton();
            try { reportTab.render(message.data); } catch (e) {}
            try {
                if (message.data) {
                    state.lastReportPayload = message.data;
                    state.totalExportedSourceFiles = message.data.summary?.total_exported || 0;

                    if (message.data.generated_files) {
                        state.lastGeneratedFilesPayload = JSON.parse(JSON.stringify(message.data.generated_files));
                        filesTab.render(
                            state.lastGeneratedFilesPayload,
                            document.getElementById('destDir').value,
                            (p) => bridge.postMessage('openFile',{path:p}),
                            (p) => bridge.postMessage('openFinder',{path:p}),
                            document.getElementById('splitChunkByFileExtension').checked,
                            state.totalExportedSourceFiles
                        );
                    }
                    treeViewTab.render(message.data, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
                }
            } catch (e) {}
            break;
        case 'filteredFilesResult':
            try {
                const payload = { ...state.lastGeneratedFilesPayload, exports: message.files };
                filesTab.render(
                    payload,
                    document.getElementById('destDir').value,
                    (p) => bridge.postMessage('openFile',{path:p}),
                    (p) => bridge.postMessage('openFinder',{path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            } catch (e) {}
            break;
    }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
EOF
