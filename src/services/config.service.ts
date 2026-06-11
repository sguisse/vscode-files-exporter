import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export class ConfigService {
    private static readonly PREFIX = 'filesExporter';

    public getConfiguration() {
        return vscode.workspace.getConfiguration(ConfigService.PREFIX);
    }

    // ✨ Added helper method to check the pinning preference dynamically
    public shouldPinWebview(): boolean {
        return this.getConfiguration().get<boolean>('pinFilesExporter') ?? true;
    }

    public getPythonScriptPath(extensionPath: string): string {
        const customPath = this.getConfiguration().get<string>('scriptPythonPath');
        return customPath || path.join(extensionPath, 'scripts', 'files-exporter.py');
    }

    public getHistoryFilePath(): string {
        const rawPath = this.getConfiguration().get<string>('historyYamlPath') || '~/.files-exporter-history.yaml';
        if (rawPath.startsWith('~')) {
            return path.join(os.homedir(), rawPath.slice(1));
        }
        return rawPath;
    }

    public getWorkspaceRootPath(): string {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        return os.homedir();
    }
}
