import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export class ConfigService {
    private static readonly PREFIX = 'filesExporter';

    public getConfiguration() {
        return vscode.workspace.getConfiguration(ConfigService.PREFIX);
    }

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

    /**
     * R01: Resolves active repository identifier naming context using fallback strategy
     */
    public getRepoName(): string {
        const wsPath = this.getWorkspaceRootPath();
        try {
            const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: wsPath, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
            return path.basename(gitRoot);
        } catch {
            return path.basename(wsPath);
        }
    }
}
