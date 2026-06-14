import * as vscode from 'vscode';
import * as path from 'path';
import { HistoryService } from '../services/history.service';
import { ConfigService } from '../services/config.service';
import { ExportConfig } from '../interfaces/export.interface';

export class HistoryCommandHandler {
    constructor(
        private panel: vscode.WebviewPanel,
        private historyService: HistoryService,
        private configService: ConfigService
    ) {}

    public async handleDuplicateHistory(message: any) {
        if (message.id) {
            const repoDup = this.configService.getRepoName();
            const dup = await this.historyService.duplicateEntry(message.id, repoDup);
            this.panel.webview.postMessage({ command: 'updateHistory', history: dup.history, selectedId: dup.newId });
        }
    }

    public async handleAddNewConfigProfile(message: any) {
        const defaultSettingsObj = this.getDefaultSettings();
        const wsPath = this.configService.getWorkspaceRootPath();
        const wsName = path.basename(wsPath);
        const repoNew = this.configService.getRepoName();
        const fresh = await this.historyService.addNewEntry(
            message.duplicateConfig || defaultSettingsObj,
            wsName,
            repoNew,
            message.customName
        );
        this.panel.webview.postMessage({ command: 'updateHistory', history: fresh.history, selectedId: fresh.newId });
    }

    private defaultConfig: ExportConfig | null = null;

    private getDefaultSettings(): ExportConfig {
        if (this.defaultConfig) return this.defaultConfig;
        const workspacePath = this.configService.getWorkspaceRootPath();
        const extensionConfig = this.configService.getConfiguration();
        this.defaultConfig = {
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
        return this.defaultConfig;
    }
}
