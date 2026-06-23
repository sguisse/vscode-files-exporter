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

    // Command to recursively copy selected file/folder entities straight to clipboard
    const copyFilesCmd = vscode.commands.registerCommand('files-exporter.copySelectedFilesToClipboard', (uri: vscode.Uri, selectedUris: vscode.Uri[]) =>
        handleCopySelectedFilesToClipboard(uri, selectedUris, configService, processRunner)
    );

    context.subscriptions.push(openCmd, addCmd, excludeCmd, exportPathsCmd, copyFilesCmd);
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

// Handler implementing recursive filesystem discovery, threshold guardrails, and clipboard sync
async function handleCopySelectedFilesToClipboard(
    uri: vscode.Uri,
    selectedUris: vscode.Uri[],
    configService: ConfigService,
    processRunner: ProcessRunnerService
) {
    const uris = selectedUris || (uri ? [uri] : []);
    const rootPaths = uris.map(u => u.fsPath).filter(Boolean);

    if (rootPaths.length === 0) {
        vscode.window.showWarningMessage("No files or directories selected.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Scanning file paths...",
        cancellable: false
    }, async () => {
        try {
            const absoluteFilePaths: string[] = [];
            let totalSizeBytes = 0;

            // Local helper function to sweep through directory hierarchies recursively
            function resolveFilesRecursively(currentPath: string) {
                if (!fs.existsSync(currentPath)) return;

                const stat = fs.statSync(currentPath);
                if (stat.isFile()) {
                    absoluteFilePaths.push(currentPath);
                    totalSizeBytes += stat.size;
                } else if (stat.isDirectory()) {
                    const children = fs.readdirSync(currentPath);
                    for (const child of children) {
                        resolveFilesRecursively(path.join(currentPath, child));
                    }
                }
            }

            // Run processing loop on items chosen by user selection
            for (const rootPath of rootPaths) {
                resolveFilesRecursively(rootPath);
            }

            if (absoluteFilePaths.length === 0) {
                vscode.window.showWarningMessage("No files discovered within selected paths.");
                return;
            }

            // ✨ Threshold validation guardrail (File limit: 50 OR size limit: 5MB)
            const FIVE_MEGABYTES = 5 * 1024 * 1024;
            if (absoluteFilePaths.length > 50 || totalSizeBytes > FIVE_MEGABYTES) {
                // Human-readable size strings conversion formatter
                const formattedSize = totalSizeBytes >= 1024 * 1024
                    ? `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`
                    : `${(totalSizeBytes / 1024).toFixed(2)} KB`;

                const confirmation = await vscode.window.showWarningMessage(
                    `⚠️ Large Clipboard Payload Warning\n\nYou are attempting to copy ${absoluteFilePaths.length} files totaling ${formattedSize} directly into your OS clipboard. Large copy transfers can occasionally cause micro-stuttering. Do you want to continue?`,
                    { modal: true },
                    "Copy Anyway"
                );

                if (confirmation !== "Copy Anyway") {
                    return; // Gracefully halt execution pipeline
                }
            }

            // Retrieve tracking timeout value set in system preferences configurations
            const extensionConfig = configService.getConfiguration();
            const timeoutMs = extensionConfig.get<number>('copyFilesToClipboardTimeout') ?? 10000;

            // Hand over files arrays collection to the Python clipboard agent script execution runtime
            await processRunner.copyFilesToClipboard(absoluteFilePaths, timeoutMs);
            vscode.window.showInformationMessage(`📋 Successfully copied ${absoluteFilePaths.length} file(s) to the OS clipboard cache.`);

        } catch (err: any) {
            vscode.window.showErrorMessage(`Clipboard pipeline error: ${err.message}`);
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
        args.push('--src', ...paths);

        try {
            const { code, stdout, stderr } = await processRunner.executePython(
                script, args,
                () => {},
                () => {}
            );

            if (code === 0) {
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

                        if (generatedFiles.length > 0) {
                            const timeoutMs = extensionConfig.get<number>('copyFilesToClipboardTimeout') ?? 10000;
                            await processRunner.copyFilesToClipboard(generatedFiles, timeoutMs).catch(err => {
                                vscode.window.showErrorMessage(`Failed to copy generated files to clipboard: ${err.message}`);
                            });
                        }

                        const fallbackMessage = `✅ Export Pipeline Completed: Aggregated ${exportedCount} source file(s) into ${createdCount} output chunk(s). Generated files copied to clipboard!`;
                        const notificationService = new RichNotificationService(webviewPanelManager.panel);
                        notificationService.show(
                            fallbackMessage,
                            {
                                type: "success",
                                position: "bottom-right",
                                header: "Export Pipeline Completed",
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
                                    vscode.workspace.openTextDocument(payload.path).then(
                                        doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Active),
                                        err => vscode.window.showErrorMessage(`Failed to open report file: ${err.message}`)
                                    );
                                } else if (command === "copy_source_paths" && payload?.pathsToCopy) {
                                    vscode.env.clipboard.writeText(payload.pathsToCopy.join('\n')).then(() => {
                                        vscode.window.showInformationMessage("Source paths successfully copied to clipboard!");
                                    });
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
