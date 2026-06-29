#!/usr/bin/env python3
import sys
import os
import json
import subprocess

def copyFilesToClipboard(filePaths):
    if not filePaths:
        return

    platform = sys.platform

    if platform == 'darwin':
        jxa_script = f"""
        ObjC.import('AppKit');
        var pb = $.NSPasteboard.generalPasteboard;
        pb.clearContents;

        var paths = {json.dumps(filePaths)};
        var urls = $.NSMutableArray.alloc.init;

        for (var i = 0; i < paths.length; i++) {{
            urls.addObject($.NSURL.fileURLWithPath(paths[i]));
        }}

        pb.writeObjects(urls);
        $.NSThread.sleepForTimeInterval(0.3);
        """

        subprocess.run(['osascript', '-l', 'JavaScript', '-'], input=jxa_script.encode('utf-8'), check=True)
        return

    if platform == 'win32':
        ps = r"""
Add-Type -AssemblyName System.Windows.Forms
$paths = Get-Content -Raw | ConvertFrom-Json

$list = New-Object System.Collections.Specialized.StringCollection
foreach ($p in $paths) {
    if ($p) { [void]$list.Add([System.IO.Path]::GetFullPath($p)) }
}

[System.Windows.Forms.Clipboard]::SetFileDropList($list)
"""
        subprocess.run(
            ["powershell.exe", "-NoProfile", "-Sta", "-Command", ps],
            input=json.dumps(filePaths).encode("utf-8"),
            check=True
        )
        return

    uris = "\n".join([f"file://{p}" for p in filePaths])
    subprocess.run(
        ["xclip", "-selection", "clipboard", "-t", "text/uri-list", "-i"],
        input=uris.encode("utf-8"),
        check=True
    )

def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    input_file = sys.argv[1]
    if not os.path.exists(input_file):
        sys.exit(1)

    with open(input_file, "r", encoding="utf-8") as f:
        filePaths = json.load(f)

    copyFilesToClipboard(filePaths)
    print("SUCCESS")

if __name__ == "__main__":
    main()
