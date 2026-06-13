#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────────────────────────────
# FILES EXPORTER - ATOMIC PROCESS INTERRUPTION DISPATCHER FIX
# ───────────────────────────────────────────────────────────────────────────────────────────────────
# This script eliminates termination notification races by capturing subshell platform signal
# parameters cleanly, silencing completion popups, and allowing the webview re-initialization
# framework loops to restore form settings cleanly on process cancellation.

set -e

echo "⏳ Verifying target directories..."
mkdir -p src/services

echo "⚙️ Overwriting src/services/process-runner.service.ts with cross-platform signal capture..."
cat << 'EOF' > src/services/process-runner.service.ts
import { spawn, exec, ChildProcess } from 'child_process';
import { existsSync } from 'fs';

export class ProcessRunnerService {
    private activeProcesses: Map<string, ChildProcess> = new Map();

    public executePython(
        scriptPath: string,
        args: string[],
        onStdout: (data: string) => void,
        onStderr: (data: string) => void
    ): Promise<{ code: number | null, signal: string | null, stdout: string, stderr: string }> {
        return new Promise((resolve, reject) => {
            if (!existsSync(scriptPath)) {
                return reject(new Error(`Le script moteur est introuvable à l'adresse : ${scriptPath}`));
            }

            const command = process.platform === 'win32' ? 'python' : 'python3';
            const processArgs = [scriptPath, ...args];
            const child = spawn(command, processArgs);

            const processTrackingKey = scriptPath;
            this.activeProcesses.set(processTrackingKey, child);

            let fullStdout = '';
            let fullStderr = '';

            child.stdout.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                fullStdout += text;
                onStdout(text);
            });

            child.stderr.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                fullStderr += text;
                onStderr(text);
            });

            // Capture both termination exit code and close signals atomically without masking overrides
            child.on('close', (code, signal) => {
                this.activeProcesses.delete(processTrackingKey);
                resolve({ code, signal, stdout: fullStdout, stderr: fullStderr });
            });

            child.on('error', (err) => {
                this.activeProcesses.delete(processTrackingKey);
                reject(err);
            });
        });
    }

    public killActivePythonScript(scriptPath: string): boolean {
        const child = this.activeProcesses.get(scriptPath);
        if (child) {
            child.kill('SIGKILL');
            this.activeProcesses.delete(scriptPath);
            return true;
        }
        return false;
    }

    public copyFilesToClipboard(filePaths: string[], timeoutMs: number = 10000): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                const platform = process.platform;
                let writePromise: Promise<void>;

                if (platform === 'darwin') {
                    writePromise = new Promise((res, rej) => {
                        const jxaScript = `
                            ObjC.import('AppKit');
                            var pb = $.NSPasteboard.generalPasteboard;
                            var changeCount = pb.clearContents;
                            var paths = ${JSON.stringify(filePaths)};
                            pb.setPropertyListForType(ObjC.wrap(paths), 'NSFilenamesPboardType');
                        `.trim().replace(/'/g, "'\\''");

                        exec(`osascript -l JavaScript -e '${jxaScript}'`, (err) => err ? rej(err) : res());
                    });
                } else if (platform === 'win32') {
                    writePromise = new Promise((res, rej) => {
                        const pathsStr = filePaths.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
                        exec(`powershell.exe -NoProfile -Command "Set-Clipboard -LiteralPath ${pathsStr}"`, (err) => err ? rej(err) : res());
                    });
                } else {
                    writePromise = new Promise((res, rej) => {
                        const uriList = filePaths.map(p => `file://${p}`).join('\n');
                        const proc = exec(`xclip -selection clipboard -t text/uri-list -i`, (err) => err ? rej(err) : res());
                        proc.stdin?.write(uriList);
                        proc.stdin?.end();
                    });
                }

                writePromise.then(() => {
                    const startTime = Date.now();
                    const intervalTime = 250;
                    let lastActualCount = 0;

                    const poll = async () => {
                        const { verified, actualCount } = await this.verifyClipboard(filePaths);
                        lastActualCount = actualCount;

                        if (verified) {
                            resolve();
                        } else if (Date.now() - startTime >= timeoutMs) {
                            reject(new Error(`Clipboard verification timed out after ${timeoutMs}ms. Expected ${filePaths.length} files, but found ${lastActualCount} in the OS clipboard cache.`));
                        } else {
                            setTimeout(poll, intervalTime);
                        }
                    };

                    setTimeout(poll, 150);
                }).catch(reject);
            }, 800);
        });
    }

    private verifyClipboard(expectedPaths: string[]): Promise<{ verified: boolean, actualCount: number }> {
        return new Promise((resolve) => {
            const platform = process.platform;
            const normalize = (p: string) => {
                let clean = p.toLowerCase().replace(/^file:\/\//, '');
                try { clean = decodeURIComponent(clean); } catch {}
                return clean.replace(/\\/g, '/').replace(/\/+$/, '');
            };
            const expectedSet = new Set(expectedPaths.map(normalize));

            if (platform === 'darwin') {
                const checkScript = `
                    ObjC.import('AppKit');
                    var pb = $.NSPasteboard.generalPasteboard;
                    var pl = pb.propertyListForType('NSFilenamesPboardType');
                    JSON.stringify(ObjC.deepUnwrap(pl) || []);
                `.trim().replace(/'/g, "'\\''");

                exec(`osascript -l JavaScript -e '${checkScript}'`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve({ verified: false, actualCount: 0 });
                    try {
                        const actualPaths = JSON.parse(stdout.trim()) as string[];
                        const actualSet = new Set(actualPaths.map(normalize));
                        const verified = Array.from(expectedSet).every(p => actualSet.has(p));
                        resolve({ verified, actualCount: actualSet.size });
                    } catch { resolve({ verified: false, actualCount: 0 }); }
                });
            } else if (platform === 'win32') {
                exec(`powershell.exe -NoProfile -Command "(Get-Clipboard -Format FileDropList).Path | ConvertTo-Json -Compress"`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve({ verified: false, actualCount: 0 });
                    try {
                        let actualPaths = JSON.parse(stdout.trim());
                        if (!Array.isArray(actualPaths)) actualPaths = [actualPaths];
                        const actualSet = new Set(actualPaths.map(normalize));
                        const verified = Array.from(expectedSet).every(p => actualSet.has(p));
                        resolve({ verified, actualCount: actualSet.size });
                    } catch { resolve({ verified: false, actualCount: 0 }); }
                });
            } else {
                exec(`xclip -selection clipboard -o -t text/uri-list`, (err, stdout) => {
                    if (err || !stdout.trim()) return resolve({ verified: false, actualCount: 0 });
                    const actualPaths = stdout.split('\n').filter(Boolean);
                    const actualSet = new Set(actualPaths.map(normalize));
                    const verified = Array.from(expectedSet).every(p => actualSet.has(p));
                    resolve({ verified, actualCount: actualSet.size });
                });
            }
        });
    }
}
EOF

echo "⚙️ Overwriting src/services/export-orchestrator.service.ts with direct signal short-circuit rules..."
cat << 'EOF' > src/services/export-orchestrator.service.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigService } from './config.service';
import { ProcessRunnerService } from './process-runner.service';

export class ExportOrchestratorService {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configService: ConfigService,
        private readonly processRunner: ProcessRunnerService,
        private readonly webviewPanel: vscode.WebviewPanel
    ) {}

    public cancelActiveExport(): boolean {
        const script = this.configService.getPythonScriptPath(this.context.extensionPath);
        return this.processRunner.killActivePythonScript(script);
    }

    private makePathsAbsolute(paths: string[], workspaceRoot: string): string[] {
        return paths.map(p => {
            let clean = p.replace(/^['"]|['"]$/g, '').trim();
            if (!clean) return '';
            if (!path.isAbsolute(clean)) {
                return path.join(workspaceRoot, clean);
            }
            return clean;
        }).filter(Boolean);
    }

    private makeSinglePathAbsolute(p: string, workspaceRoot: string): string {
        let clean = (p || '').replace(/^['"]|['"]$/g, '').trim();
        if (!clean) return workspaceRoot;
        if (!path.isAbsolute(clean)) {
            return path.join(workspaceRoot, clean);
        }
        return clean;
    }

    public async run(formData: any): Promise<void> {
        const script = this.configService.getPythonScriptPath(this.context.extensionPath);
        const workspaceRoot = this.configService.getWorkspaceRootPath();

        const absoluteSourcesArray = this.makePathsAbsolute(formData.paths || [], workspaceRoot);
        const absoluteDestDirectory = this.makeSinglePathAbsolute(formData.destDir, workspaceRoot);
        const concatenatedSources = absoluteSourcesArray.join(',');

        const runtimeTransmittedData = {
            ...formData,
            destDir: absoluteDestDirectory
        };

        const execArgs = this.buildArgs(runtimeTransmittedData, concatenatedSources);
        const displayArgs = this.buildDisplayArgs(runtimeTransmittedData, concatenatedSources);

        const fullCommand = `python3 '${script}' ${displayArgs.join(' ')}`;
        this.webviewPanel.webview.postMessage({ command: 'updateCommand', text: fullCommand });

        try {
            const { code, signal, stdout, stderr } = await this.processRunner.executePython(
                script, execArgs,
                (out) => this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: out }),
                (err) => this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\x1b[91mERROR: ${err}\x1b[0m` })
            );

            // Halt immediately to suppress completion alerts if process termination signals are caught
            if (signal !== null || code === null) {
                return;
            }

            if (code === 0) {
                this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n✅ Process exited safely.\n` });
                vscode.window.showInformationMessage("Export Complete!");
                const generatedFiles = this.parseAndSendReport(stdout, runtimeTransmittedData.destDir);
                if (runtimeTransmittedData.copyGeneratedFilesToClipboard) {
                    await this.copyGeneratedFilesToClipboard(generatedFiles);
                }
            } else {
                const lastErrorLine = stderr.trim().split(/\r?\n/).filter(Boolean).pop();
                const detail = lastErrorLine ? `: ${lastErrorLine}` : '';
                this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n❌ Process exited with code ${code}${detail}\n` });
                vscode.window.showErrorMessage(`Export engine failed with exit code ${code}${detail}`);
            }
        } catch (e: any) {
            if (e.message && e.message.includes('Error: kill')) return;
            vscode.window.showErrorMessage(`Engine Error : ${e.message}`);
        }
    }

    private buildArgs(formData: any, sources: string): string[] {
        const args: string[] = ['--src', sources, '--dest', formData.destDir, '--format', formData.format];
        if (formData.maxFile) args.push('--max-file', formData.maxFile.toString());
        if (formData.maxChunk) args.push('--max-chunk', formData.maxChunk.toString());
        if (formData.groupByExt) args.push('--group-ext');
        if (formData.logConsole) args.push('--log-console');
        if (formData.logFile) args.push('--log-file');
        if (formData.generateTreeView) args.push('--tree-view');

        const cleanFilters = (val: string) => val.split(/[\n,]/).map(s => s.trim()).filter(s => s).join(',');
        if (formData.incPaths) args.push('--inc-paths', cleanFilters(formData.incPaths));
        if (formData.excPaths) args.push('--exc-paths', cleanFilters(formData.excPaths));
        if (formData.incExts) args.push('--inc-ext', cleanFilters(formData.incExts));
        if (formData.excExts) args.push('--exc-ext', cleanFilters(formData.excExts));
        return args;
    }

    private buildDisplayArgs(formData: any, sources: string): string[] {
        const args: string[] = ['--src', `'${sources}'`, '--dest', `'${formData.destDir}'`, '--format', `'${formData.format}'`];
        if (formData.maxFile) args.push('--max-file', `'${formData.maxFile}'`);
        if (formData.maxChunk) args.push('--max-chunk', `'${formData.maxChunk}'`);
        if (formData.groupByExt) args.push('--group-ext');
        if (formData.logConsole) args.push('--log-console');
        if (formData.logFile) args.push('--log-file');
        if (formData.generateTreeView) args.push('--tree-view');

        const cleanFilters = (val: string) => val.split(/[\n,]/).map(s => s.trim()).filter(s => s).join(',');
        if (formData.incPaths) args.push('--inc-paths', `'${cleanFilters(formData.incPaths)}'`);
        if (formData.excPaths) args.push('--exc-paths', `'${cleanFilters(formData.excPaths)}'`);
        if (formData.incExts) args.push('--inc-ext', `'${cleanFilters(formData.incExts)}'`);
        if (formData.excExts) args.push('--exc-ext', `'${cleanFilters(formData.excExts)}'`);
        return args;
    }

    private parseAndSendReport(stdout: string, destDirOverride: string): string[] {
        const lines = stdout.split('\n');
        let timestamp: string | undefined;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(lines[i].trim())) {
                timestamp = lines[i].trim();
                break;
            }
        }
        if (timestamp) {
            const destDir = destDirOverride || path.join(this.configService.getWorkspaceRootPath(), "exported-files");
            const reportFileName = `export-${timestamp}-report.json`;
            const reportPath = path.join(destDir, reportFileName);
            if (fs.existsSync(reportPath)) {
                const reportContent = fs.readFileSync(reportPath, 'utf8');
                const reportData = JSON.parse(reportContent);
                if (!reportData.results.generated_files) reportData.results.generated_files = {};
                reportData.results.generated_files.reports = [reportFileName];
                reportData.results.generated_files.logs = fs.existsSync(path.join(destDir, `export-${timestamp}.log`)) ? [`export-${timestamp}.log`] : [];

                const treeFileName = `export-${timestamp}-tree.json`;
                const treePath = path.join(destDir, treeFileName);
                if (fs.existsSync(treePath)) {
                    reportData.results.tree_manifest = JSON.parse(fs.readFileSync(treePath, 'utf8'));
                }

                this.webviewPanel.webview.postMessage({ command: 'updateExportReport', data: reportData.results });
                return (reportData.results.generated_files.exports || []).filter((filePath: string) => fs.existsSync(filePath));
            }
        }
        return [];
    }

    private async copyGeneratedFilesToClipboard(filePaths: string[]) {
        if (filePaths.length === 0) {
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n⚠️ Clipboard auto-copy skipped: no generated export files found.\n` });
            return;
        }

        try {
            const timeoutMs = this.configService.getConfiguration().get<number>('copyFilesToClipboardTimeout') ?? 10000;
            await this.processRunner.copyFilesToClipboard(filePaths, timeoutMs);
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n📋 Auto-copied and verified ${filePaths.length} generated file(s) to OS clipboard.\n` });
            vscode.window.showInformationMessage(`Copied and verified ${filePaths.length} generated file(s) to clipboard.`);
        } catch (err: any) {
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n❌ Clipboard auto-copy failed: ${err.message}\n` });
            vscode.window.showErrorMessage(`Clipboard verification failed: ${err.message}`);
        }
    }
}
EOF

echo "⚡ Recompiling target workspace infrastructure modification trees..."
npm run compile

echo "✅ Pipeline verification bug solved. Process execution leaks are plugged cleanly."
