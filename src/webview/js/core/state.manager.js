export const state = {
    selectedPaths: [],
    historyList: [],
    defaultSettings: {},
    tooltipDelayValue: 400,
    lastGeneratedFilesPayload: null,
    currentSelectedId: 'default',
    isInitializing: true,
    pathListInvalid: false,
    totalExportedSourceFiles: 0, // ✨ Tracks total filtered source files processed
    updatePaths(paths) { this.selectedPaths = paths || []; },
    updateHistory(history, selectedId) {
        this.historyList = history || [];
        this.currentSelectedId = selectedId || 'default';
    }
};
