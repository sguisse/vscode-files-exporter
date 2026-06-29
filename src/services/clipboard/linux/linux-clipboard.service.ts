import { spawn } from "child_process";

export class LinuxClipboardService {

    public async copyFilesToClipboard(files: string[], timeoutMs: number = 10000): Promise<string> {

        return new Promise((resolve, reject) => {

            const payload = files.map(f => `file://${f}`).join("\n");

            const child = spawn("xclip", ["-selection", "clipboard", "-t", "text/uri-list", "-i"]);

            child.stdin.write(payload);
            child.stdin.end();

            child.on("close", code => {
                if (code === 0) resolve("TX_OK");
                else reject(new Error("clipboard_linux_failed"));
            });

            setTimeout(() => reject(new Error("clipboard_transaction_timeout")), timeoutMs);
        });
    }
}
