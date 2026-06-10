#!/bin/bash

# Create necessary directories just in case
mkdir -p src/webview/components
mkdir -p src/handlers

# ---------------------------------------------------------------------------------------------------
# 1. Update src/webview/components/report-tab.js (Add tooltips, spacing, and notification logic)
# ---------------------------------------------------------------------------------------------------
cat << 'EOF' > src/webview/components/report-tab.js
import { bridge } from '../js/core/vscode.bridge.js';

export class ReportTab {
    constructor() {
        this.myChart = null;
        this.currentData = null;
        this.sortConfig = [
            { column: 'exported', direction: 'desc' },
            { column: 'rejected', direction: 'desc' },
            { column: 'excluded', direction: 'desc' }
        ];
        this.lastClickedRow = null;
    }

    render(data, onFileClick) {
        this.currentData = data;
        this.renderTable(data);
        this.renderChart(data);
        if (data.generated_files && typeof this.renderFiles === 'function') {
            this.renderFiles(data.generated_files, onFileClick);
        }
    }

    sort(event, column) {
        const isShift = event.shiftKey;
        const existingIndex = this.sortConfig.findIndex(s => s.column === column);

        if (!isShift) {
            if (existingIndex !== -1 && this.sortConfig[existingIndex].direction === 'desc') {
                this.sortConfig = [{ column: column, direction: 'asc' }];
            } else {
                this.sortConfig = [{ column: column, direction: 'desc' }];
            }
        } else {
            if (existingIndex !== -1) {
                this.sortConfig[existingIndex].direction = this.sortConfig[existingIndex].direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortConfig.push({ column: column, direction: 'desc' });
            }
        }
        this.renderTable(this.currentData);
    }

    handleRowClick(event, row) {
        const tbody = document.getElementById('reportTableBody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));

        if (event.metaKey || event.ctrlKey) {
            row.classList.toggle('selected-row');
            this.lastClickedRow = row;
        } else if (event.shiftKey && this.lastClickedRow) {
            rows.forEach(r => r.classList.remove('selected-row'));
            const start = rows.indexOf(this.lastClickedRow);
            const end = rows.indexOf(row);
            const [min, max] = [Math.min(start, end), Math.max(start, end)];
            for (let i = min; i <= max; i++) rows[i].classList.add('selected-row');
        } else {
            rows.forEach(r => r.classList.remove('selected-row'));
            row.classList.add('selected-row');
            this.lastClickedRow = row;
        }
    }

    renderTable(data) {
        const reportTableSection = document.getElementById('reportTableSection');
        const reportGraphSection = document.getElementById('reportGraphSection');
        const tbody = document.getElementById('reportTableBody');
        const tfoot = document.getElementById('reportTableFooter');

        if (!data || !data.metrics_per_extension) {
            if (reportTableSection) reportTableSection.style.display = 'none';
            if (reportGraphSection) reportGraphSection.style.display = 'none';
            return;
        }

        if (reportTableSection) reportTableSection.style.display = 'block';
        if (reportGraphSection) reportGraphSection.style.display = 'block';
        if (tbody) tbody.innerHTML = '';

        const headers = {'ext': 'Extension', 'exported': 'Exported', 'rejected': 'Size Rejected', 'excluded': 'Excluded'};
        for (const col in headers) {
            const th = document.getElementById(`th-${col}`);
            if (!th) continue;
            const idx = this.sortConfig.findIndex(s => s.column === col);
            let indicator = '↕';
            if (idx !== -1) {
                const dir = this.sortConfig[idx].direction === 'desc' ? '▼' : '▲';
                indicator = `${dir}${this.sortConfig.length > 1 ? (idx + 1) : ''}`;
            }
            th.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <span>${headers[col]}</span>
                                <span>${indicator}</span>
                            </div>`;
        }

        const metrics = data.metrics_per_extension;
        const allExts = Object.keys(metrics);

        allExts.sort((a, b) => {
            for (const criteria of this.sortConfig) {
                const mA = metrics[a], mB = metrics[b];
                let cmp = 0;
                if (criteria.column === 'ext') cmp = a.localeCompare(b);
                else if (criteria.column === 'exported') cmp = mA.exported - mB.exported;
                else if (criteria.column === 'rejected') cmp = (mA.size_rejected.count || 0) - (mB.size_rejected.count || 0);
                else if (criteria.column === 'excluded') cmp = (mA.regex_excluded || 0) - (mB.regex_excluded || 0);

                if (cmp !== 0) return criteria.direction === 'asc' ? cmp : -cmp;
            }
            return 0;
        });

        allExts.forEach(ext => {
            const m = metrics[ext];
            const row = document.createElement('tr');
            row.onclick = (e) => this.handleRowClick(e, row);

            const e = m.exported; const r = m.size_rejected.count; const x = m.regex_excluded;
            let rowStyle = "";
            if (x > 0 && e === 0 && r === 0) rowStyle = "color: #f44336; background: rgba(244, 67, 54, 0.1);";
            else if (r > 0 && e === 0 && x === 0) rowStyle = "color: #ffc107; background: rgba(255, 193, 7, 0.1);";
            row.setAttribute('style', rowStyle);

            const rejText = r > 0 ? `${r} (<a href="#" class="rej-size-link tooltip-bottom" data-size="${m.size_rejected.min}" data-tooltip="Click to set Max File to ${m.size_rejected.min}" style="color: inherit; text-decoration: underline;">${m.size_rejected.min}</a> / <a href="#" class="rej-size-link tooltip-bottom" data-size="${m.size_rejected.max}" data-tooltip="Click to set Max File to ${m.size_rejected.max}" style="color: inherit; text-decoration: underline;">${m.size_rejected.max}</a>)` : '-';
            const excText = x > 0 ? x : '-';

            row.innerHTML = `<td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px; font-weight: 500;">
                                <a href="#" class="ext-action-link" data-ext="${ext}" data-tooltip="Simple click add extension to &lt;strong&gt;&amp;quot;Include Exts&amp;quot;&lt;/strong&gt;&lt;br\/&gt; Press Cmd/Ctrl + click add extension to &lt;strong&gt;&amp;quot;Exclude Exts&amp;quot;&lt;/strong&gt;" style="color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer;">${ext === 'no_ext' ? 'No Extension' : ext}</a>
                             </td>
                             <td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px;">${e > 0 ? e : '-'}</td>
                             <td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px; ${r > 0 && !rowStyle ? 'color: #ffc107;' : ''}">${rejText}</td>
                             <td style="padding: 1px 5px; border: 1px solid var(--vscode-panel-border); font-size: 12px; ${x > 0 && !rowStyle ? 'color: #f44336;' : ''}">${excText}</td>`;

            row.querySelector('.ext-action-link')?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const isExcludeRoute = event.metaKey || event.ctrlKey;
                const targetMode = isExcludeRoute ? 'exc' : 'inc';
                this.evaluateAndAppendExtension(ext, targetMode);
            });

            row.querySelectorAll('.rej-size-link').forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const sizeStr = link.getAttribute('data-size');
                    let valKb = 0;
                    if (sizeStr.endsWith('MB')) {
                        valKb = parseFloat(sizeStr) * 1024;
                    } else if (sizeStr.endsWith('KB')) {
                        valKb = parseFloat(sizeStr);
                    }
                    const maxFileEl = document.getElementById('maxFile');
                    if (maxFileEl) {
                        const valStr = Math.ceil(valKb).toString();
                        maxFileEl.value = valStr;
                        maxFileEl.dispatchEvent(new Event('input', { bubbles: true }));
                        maxFileEl.dispatchEvent(new Event('change', { bubbles: true }));
                        bridge.postMessage('showNotification', { type: 'info', text: `Max File Size has changed to ${valStr} (KB)` });
                    }
                });
            });

            if (tbody) tbody.appendChild(row);
        });

        const s = data.summary;
        if (tfoot && s) {
            tfoot.innerHTML = `<tr style="background: #f0f0f0; font-weight: bold; color: #333;">
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Total</td>
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border);">${s.total_exported || '-'}</td>
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border); color: #ffc107;">${s.total_size_rejected || '-'}</td>
                <td style="padding: 8px; border: 1px solid var(--vscode-panel-border); color: #f44336;">${s.total_regex_excluded || '-'}</td>
            </tr>`;
        }
    }

    evaluateAndAppendExtension(ext, mode) {
        const targetFieldId = mode === 'inc' ? 'incExts' : 'excExts';
        const targetFieldName = mode === 'inc' ? 'Include Exts' : 'Exclude Exts';
        const targetElement = document.getElementById(targetFieldId);
        if (!targetElement) return;

        const incElement = document.getElementById('incExts');
        const excElement = document.getElementById('excExts');

        const incValue = incElement ? incElement.value : '';
        const excValue = excElement ? excElement.value : '';

        const label = ext === 'no_ext' ? 'no_ext' : ext;
        const generatedPattern = ext === 'no_ext' ? '^[^.]+$' : `.*\\.${ext}$`;

        const checkLabelExists = (fieldContent, searchLabel) => {
            if (!fieldContent) return false;
            const escapedLabel = searchLabel.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedLabel);
            return regex.test(fieldContent);
        };

        const existsInInc = checkLabelExists(incValue, label);
        const existsInExc = checkLabelExists(excValue, label);

        if (existsInInc || existsInExc) {
            const conflictSource = existsInInc ? 'Include Exts' : 'Exclude Exts';
            const backdrop = document.createElement('div');
            backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); z-index: 21000; display: flex; align-items: center; justify-content: center;';

            const warningModal = document.createElement('div');
            warningModal.style.cssText = 'background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); padding: 16px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); min-width: 340px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: var(--vscode-font-family, sans-serif);';

            warningModal.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #ffc107;">⚠️ Duplicate Label Warning</div>
                <div style="font-size: 12px; margin-bottom: 16px; line-height: 1.4;">Hey the extension already exists in "<strong>${conflictSource}</strong>" confirm the adding to "<strong>${targetFieldName}</strong>"</div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <vscode-button id="btn-warn-add" appearance="primary">Add</vscode-button>
                    <vscode-button id="btn-warn-cancel" appearance="secondary">Cancel</vscode-button>
                </div>
            `;

            backdrop.appendChild(warningModal);
            document.body.appendChild(backdrop);

            const closeWarning = () => document.body.removeChild(backdrop);

            document.getElementById('btn-warn-cancel')?.addEventListener('click', closeWarning);
            document.getElementById('btn-warn-add')?.addEventListener('click', () => {
                closeWarning();
                this.executeAppend(targetElement, generatedPattern);
            });
        } else {
            this.executeAppend(targetElement, generatedPattern);
        }
    }

    executeAppend(element, pattern) {
        const currentVal = element.value.trim();
        if (currentVal === '') {
            element.value = pattern;
        } else {
            element.value = currentVal + '\n' + pattern;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    renderChart(data) {
        const canvas = document.getElementById('reportChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (this.myChart) this.myChart.destroy();
        const labels = [], values = [];
        for (const [ext, m] of Object.entries(data.metrics_per_extension)) {
            if (m.exported > 0) {
                labels.push(ext === 'no_ext' ? 'None' : ext);
                values.push(m.exported);
            }
        }
        if (typeof Chart !== 'undefined') {
            this.myChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{ data: values, backgroundColor: ['#00bcd4', '#ffc107', '#f44336', '#4caf50', '#9c27b0'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    clear() {
        if (this.myChart) this.myChart.destroy();
        const tbody = document.getElementById('reportTableBody');
        const tfoot = document.getElementById('reportTableFooter');
        const reportTableSection = document.getElementById('reportTableSection');
        const reportGraphSection = document.getElementById('reportGraphSection');

        if (tbody) tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';
        if (reportTableSection) reportTableSection.style.display = 'none';
        if (reportGraphSection) reportGraphSection.style.display = 'none';
    }
}
EOF

# ---------------------------------------------------------------------------------------------------
# 2. Update src/handlers/message.router.ts (Fix Mac Finder OS Clipboard file paste support via JXA)
# ---------------------------------------------------------------------------------------------------
cat << 'EOF' > src/handlers/message.router.ts
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
            groupByExt: false, logConsole: true, logFile: false, generateTreeView: true,
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
EOF
