export const bridge = {
    vscode: acquireVsCodeApi(),
    postMessage(command, data = {}) { this.vscode.postMessage({ command, ...data }); }
};
