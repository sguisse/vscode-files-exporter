import { WindowsClipboardService } from "./windows/windows-clipboard.service";
import { MacOSClipboardService } from "./macos/macos-clipboard.service";
import { LinuxClipboardService } from "./linux/linux-clipboard.service";

export class ClipboardService {

    private windows = new WindowsClipboardService();
    private macos = new MacOSClipboardService();
    private linux = new LinuxClipboardService();

    public async copyFilesToClipboard(files: string[], timeoutMs: number = 10000): Promise<string> {

        const platform = process.platform;

        if (platform === "win32") return this.windows.copyFilesToClipboard(files, timeoutMs);
        if (platform === "darwin") return this.macos.copyFilesToClipboard(files, timeoutMs);

        return this.linux.copyFilesToClipboard(files, timeoutMs);
    }
}
