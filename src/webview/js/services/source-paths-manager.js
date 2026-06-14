import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';
import { UIController } from '../core/ui.controller.js';

export const SourcePathsManager = {
    saveActiveTextareaCursorIndex() {
        const textarea = document.getElementById('pathList');
        const hiddenInput = document.getElementById('hiddenPathListCursorIndex');
        if (!textarea || !hiddenInput) return;

        const nativeTextarea = textarea.shadowRoot?.querySelector('textarea') || textarea;
        const selectionStart = nativeTextarea.selectionStart || 0;
        const textContent = nativeTextarea.value || '';

        const textUpToCursor = textContent.substring(0, selectionStart);
        const lineIndex = textUpToCursor.split('\n').length;

        hiddenInput.value = lineIndex.toString();
    },
    clearPaths() {
        state.selectedPaths = [];
        const pathEl = document.getElementById('pathList');
        if (pathEl) pathEl.value = '';
        bridge.postMessage('clearPaths');
        UIController.checkSyncStatus();
    },
    addOpenFiles() {
        const currentPaths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
        bridge.postMessage('addOpenFiles', { currentPaths });
    },
    addGitDiffFiles() {
        const currentPaths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
        bridge.postMessage('addGitDiffFiles', { currentPaths });
    },
    openPathAtCursor() {
        const textarea = document.getElementById('pathList');
        const hiddenInput = document.getElementById('hiddenPathListCursorIndex');
        if (!textarea || !hiddenInput) return;

        const text = textarea.value || '';
        const lines = text.split('\n');

        let savedLineIndex = parseInt(hiddenInput.value || '1', 10);
        if (isNaN(savedLineIndex) || savedLineIndex < 1) savedLineIndex = 1;
        if (savedLineIndex > lines.length) savedLineIndex = lines.length;

        const lineContent = (lines[savedLineIndex - 1] || '').trim();
        bridge.postMessage('openPathAtCursor', { path: lineContent, lineNum: savedLineIndex });
    }
};
