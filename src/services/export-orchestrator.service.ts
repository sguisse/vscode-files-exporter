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

    private async verifyFilesReady(filePaths: string[], retries = 5, delay = 500): Promise<boolean> {
    for (const path of filePaths) {
        for (let i = 0; i < retries; i++) {
            try {
                // Verify existence and basic accessibility
                await fs.promises.access(path, fs.constants.R_OK);
                // Optional: Check if content is actually written (stat.size > 0)
                const stats = await fs.promises.stat(path);
                if (stats.size > 0) break;
            } catch (err) {
                if (i === retries - 1) return false;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    return true;
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

            // If the user killed the process or it exited via signal, abort and suppress confirmation alert maps
            if (signal !== null || code === null) {
                return;
            }

            if (code === 0) {
                this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n✅ Process exited safely.\n` });
                vscode.window.showInformationMessage("Export Complete!");
                const generatedFiles = this.parseAndSendReport(stdout, runtimeTransmittedData.destDir);
                // Use verified readiness before copying
                const isReady = await this.verifyFilesReady(generatedFiles);
                if (isReady && runtimeTransmittedData.copyGeneratedFilesToClipboard) {
                    await this.copyGeneratedFilesToClipboard(generatedFiles);
                } else if (!isReady) {
                    this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n❌ Clipboard copy failed: Files not ready after generation.\n` });
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

                // Deterministic and precise calculation of the number of tokens (Blended Char/Word count) on exported files
                    const exportedFilesList = (reportData.results.generated_files.exports || []).filter((filePath: string) => fs.existsSync(filePath));
                    let totalTokens = 0;

                    for (const filePath of exportedFilesList) {
                        try {
                            const text = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
                            const normalized = text.replace(/\s+/g, ' ').trim();

                            const charCount = normalized.length;
                            const wordCount = normalized ? normalized.split(' ').length : 0;

                            const charEstimate = charCount / 4;
                            const wordEstimate = wordCount * 0.75;

                            const blended = (charEstimate + wordEstimate) / 2;
                            totalTokens += Math.max(0, Math.round(blended));
                        } catch (err) {
                            console.error('Error calculating file tokens:', filePath, err);
                        }
                    }
                    reportData.results.estimatedInputTokens = totalTokens;

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
            const pyOut = await this.processRunner.copyFilesToClipboard(filePaths, timeoutMs);
            if (pyOut) this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n🐍 [Python Clipboard]:\n${pyOut}\n` });
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n📋 Auto-copied and verified ${filePaths.length} generated file(s) to OS clipboard.\n` });
            vscode.window.showInformationMessage(`Copied and verified ${filePaths.length} generated file(s) to clipboard.`);
        } catch (err: any) {
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n❌ Clipboard auto-copy failed: ${err.message}\n` });
            vscode.window.showErrorMessage(`Clipboard verification failed: ${err.message}`);
        }
    }
}
