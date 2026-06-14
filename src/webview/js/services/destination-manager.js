import { bridge } from '../core/vscode.bridge.js';

export const DestinationManager = {
    copyLatestExportedFiles() {
        const destDir = document.getElementById('destDir')?.value;
        if (destDir) bridge.postMessage('copyLatestExportedFiles', { path: destDir });
    },
    openFinder() {
        const destDir = document.getElementById('destDir')?.value;
        if (destDir) bridge.postMessage('openFinder', { path: destDir });
    },
    clearDestDirectory() {
        const destDir = document.getElementById('destDir')?.value;
        if (destDir) bridge.postMessage('clearDestDirectory', { path: destDir });
    }
};
