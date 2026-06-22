import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExporterWebviewPanel } from '../webview/webview.panel';
import { ExtensionState } from '../interfaces/export.interface';
import { ConfigService } from '../services/config.service';
import { ProcessRunnerService } from '../services/process-runner.service';
import { RichNotificationService } from '../services/rich-notification.service';

export function registerCommands(
    context: vscode.ExtensionContext,
    webviewPanelManager: ExporterWebviewPanel,
    state: ExtensionState,
    configService: ConfigService,
    processRunner: ProcessRunnerService
) {
    const openCmd = vscode.commands.registerCommand('files-exporter.openTool', () => handleOpenTool(webviewPanelManager));
    const addCmd = vscode.commands.registerCommand('files-exporter.addFromExplorer', (uri: vscode.Uri, selectedUris: vscode.Uri[]) => handleAddFromExplorer(uri, selectedUris, state, webviewPanelManager));
    const excludeCmd = vscode.commands.registerCommand('files-exporter.ExcludeFromExplorer', (uri: vscode.Uri, selectedUris: vscode.Uri[]) => handleExcludeFromExplorer(uri, selectedUris, webviewPanelManager));

    // Add webviewPanelManager as the last argument
    const exportPathsCmd = vscode.commands.registerCommand('files-exporter.exportSelectedPaths', (uri: vscode.Uri, selectedUris: vscode.Uri[]) =>
        handleHeadlessExportSelectedPaths(uri, selectedUris, context, configService, processRunner, webviewPanelManager)
    );

    context.subscriptions.push(openCmd, addCmd, excludeCmd, exportPathsCmd);
}

function handleOpenTool(webviewPanelManager: ExporterWebviewPanel) {
    webviewPanelManager.show('open');
}

function handleAddFromExplorer(uri: vscode.Uri, selectedUris: vscode.Uri[], state: ExtensionState, webviewPanelManager: ExporterWebviewPanel) {
    const uris = selectedUris || (uri ? [uri] : []);
    uris.forEach(u => {
        if (u && !state.selectedPaths.includes(u.fsPath)) {
            state.selectedPaths.push(u.fsPath);
        }
    });
    webviewPanelManager.show('add');
}

function handleExcludeFromExplorer(uri: vscode.Uri, selectedUris: vscode.Uri[], webviewPanelManager: ExporterWebviewPanel) {
    const uris = selectedUris || (uri ? [uri] : []);
    uris.forEach(u => {
        if (u) {
            webviewPanelManager.excludePathFromExplorer(u.fsPath);
        }
    });
}

async function handleHeadlessExportSelectedPaths(
    uri: vscode.Uri,
    selectedUris: vscode.Uri[],
    context: vscode.ExtensionContext,
    configService: ConfigService,
    processRunner: ProcessRunnerService,
    webviewPanelManager: ExporterWebviewPanel // ✨ Add this parameter
) {
    const uris = selectedUris || (uri ? [uri] : []);
    const paths = uris.map(u => u.fsPath).filter(Boolean);

    if (paths.length === 0) return;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Exporting selected paths...",
        cancellable: false
    }, async () => {
        const workspacePath = configService.getWorkspaceRootPath();
        const extensionConfig = configService.getConfiguration();
        const script = configService.getPythonScriptPath(context.extensionPath);
        const destDir = path.join(workspacePath, "exported-files");
        const format = extensionConfig.get<string>('defaultFormat') || 'yaml';
        const maxFile = extensionConfig.get<number>('maxFileSizeKb') ?? 50;
        const maxChunk = extensionConfig.get<number>('maxChunkSizeKb') ?? 0;
        const groupByExt = extensionConfig.get<boolean>('splitChunkByFileExtension') ?? false;

        const args: string[] = [
            '--mode', 'paths-export',
            '--dest', destDir,
            '--format', format,
            '--max-file', maxFile.toString(),
            '--max-chunk', maxChunk.toString()
        ];

        if (groupByExt) args.push('--group-ext');

        // Pass the paths dynamically
        args.push('--src', ...paths);

        try {
            const { code, stdout, stderr } = await processRunner.executePython(
                script, args,
                () => {}, // Suppress live stdout
                () => {}  // Suppress live stderr
            );

            if (code === 0) {
                // Parse the timestamp outputted by Python to locate the report
                const lines = stdout.split('\n');
                let timestamp: string | undefined;

                for (let i = lines.length - 1; i >= 0; i--) {
                    if (/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(lines[i].trim())) {
                        timestamp = lines[i].trim();
                        break;
                    }
                }

                if (timestamp) {
                    const reportPath = path.join(destDir, `export-${timestamp}-report.json`);

                    if (fs.existsSync(reportPath)) {
                        const reportContent = fs.readFileSync(reportPath, 'utf8');
                        const reportData = JSON.parse(reportContent);

                        const exportedCount = reportData.results?.summary?.total_exported || 0;
                        const createdCount = reportData.results?.summary?.chunks_generated || 0;

                        // ✅ COPY THE LIST OF SOURCE PATHS TO THE CLIPBOARD AS TEXT
                        await vscode.env.clipboard.writeText(paths.join('\n'));

                        // Display the rich HTML success notification
                        // 1. Create a detailed plain-text fallback string
                        const fallbackMessage = `✅ Export Pipeline Completed: Aggregated ${exportedCount} source file(s) into ${createdCount} output chunk(s). Source paths copied to clipboard!`;

                        const notificationService = new RichNotificationService(webviewPanelManager.panel);

                        notificationService.show(
                            fallbackMessage, // ✨ PASS THE DETAILED TEXT HERE (Used when Webview is closed)
                            {
                                type: "success",
                                position: "bottom-right",
                                header: "Export Pipeline Completed",
                                // This rich HTML is used ONLY when the Webview is actively open
                                message: `
                                    Successfully aggregated <b>${exportedCount}</b> source file(s) into <b>${createdCount}</b> output chunk(s).<br/><br/>
                                    📋 <b>Source paths</b> have been successfully copied to your OS clipboard.<br/><br/>
                                    📄 <b>Exported report file saved at:</b><br/>
                                    <code>${reportPath}</code>
                                `,
                                actions: [
                                    { label: "📁 Open Report File", command: "open_report_file", data: { path: reportPath } },
                                    { label: "Dismiss", command: "close_notification" }
                                ]
                            },
                            (command: string, payload: any) => {
                                if (command === "open_report_file" && payload?.path) {
                                    // Automatically open the generated report file in VS Code editor grid
                                    vscode.workspace.openTextDocument(payload.path).then(
                                        doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Active),
                                        err => vscode.window.showErrorMessage(`Failed to open report file: ${err.message}`)
                                    );
                                }
                            }
                        );
                    }
                } else {
                    vscode.window.showErrorMessage(`Files Exporter: Could not extract completion timestamp.`);
                }
            } else {
                vscode.window.showErrorMessage(`Files Exporter failed with code ${code}: ${stderr.trim()}`);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Files Exporter Error: ${err.message}`);
        }
    });
}
