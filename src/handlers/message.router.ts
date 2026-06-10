import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { HistoryService } from '../services/history.service';
import { ConfigService } from '../services/config.service';
import { ExportOrchestratorService } from '../services/export-orchestrator.service';
import { ExtensionState } from '../interfaces/export.interface';

export class MessageRouter {
    constructor(
        private panel: vscode.WebviewPanel,
        private historyService: HistoryService,
        private configService: ConfigService,
        private orchestrator: ExportOrchestratorService,
        private state: ExtensionState
    ) {}

    public async handleMessage(message: any) {
        switch (message.command) {
            case 'checkPaths': await this.handleCheckPaths(message); break;
            case 'syncPaths': this.state.selectedPaths = message.paths || []; break;
            case 'runExport':
                const result = await this.historyService.saveHistory(message.data, message.currentHistoryId);
                this.panel.webview.postMessage({ command: 'updateHistory', history: result.history, selectedId: result.selectedId, skipFieldSync: true });
                await this.orchestrator.run(message.data);
                break;
            case 'duplicateHistory':
                if (message.id) {
                    const dup = await this.historyService.duplicateEntry(message.id);
                    this.panel.webview.postMessage({ command: 'updateHistory', history: dup.history, selectedId: dup.newId });
                }
                break;
            case 'addNewConfigProfile':
                const defaultSettingsObj = this.getDefaultSettings();
                const wsPath = this.configService.getWorkspaceRootPath();
                const wsName = path.basename(wsPath);
                const fresh = await this.historyService.addNewEntry(defaultSettingsObj, wsName);
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
            case 'showNotification':
                if (message.type === 'info') vscode.window.showInformationMessage(message.text);
                else if (message.type === 'error') vscode.window.showErrorMessage(message.text);
                else if (message.type === 'warn') vscode.window.showWarningMessage(message.text);
                break;
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

        // ─── OPTIMIZED QA IMPLEMENTATION ───
        // Step 1: Execute fetch to sync local tracking refs with the remote repository safely
        exec('git fetch', { cwd: wsPath }, (fetchErr) => {
            // Step 2: Compare against upstream tracking head (@{upstream}..HEAD captures local unpushed files, head..upstream captures incoming)
            // Using a broader merge-base comparison to find all unique changed paths between local branch and remote branch tracking bounds
            const diffCommand = 'git diff $(git merge-base HEAD @{upstream})..HEAD --name-only';

            exec(diffCommand, { cwd: wsPath }, (err: any, stdout: string) => {
                if (err) {
                    // Fallback to simpler remote reference check if upstream tracking isn't strictly configured for current branch head context
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

            await this.copyFilesToOSClipboard(latestFiles);
            this.panel.webview.postMessage({ command: 'terminalLog', text: `\n📋 Copied ${latestFiles.length} file(s) to OS clipboard.\n` });
            vscode.window.showInformationMessage(`Copied ${latestFiles.length} file(s) to clipboard.`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to copy files: ${err.message}`);
        }
    }

    private async copyFilesToOSClipboard(filePaths: string[]) {
        return new Promise<void>((resolve, reject) => {
            const platform = process.platform;
            if (platform === 'darwin') {
                // Ensure proper escaping of paths and native macOS Finder compatibility using JXA
                const jxaScript = `
ObjC.import('AppKit');
var pb = $.NSPasteboard.generalPasteboard;
pb.clearContents;
var arr = $.NSMutableArray.alloc.init;
var paths = ${JSON.stringify(filePaths)};
paths.forEach(p => arr.addObject($.NSURL.fileURLWithPath(p)));
pb.writeObjects(arr);
                `.trim().replace(/'/g, "'\\''");

                exec(`osascript -l JavaScript -e '${jxaScript}'`, (err) => {
                    if (err) reject(err); else resolve();
                });
            } else if (platform === 'win32') {
                const pathsStr = filePaths.map(p => `'${p}'`).join(',');
                exec(`powershell.exe -command "Set-Clipboard -Path ${pathsStr}"`, (err) => {
                    if (err) reject(err); else resolve();
                });
            } else {
                const uriList = filePaths.map(p => `file://${p}`).join('\n');
                const proc = exec(`xclip -selection clipboard -t text/uri-list -i`, (err) => {
                    if (err) reject(err); else resolve();
                });
                proc.stdin?.write(uriList);
                proc.stdin?.end();
            }
        });
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

        // ✨ Coupling resolution: Dynamic extraction indexed on package.json
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
        const entries = await this.historyService.loadHistory();
        const entry = entries.find(h => h.id === message.id);
        if (entry) {
            const newName = await vscode.window.showInputBox({
                title: "✏️ Rename History Entry",
                prompt: "Enter the new display identifier for this profile:",
                value: entry.display,
                placeHolder: "Profile name..."
            });
            if (newName && newName.trim()) {
                const newHistory = await this.historyService.updateEntryDisplay(message.id, newName.trim());
                this.panel.webview.postMessage({ command: 'updateHistory', history: newHistory, selectedId: message.id });
            }
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
