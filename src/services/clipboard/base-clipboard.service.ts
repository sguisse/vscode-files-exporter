export interface IClipboardService {
    copyFilesToClipboard(files: string[], timeoutMs?: number): Promise<string>;
}
