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

    // Command attached to the Explorer Context menu for Headless Exports
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
    webviewPanelManager: ExporterWebviewPanel
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
        const maxChunk = 0;
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
                        const generatedFiles: string[] = reportData.results?.generated_files?.exports || [];

                        // 1. Copy the generated files directly into the OS Clipboard
                        if (generatedFiles.length > 0) {
                            const timeoutMs = extensionConfig.get<number>('copyFilesToClipboardTimeout') ?? 10000;
                            await processRunner.copyFilesToClipboard(generatedFiles, timeoutMs).catch(err => {
                                vscode.window.showErrorMessage(`Failed to copy generated files to clipboard: ${err.message}`);
                            });
                        }

                        // 2. Create a detailed plain-text fallback string
                        const fallbackMessage = `✅ Export Pipeline Completed: Aggregated ${exportedCount} source file(s) into ${createdCount} output chunk(s). Generated files copied to clipboard!`;

                        // 3. Display the rich HTML success notification
                        const notificationService = new RichNotificationService(webviewPanelManager.panel);
                        notificationService.show(
                            fallbackMessage, // Used when Webview is closed
                            {
                                type: "success",
                                position: "bottom-right",
                                header: "Export Pipeline Completed",
                                // Used ONLY when Webview is actively open
                                message: `
                                    Successfully aggregated <b>${exportedCount}</b> source file(s) into <b>${createdCount}</b> output chunk(s).<br/><br/>
                                    📋 <b>Generated files</b> have been successfully copied to your OS clipboard.<br/><br/>
                                    📄 <b>Exported report file saved at:</b><br/>
                                    <code>${reportPath}</code>
                                `,
                                actions: [
                                    { label: "📋 Copy Source Paths", command: "copy_source_paths", data: { pathsToCopy: paths } },
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
                                } else if (command === "copy_source_paths" && payload?.pathsToCopy) {
                                    // Copy the source paths to the clipboard when the user clicks the button
                                    vscode.env.clipboard.writeText(payload.pathsToCopy.join('\n')).then(() => {
                                        vscode.window.showInformationMessage("Source paths successfully copied to clipboard!");
                                    });
                                }
                            }
                        );
                    }
                } else {
                    // Catch missing timestamp
                    vscode.window.showErrorMessage(`Files Exporter: Could not extract completion timestamp.`);
                }
            } else {
                // Catch Python non-zero exit codes
                vscode.window.showErrorMessage(`Files Exporter failed with code ${code}: ${stderr.trim()}`);
            }
        } catch (err: any) {
            // Catch spawn/process execution errors
            vscode.window.showErrorMessage(`Files Exporter Error: ${err.message}`);
        }
    });
}
