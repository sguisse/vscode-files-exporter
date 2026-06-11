#!/usr/bin/env bash
# ===================================================================================================
# FILES EXPORTER ROUTING INTEGRATION PATCH
# Target: Support custom execution route filtering (Integrated VS Code Tab vs Native OS External Browser)
# ===================================================================================================

# Ensure target folder structures exist
mkdir -p src/handlers src/webview

# 1. Update Message Router to dispatch execution path conditionally based on openInVSCode values
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
                this.panel.webview.postMessage({ command: 'terminalLog', text: `\n🧹 Destination directory cleared: ${destDir}\n` });
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

# 2. Update Webview script engine to forward the openInVSCode attribute over the IPC bridge
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
            bridge.postMessage('openBrowserTab', {
                url: item.url,
                openInVSCode: item.openInVSCode !== false
            });
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
                            (p) => bridge.postMessage('openFile', {path:p}),
                            (p) => bridge.postMessage('openFinder', {path:p}),
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
                    (p) => bridge.postMessage('openFile', {path:p}),
                    (p) => bridge.postMessage('openFinder', {path:p}),
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
