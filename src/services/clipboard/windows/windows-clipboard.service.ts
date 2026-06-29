import { spawn } from "child_process";

export class WindowsClipboardService {

    public async copyFilesToClipboard(files: string[], timeoutMs: number = 10000): Promise<string> {

        return new Promise((resolve, reject) => {

            const ps = `
Add-Type -AssemblyName System.Windows.Forms

$files = @(
${files.map(f => `"${f.replace(/"/g, '`"')}"`).join(",\n")}
)

$list = New-Object System.Collections.Specialized.StringCollection

foreach ($f in $files) {
    if ($f) { [void]$list.Add($f) }
}

# SINGLE BATCH CALL (CRITICAL PERFORMANCE FIX)
[System.Windows.Forms.Clipboard]::SetFileDropList($list)
[System.Windows.Forms.Clipboard]::Flush()

Write-Host "TX_OK"
`;

            const child = spawn("powershell.exe", [
                "-NoProfile",
                "-STA",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "-"
            ]);

            let out = "";
            let err = "";

            child.stdout.on("data", d => out += d.toString());
            child.stderr.on("data", d => err += d.toString());

            child.on("close", (code) => {
                if (code === 0) resolve(out.trim());
                else reject(new Error(err || "clipboard_windows_failed"));
            });

            child.stdin.write(ps);
            child.stdin.end();

            setTimeout(() => reject(new Error("clipboard_transaction_timeout")), timeoutMs);
        });
    }
}
