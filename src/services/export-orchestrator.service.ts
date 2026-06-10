import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ConfigService } from './config.service';
import { ProcessRunnerService } from './process-runner.service';

export class ExportOrchestratorService {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configService: ConfigService,
        private readonly processRunner: ProcessRunnerService,
        private readonly webviewPanel: vscode.WebviewPanel
    ) {}

    public async run(formData: any): Promise<void> {
        const script = this.configService.getPythonScriptPath(this.context.extensionPath);
        const concatenatedSources = (formData.paths || []).join(',');

        const execArgs = this.buildArgs(formData, concatenatedSources);
        const displayArgs = this.buildDisplayArgs(formData, concatenatedSources);

        const fullCommand = `python3 '${script}' ${displayArgs.join(' ')}`;
        this.webviewPanel.webview.postMessage({ command: 'updateCommand', text: fullCommand });
        this.webviewPanel.webview.postMessage({
            command: 'terminalLog',
            text: `\n🐛 [QA Debug Trace] Array arguments sent to process engine: ${JSON.stringify(execArgs)}\n`
        });

        try {
            const { code, stdout, stderr } = await this.processRunner.executePython(
                script, execArgs,
                (out) => this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: out }),
                (err) => this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\x1b[91mERROR: ${err}\x1b[0m` })
            );

            if (code === 0) {
                this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n✅ Process exited safely.\n` });
                vscode.window.showInformationMessage("Export Complete!");
                const generatedFiles = this.parseAndSendReport(stdout, formData.destDir);
                if (formData.copyGeneratedFilesToClipboard) {
                    await this.copyGeneratedFilesToClipboard(generatedFiles);
                }
            } else {
                const lastErrorLine = stderr.trim().split(/\r?\n/).filter(Boolean).pop();
                const detail = lastErrorLine ? `: ${lastErrorLine}` : '';
                this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n❌ Process exited with code ${code}${detail}\n` });
                vscode.window.showErrorMessage(`Export engine failed with exit code ${code}${detail}`);
            }
        } catch (e: any) {
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
            // ✨ Redirecting to the centralized process runner utility service
            await this.processRunner.copyFilesToClipboard(filePaths);
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n📋 Auto-copied ${filePaths.length} generated file(s) to OS clipboard.\n` });
            vscode.window.showInformationMessage(`Copied ${filePaths.length} generated file(s) to clipboard.`);
        } catch (err: any) {
            this.webviewPanel.webview.postMessage({ command: 'terminalLog', text: `\n⚠️ Clipboard auto-copy failed: ${err.message}\n` });
            vscode.window.showWarningMessage(`Clipboard auto-copy failed: ${err.message}`);
        }
    }

}
