import { HistoryCommandHandler } from './history.handler';
import { ExportHandler } from './export.handler';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { HistoryService } from '../services/history.service';
import { ConfigService } from '../services/config.service';
import { ExportOrchestratorService } from '../services/export-orchestrator.service';
import { ExtensionState } from '../interfaces/export.interface';
import { ProcessRunnerService } from '../services/process-runner.service';
import { GitService } from '../services/git.service';
import { FileSystemService } from '../services/file-system.service';

export class MessageRouter {
    private exportHandler!: ExportHandler;
    private historyCommandHandler!: HistoryCommandHandler;
    private gitService = new GitService();
    private fileSystemService = new FileSystemService();

    constructor(
        private panel: vscode.WebviewPanel,
        private historyService: HistoryService,
        private configService: ConfigService,
        private orchestrator: ExportOrchestratorService,
        private state: ExtensionState,
        private processRunner: ProcessRunnerService
    ) {
        this.exportHandler = new ExportHandler(this.panel, this.orchestrator, this.historyService, this.configService);
        this.historyCommandHandler = new HistoryCommandHandler(this.panel, this.historyService, this.configService);
    }

    public async handleMessage(message: any) {
        switch (message.command) {
            case 'checkPaths': await this.handleCheckPaths(message); break;
            case 'syncPaths': this.state.selectedPaths = message.paths || []; break;
            case 'updateHistoryViewMode':
                const activeRepo = this.configService.getRepoName();
                await this.historyService.setHistoryViewMode(message.mode, activeRepo);
                break;
            case 'runExport': await this.exportHandler.handleRunExport(message); break;
            case 'killExport': this.exportHandler.handleKillExport(); break;
            case 'openPathAtCursor':
                await this.handleOpenPathAtCursor(message);
                break;
            case 'duplicateHistory': await this.historyCommandHandler.handleDuplicateHistory(message); break;
            case 'addNewConfigProfile': await this.historyCommandHandler.handleAddNewConfigProfile(message); break;
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
                if (message.openInVSCode === false) {
                    try {
                        await vscode.env.openExternal(vscode.Uri.parse(message.url));
                    } catch (err: any) {
                        vscode.window.showErrorMessage(`Failed to launch external user browser session: ${err.message}`);
                    }
                } else {
                    await this.handleOpenBrowserTab(message.url);
                }
                break;
            case 'showNotification':
                if (message.type === 'info') vscode.window.showInformationMessage(message.text);
                else if (message.type === 'error') vscode.window.showErrorMessage(message.text);
                else if (message.type === 'warn') vscode.window.showWarningMessage(message.text);
                break;
            case 'richNotificationCallback':
                if (message.actionCommand === 'open_report_file' && message.data?.path) {
                    vscode.workspace.openTextDocument(message.data.path).then(
                        doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Active),
                        err => vscode.window.showErrorMessage(`Failed to open report file: ${err.message}`)
                    );
                }
                break;
            case 'simulateFilters':
                await this.orchestrator.simulateFilters(message);
                break;
            case 'revealInExplorer':
                if (message.path) {
                    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(message.path));
                }
                break;
            case 'analyzeErrorStack':
                await this.handleAnalyzeErrorStack(message);
                break;
            case 'killErrorAnalysis':
                    this.handleKillErrorAnalysis();
                    break;
                case 'simulateExtensionBPush':
                    this.panel.webview.postMessage({ command: 'terminalLog', text: `
🧪 [Backend Router] Intercepted 'simulateExtensionBPush' signal context containing ${message.paths.length} records.
` });
                    message.paths.forEach((p: string) => {
                        if (!this.state.selectedPaths.includes(p)) {
                            this.state.selectedPaths.push(p);
                            this.panel.webview.postMessage({ command: 'terminalLog', text: `   [+] Appended source reference to shared memory layout state: ${p}
` });
                        } else {
                            this.panel.webview.postMessage({ command: 'terminalLog', text: `   [x] Ignored duplicate resource source location: ${p}
` });
                        }
                    });
                    this.panel.webview.postMessage({ command: 'terminalLog', text: `🧪 [Backend Router] Shared memory layout matrices synced. Broadcasting refreshed path matrix maps to UI views...
` });
                    this.panel.webview.postMessage({ command: 'updatePaths', paths: this.state.selectedPaths });
                    this.panel.webview.postMessage({ command: 'terminalLog', text: `🧪 [Backend Router] Shared cross-extension list has been successfully processed and completely emptied.\n` });
                    vscode.window.showInformationMessage(`[Simulation B] ${message.paths.length} chemin(s) injecté(s) avec succès !`);
                    break;
        }
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

    private handleKillErrorAnalysis() {
        let currentDir = __dirname;
        let scriptPath = '';
        while (currentDir !== path.dirname(currentDir)) {
            const testPath = path.join(currentDir, 'scripts', 'error-parser.py');
            if (fs.existsSync(testPath)) { scriptPath = testPath; break; }
            currentDir = path.dirname(currentDir);
        }
        if (scriptPath) {
            const killed = this.processRunner.killActivePythonScript(scriptPath);
            if (killed) {
                this.panel.webview.postMessage({ command: 'analyzeErrorStackResult', paths: [] });
                this.panel.webview.postMessage({ command: 'terminalLog', text: `\n🛑 Error log scanning process killed manually via interface selection parameters.\n` });
                vscode.window.showWarningMessage("Error Analysis Process Terminated Successfully.");
            }
        }
    }

    private async handleAnalyzeErrorStack(message: any) {
        const { stackType, content, includeOutWorkspace } = message;
        const wsPath = this.configService.getWorkspaceRootPath();

        this.panel.webview.postMessage({ command: 'terminalLog', text: `\n⏳ [Backend Analysis] Starting extraction for stack type: ${stackType} (Include out workspace: ${includeOutWorkspace ? 'Yes' : 'No'})\n` });

        let currentDir = __dirname;
        let scriptPath = '';
        while (currentDir !== path.dirname(currentDir)) {
            const testPath = path.join(currentDir, 'scripts', 'error-parser.py');
            if (fs.existsSync(testPath)) { scriptPath = testPath; break; }
            currentDir = path.dirname(currentDir);
        }

        let paths: string[] = [];
        try {
            const logCallback = (err: string) => {
                this.panel.webview.postMessage({ command: 'terminalLog', text: `\x1b[94m${err}\x1b[0m` });
            };

            if (stackType === 'Java') {
                const { JavaErrorIdentifierService } = require('../services/error-identifiers/java-error-identifier.service');
                paths = await new JavaErrorIdentifierService(this.processRunner, scriptPath).searchFiles(content, wsPath, logCallback, includeOutWorkspace);
            } else if (stackType === 'Browser console') {
                const { BrowserErrorIdentifierService } = require('../services/error-identifiers/browser-error-identifier.service');
                paths = await new BrowserErrorIdentifierService(this.processRunner, scriptPath).searchFiles(content, wsPath, logCallback, includeOutWorkspace);
            } else if (stackType === 'python') {
                const { PythonErrorIdentifierService } = require('../services/error-identifiers/python-error-identifier.service');
                paths = await new PythonErrorIdentifierService(this.processRunner, scriptPath).searchFiles(content, wsPath, logCallback, includeOutWorkspace);
            }

            this.panel.webview.postMessage({ command: 'terminalLog', text: `✨ [Backend Analysis] Service completed. Found ${paths.length} matching file path(s).\n` });
        } catch (e: any) {
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\x1b[91m❌ [Backend Analysis] Error: ${e.message}\x1b[0m\n` });
        }
        this.panel.webview.postMessage({ command: 'analyzeErrorStackResult', paths });
    }

    private async handleOpenPathAtCursor(message: any) {
        const { path: rawPath, lineNum } = message;

        if (!rawPath || !rawPath.trim()) {
            vscode.window.showErrorMessage(`No path defined on line n° ${lineNum}`);
            return;
        }

        const wsPath = this.configService.getWorkspaceRootPath();
        let cleanPath = rawPath.replace(/^['"]|['"]$/g, '').trim();
        if (!cleanPath) return;

        if (!path.isAbsolute(cleanPath)) {
            cleanPath = path.join(wsPath, cleanPath);
        }

        if (!fs.existsSync(cleanPath)) {
            vscode.window.showWarningMessage(`The path '${rawPath}' at line n° ${lineNum} does not exist`);
            return;
        }

        try {
            const pathStat = fs.statSync(cleanPath);
            if (pathStat.isDirectory()) {
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(cleanPath));
            } else {
                const targetDoc = await vscode.workspace.openTextDocument(cleanPath);
                await vscode.window.showTextDocument(targetDoc);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to resolve workspace item: ${err.message}`);
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
            const wsPath = this.configService.getWorkspaceRootPath();
            const invalidPaths = this.fileSystemService.getInvalidPaths(message.paths || [], wsPath);
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
        const wsPath = this.configService.getWorkspaceRootPath();

        const result = await this.gitService.getLocalModifiedFilesFromLastCommit(wsPath);

        if (!result.success) {
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\x1b[93m${result.message}\x1b[0m\n` });
            return;
        }

        if (result.files.length === 0 && result.message) {
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\n✨ [Git Diff Sync]: ${result.message}\n` });
            return;
        }

        const gitFiles = [...existingPaths];
        let additionsCount = 0;

        result.files.forEach((fullPath: string) => {
            if (!gitFiles.includes(fullPath)) {
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

            const pyOut = await this.processRunner.copyFilesToClipboard(latestFiles, timeoutMs);
            if (pyOut) this.panel.webview.postMessage({ command: 'terminalLog', text: `\n🐍 [Python Clipboard]:\n${pyOut}\n` });
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\n📋 Copied and verified ${latestFiles.length} file(s) to OS clipboard.\n` });
            vscode.window.showInformationMessage(`Copied and verified ${latestFiles.length} file(s) to clipboard.`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to copy files: ${err.message}`);
        }
    }

    private async handleClearDestDirectory(message: any) {
        try {
            const destDir = message.path;
            if (!destDir || !this.fileSystemService.exists(destDir)) {
                vscode.window.showWarningMessage('Destination directory does not exist or is empty.');
                return;
            }
            const choice = await vscode.window.showWarningMessage(
                `Are you sure you want to permanently delete all contents inside: ${destDir}?`,
                { modal: true }, 'Clean Directory'
            );
            if (choice === 'Clean Directory') {
                await this.fileSystemService.clearDirectory(destDir);
                vscode.window.showInformationMessage('Destination directory content successfully cleaned.');
                this.panel.webview.postMessage({ command: 'terminalLog', text: `\n🧹 Destination directory cleared: ${destDir}\n` });
            }
        } catch (err: any) { vscode.window.showErrorMessage(`Failed to clean destination directory: ${err.message}`); }
    }

    private async handleApplyFileFilter(message: any) {
        try {
            const { fileNameRegex, fileContentRegex, destDir, files } = message.data;
            let filteredList = [...files];
            if (fileNameRegex && fileNameRegex.trim()) {
                const nameReg = new RegExp(fileNameRegex.trim());
                filteredList = filteredList.filter((fileItem: string) => nameReg.test(fileItem.split(/[\\/]/).pop() || ''));
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
