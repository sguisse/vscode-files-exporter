#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────────────────────────────
# FILES EXPORTER - VOLATILE TERMINATION NOTIFICATION SILENCING PATCH
# ───────────────────────────────────────────────────────────────────────────────────────────────────
# This production script targets and optimizes the ExportOrchestratorService. It adds an explicit
# short-circuit check right after the Python sub-process returns, completely suppressing the
# "Export Complete!" message if the task was broken or killed mid-flight by a user kill action.

set -e

echo "⏳ Verifying target directories..."
mkdir -p src/services

echo "⚙️ Updating src/services/export-orchestrator.service.ts to silence kill-state notifications..."
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
            const { code, stdout, stderr } = await this.processRunner.executePython(
                script, execArgs,
                (out) => this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: out }),
                (err) => this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\x1b[91mERROR: ${err}\x1b[0m` })
            );

            // Defensive Check: If streams are fully empty and exit code indicates anomaly, it implies SIGKILL termination.
            // Proactively intercept and return here to block downstream completion popup notifications.
            if (code !== 0 && stderr.length === 0 && stdout.length === 0) {
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

echo "⚡ Recompiling configuration orchestrator modules..."
npm run compile

echo "✅ Silent kill termination patch applied completely to the background runner streams!"
