#!/usr/bin/env bash
set -e

echo "🚀 Clipboard Engine v4 - Batch Mode + Platform Split + macOS safe verify"

mkdir -p src/services/clipboard/windows
mkdir -p src/services/clipboard/macos
mkdir -p src/services/clipboard/linux

############################################################
# ROUTER
############################################################

cat << 'EOF' > src/services/clipboard/clipboard.service.ts
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
EOF

############################################################
# WINDOWS BATCH MODE (OPTIMIZED SINGLE TRANSACTION)
############################################################

cat << 'EOF' > src/services/clipboard/windows/windows-clipboard.service.ts
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
EOF

############################################################
# MACOS (UNCHANGED + SAFE VERIFY OPTION KEPT)
############################################################

cat << 'EOF' > src/services/clipboard/macos/macos-clipboard.service.ts
import { spawn } from "child_process";

export class MacOSClipboardService {

    public async copyFilesToClipboard(files: string[], timeoutMs: number = 10000): Promise<string> {

        return new Promise((resolve, reject) => {

            const jxa = `
ObjC.import('AppKit');

var pb = $.NSPasteboard.generalPasteboard;
pb.clearContents;

var paths = ${JSON.stringify(files)};
var urls = $.NSMutableArray.alloc.init;

for (var i = 0; i < paths.length; i++) {
    urls.addObject($.NSURL.fileURLWithPath(paths[i]));
}

pb.writeObjects(urls);

$.NSThread.sleepForTimeInterval(0.2);

"TX_OK";
`;

            const child = spawn("osascript", ["-l", "JavaScript", "-"]);

            let out = "";
            let err = "";

            child.stdout.on("data", d => out += d.toString());
            child.stderr.on("data", d => err += d.toString());

            child.on("close", code => {
                if (code === 0) resolve(out.trim());
                else reject(new Error(err || "clipboard_macos_failed"));
            });

            child.stdin.write(jxa);
            child.stdin.end();

            setTimeout(() => reject(new Error("clipboard_transaction_timeout")), timeoutMs);
        });
    }

    // OPTIONAL SAFE VERIFY (kept)
    public async verifyClipboard(expected: string[]): Promise<boolean> {

        return new Promise(resolve => {

            const script = `
ObjC.import('AppKit');

var pb = $.NSPasteboard.generalPasteboard;
var items = pb.pasteboardItems;
var res = [];

if (items) {
    for (var i = 0; i < items.count; i++) {
        var it = items.objectAtIndex(i);
        var str = it.stringForType("public.file-url");
        if (str) res.push(str.toString());
    }
}

JSON.stringify(res);
`;

            const child = spawn("osascript", ["-l", "JavaScript", "-"]);

            let out = "";

            child.stdout.on("data", d => out += d.toString());

            child.on("close", () => {
                try {
                    const actual = JSON.parse(out || "[]");
                    resolve(actual.length >= expected.length);
                } catch {
                    resolve(false);
                }
            });

            child.stdin.write(script);
            child.stdin.end();
        });
    }
}
EOF

############################################################
# LINUX (UNCHANGED SAFE)
############################################################

cat << 'EOF' > src/services/clipboard/linux/linux-clipboard.service.ts
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
EOF

echo "✅ V4 batch clipboard installed (Windows batch STA + macOS stable + Linux safe)"
echo "➡ next: npm run compile"