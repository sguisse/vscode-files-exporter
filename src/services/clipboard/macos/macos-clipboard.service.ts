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
