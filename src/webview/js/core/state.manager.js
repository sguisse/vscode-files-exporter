export const state = {
    selectedPaths: [],
    historyList: [],
    defaultSettings: {},
    tooltipDelayValue: 400,
    lastGeneratedFilesPayload: null,
    currentSelectedId: 'default',
    isInitializing: true,
    pathListInvalid: false,
    updatePaths(paths) { this.selectedPaths = paths || []; },
    updateHistory(history, selectedId) {
        this.historyList = history || [];
        this.currentSelectedId = selectedId || 'default';
    }
};
