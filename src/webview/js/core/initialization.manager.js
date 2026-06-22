import { bridge } from './vscode.bridge.js';
import { state } from './state.manager.js';
import { ValidatorService } from '../services/validator.service.js';
import { UIController } from './ui.controller.js';
import { HistoryManager } from '../services/history-manager.js';
import { SourcePathsManager } from '../services/source-paths-manager.js';
import { FiltersManager } from '../services/filters-manager.js';
import { DestinationManager } from '../services/destination-manager.js';
import { ExportManager } from '../services/export-manager.js';
import { HandlerManager } from '../services/handler-manager.js';
import { BlockSummaryBuilder } from '../services/block-summary-builder.js';
import { FiltersSimulator } from '../services/filters-simulator.js';

let isModifierPressed = false;

export const InitializationManager = {
    // Computes and toggles headers summary metadata metrics
    refreshBlockSummaryUI(blockId, isCollapsed) {
        const summaryElement = document.getElementById(`summary-${blockId}`);
        if (!summaryElement) return;

        if (isCollapsed) {
            summaryElement.innerHTML = BlockSummaryBuilder.computeBlockSummary(blockId);
            summaryElement.style.display = 'inline-block';
        } else {
            summaryElement.innerHTML = '';
            summaryElement.style.display = 'none';
        }
    },

    /**
     * Initialize the filter simulator functionality
     */
    setupFilterSimulator() {
        const filterSimulatorInput = document.getElementById('filters-simulator-input');

        // Add event listener to update emoji on input
        filterSimulatorInput.addEventListener('input', (e) => {
            FiltersSimulator.updateEmoji(e.target.value);
        });

        // Add event listener to clear emoji when focus is lost
        filterSimulatorInput.addEventListener('blur', (e) => {
            FiltersSimulator.updateEmoji(e.target.value);
        });
    },

    // Dedicated method to handle Shadow DOM textareas structural height synchronization
    setupTextAreaSync() {
        const textAreas = [
            document.getElementById('incPaths'),
            document.getElementById('incExts'),
            document.getElementById('excPaths'),
            document.getElementById('excExts')
        ].filter(Boolean);

        let isSynchronizing = false;

        const synchronizeHeights = (targetHeight) => {
            if (isSynchronizing) return;
            isSynchronizing = true;

            let maxHeight = targetHeight;

            // If no target height is provided, calculate the maximum current height across blocks
            if (!maxHeight) {
                const heights = textAreas.map(ta => {
                    const inner = ta.shadowRoot?.querySelector('textarea');
                    return inner ? inner.offsetHeight : ta.offsetHeight;
                });
                maxHeight = Math.max(...heights);
            }

            // Apply identical height boundaries to all parent host and inner native elements
            textAreas.forEach(ta => {
                ta.style.height = `${maxHeight}px`;

                const inner = ta.shadowRoot?.querySelector('textarea');
                if (inner) {
                    // Force the inner native textarea layout to track 100% of the container component
                    inner.style.height = '100%';
                }
            });

            isSynchronizing = false;
        };

        // Use ResizeObserver to intercept manual UI cursor drag adjustments instantly
        if (typeof ResizeObserver !== 'undefined' && textAreas.length > 0) {
            const observer = new ResizeObserver((entries) => {
                if (isSynchronizing) return;

                let highest = 0;
                for (const entry of entries) {
                    const height = entry.borderBoxSize?.[0]?.blockSize || entry.target.offsetHeight;
                    if (height > highest) {
                        highest = height;
                    }
                }

                if (highest > 0) {
                    synchronizeHeights(highest);
                }
            });

            // Observe both the component host and its underlying native node
            textAreas.forEach(ta => {
                observer.observe(ta);

                const inner = ta.shadowRoot?.querySelector('textarea');
                if (inner) {
                    observer.observe(inner);
                } else {
                    // Fallback polling macro-task execution queue if hydration is delayed
                    setTimeout(() => {
                        const dynamicInner = ta.shadowRoot?.querySelector('textarea');
                        if (dynamicInner) observer.observe(dynamicInner);
                    }, 100);
                }
            });
        }

        // Initial setup execution timeout buffer allowing VS Code styles injection
        setTimeout(() => synchronizeHeights(), 100);
    },

    init(tabs) {
        window.reportTab = tabs.reportTab;
        window.filesTab = tabs.filesTab;
        window.treeViewTab = tabs.treeViewTab;
        window.terminalTab = tabs.terminalTab;

        UIController.injectShadowDomStyles();
        UIController.initCursorTooltipTracker();

        if (tabs.helpTab) tabs.helpTab.render();

        const allBlocks = [
            'block-history', 'block-sourcepaths', 'block-filters', 'block-destination', 'block-options',
            'costEstimationSection', 'reportTableSection', 'reportGraphSection',
            'section-exported-files', 'section-logs-block', 'section-reports-block',
            'section-tree-explorer', 'section-terminal-cmd', 'section-terminal-logs'
        ];

        const collapsedByDefault = ['costEstimationSection'];

        allBlocks.forEach(blockId => {
            const blockEl = document.getElementById(blockId);
            if (!blockEl) return;

            const header = blockEl.querySelector('.collapsible-block-header');
            const content = blockEl.querySelector('.collapsible-block-content');
            const icon = document.getElementById(`icon-${blockId}`) || blockEl.querySelector('.collapsible-title-group .codicon');

            if (header && content && icon) {
                const shouldCollapse = collapsedByDefault.includes(blockId);
                content.style.display = shouldCollapse ? 'none' : 'block';
                icon.className = shouldCollapse ? 'codicon codicon-chevron-right' : 'codicon codicon-chevron-down';
                this.refreshBlockSummaryUI(blockId, shouldCollapse);

                header.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isClosed = content.style.display === 'none';
                    content.style.display = isClosed ? 'block' : 'none';
                    icon.className = isClosed ? 'codicon codicon-chevron-down' : 'codicon codicon-chevron-right';
                    this.refreshBlockSummaryUI(blockId, !isClosed);
                };
            }
        });

        window.forceGlobalSummariesUpdate = () => {
            allBlocks.forEach(id => {
                const content = document.getElementById(`content-${id}`);
                if (content && content.style.display === 'none') {
                    this.refreshBlockSummaryUI(id, true);
                }
            });
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                if (!isModifierPressed) {
                    isModifierPressed = true;
                    FiltersManager.updateMenuHotkeysLayout(isModifierPressed);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                if (isModifierPressed) {
                    isModifierPressed = false;
                    FiltersManager.updateMenuHotkeysLayout(isModifierPressed);
                }
            }
        });

        document.getElementById('btn-sort-incPaths')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('incPaths'));
        document.getElementById('btn-sort-excPaths')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('excPaths'));
        document.getElementById('btn-sort-incExts')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('incExts'));
        document.getElementById('btn-sort-excExts')?.addEventListener('click', () => FiltersManager.sortTextAreaLines('excExts'));

        document.getElementById('btn-explode-incExts')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('incExts'));
        document.getElementById('btn-explode-incPaths')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('incPaths'));
        document.getElementById('btn-explode-excPaths')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('excPaths'));
        document.getElementById('btn-explode-excExts')?.addEventListener('click', () => FiltersManager.explodeTextAreaRegex('excExts'));

        document.getElementById('btn-clear-incPaths')?.addEventListener('click', () => FiltersManager.clearTextArea('incPaths'));
        document.getElementById('btn-clear-excPaths')?.addEventListener('click', () => FiltersManager.clearTextArea('excPaths'));
        document.getElementById('btn-clear-incExts')?.addEventListener('click', () => FiltersManager.clearTextArea('incExts'));
        document.getElementById('btn-clear-excExts')?.addEventListener('click', () => FiltersManager.clearTextArea('excExts'));

        document.getElementById('btn-group-incExts')?.addEventListener('click', () => FiltersManager.groupTextAreaExtensions('incExts'));
        document.getElementById('btn-group-excExts')?.addEventListener('click', () => FiltersManager.groupTextAreaExtensions('excExts'));

        document.getElementById('btn-predefined-inclusions')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('predefined-inclusions-menu');
            if (menu) {
                const isOpening = menu.style.display !== 'block';
                if (isOpening) {
                    FiltersManager.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
                    menu.style.display = 'block';
                } else {
                    menu.style.display = 'none';
                }
            }
        });

        document.getElementById('btn-predefined-exclusions')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('predefined-exclusions-menu');
            if (menu) {
                const isOpening = menu.style.display !== 'block';
                if (isOpening) {
                    FiltersManager.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);
                    menu.style.display = 'block';
                } else {
                    menu.style.display = 'none';
                }
            }
        });

        document.addEventListener('click', () => {
            const incMenu = document.getElementById('predefined-inclusions-menu');
            const excMenu = document.getElementById('predefined-exclusions-menu');
            if (incMenu) incMenu.style.display = 'none';
            if (excMenu) excMenu.style.display = 'none';
        });

        document.getElementById('btn-toggle-history-view')?.addEventListener('click', () => {
            state.historyViewMode = state.historyViewMode === 'scope-current-repo' ? 'scope-all-repo' : 'scope-current-repo';
            HistoryManager.updateHistoryViewToggleButton();
            HistoryManager.updateHistoryCombo(state.currentSelectedId);
            bridge.postMessage('updateHistoryViewMode', { mode: state.historyViewMode });
        });

        document.getElementById('historyCombo')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (!val || state.isInitializing) return;
            state.currentSelectedId = val;
            HistoryManager.applyHistorySelection(val);
            UIController.syncButtonsState(val);
            ValidatorService.clearAllValidationStyles();
            UIController.checkSyncStatus();
            setTimeout(window.forceGlobalSummariesUpdate, 60);
        });

        document.getElementById('btn-freeze-history')?.addEventListener('click', () => {
            if (state.currentSelectedId && state.currentSelectedId !== 'default') {
                const entry = state.historyList.find(h => h.id === state.currentSelectedId);
                if (entry) bridge.postMessage('toggleFreezeHistory', { id: state.currentSelectedId, frozen: !entry.frozen });
            }
        });

        document.getElementById('btn-reset-config')?.addEventListener('click', () => {
            HistoryManager.resetCurrentConfigFields();
            setTimeout(window.forceGlobalSummariesUpdate, 20);
        });

        document.getElementById('btn-edit-history')?.addEventListener('click', HistoryManager.enterInlineRenameMode);

        document.getElementById('historyRenameInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = e.target.value.trim();
                if (val && state.currentSelectedId && state.currentSelectedId !== 'default') {
                    bridge.postMessage('editHistoryName', { id: state.currentSelectedId, newName: val });
                }
                HistoryManager.cancelInlineHistoryRename();
            } else if (e.key === 'Escape') {
                HistoryManager.cancelInlineHistoryRename();
            }
        });

        document.getElementById('historyRenameInput')?.addEventListener('blur', () => {
            setTimeout(() => { HistoryManager.cancelInlineHistoryRename(); }, 180);
        });

        document.getElementById('btn-duplicate-history')?.addEventListener('click', () => {
            const getVal = (id) => document.getElementById(id)?.value || '';
            const getCheck = (id) => !!document.getElementById(id)?.checked;
            const pathsStr = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p).join(', ');

            const screenConfig = {
                src: pathsStr, dest: getVal('destDir'), format: getVal('format'),
                max_file: getVal('maxFile'), max_chunk: getVal('maxChunk'),
                groupByExt: getCheck('splitChunkByFileExtension'),
                copyGeneratedFilesToClipboard: getCheck('copyGeneratedFilesToClipboard'),
                generateTreeView: getCheck('generateTreeView'),
                logConsole: getCheck('generateLogConsole'), logFile: getCheck('generateLogFile'),
                inc_paths: getVal('incPaths'), exc_paths: getVal('excPaths'),
                inc_ext: getVal('incExts'), exc_ext: getVal('excExts')
            };

            let customDisplayName = null;
            if (state.currentSelectedId && state.currentSelectedId !== 'default') {
                const selectedEntry = state.historyList.find(h => h.id === state.currentSelectedId);
                if (selectedEntry) customDisplayName = `${selectedEntry.display} - copy`;
            }

            bridge.postMessage('addNewConfigProfile', { duplicateConfig: screenConfig, customName: customDisplayName });
        });

        document.getElementById('btn-add-history')?.addEventListener('click', () => bridge.postMessage('addNewConfigProfile'));
        document.getElementById('btn-open-history-file')?.addEventListener('click', () => bridge.postMessage('openHistoryInVSCode'));
        document.getElementById('btn-reveal-history-folder')?.addEventListener('click', () => bridge.postMessage('revealHistoryInOS'));
        document.getElementById('btn-clear-history')?.addEventListener('click', () => bridge.postMessage('clearHistory', { selectedId: state.currentSelectedId }));

        document.getElementById('btn-clear-paths')?.addEventListener('click', () => {
            SourcePathsManager.clearPaths();
            setTimeout(window.forceGlobalSummariesUpdate, 20);
        });
        document.getElementById('btn-add-open-files')?.addEventListener('click', SourcePathsManager.addOpenFiles);
        document.getElementById('btn-add-git-diff')?.addEventListener('click', SourcePathsManager.addGitDiffFiles);

        const pathListTextArea = document.getElementById('pathList');
        if (pathListTextArea) {
            const targetTextarea = pathListTextArea.shadowRoot?.querySelector('textarea') || pathListTextArea;
            targetTextarea.addEventListener('blur', SourcePathsManager.saveActiveTextareaCursorIndex);
            targetTextarea.addEventListener('keyup', SourcePathsManager.saveActiveTextareaCursorIndex);
            targetTextarea.addEventListener('click', SourcePathsManager.saveActiveTextareaCursorIndex);
        }

        document.getElementById('btn-open-cursor-line')?.addEventListener('click', SourcePathsManager.openPathAtCursor);
        document.getElementById('btn-run')?.addEventListener('click', () => ExportManager.runExport());

        document.getElementById('btn-copy-cmd')?.addEventListener('click', () => tabs.terminalTab?.copyCommand());
        document.getElementById('btn-copy-latest-files')?.addEventListener('click', DestinationManager.copyLatestExportedFiles);
        document.getElementById('btn-open-finder-dest')?.addEventListener('click', DestinationManager.openFinder);
        document.getElementById('btn-clear-dest')?.addEventListener('click', DestinationManager.clearDestDirectory);

        document.getElementById('btn-filter-files')?.addEventListener('click', () => {
            if (!state.lastGeneratedFilesPayload) return;
            bridge.postMessage('applyFileFilter', {
                data: {
                    fileNameRegex: document.getElementById('filterFileName').value,
                    fileContentRegex: document.getElementById('filterFileContent').value,
                    destDir: document.getElementById('destDir').value,
                    files: state.lastGeneratedFilesPayload.exports || []
                }
            });
        });

        document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
            if (document.getElementById('filterFileName')) document.getElementById('filterFileName').value = '';
            if (document.getElementById('filterFileContent')) document.getElementById('filterFileContent').value = '';
            if (state.lastGeneratedFilesPayload && tabs.filesTab) {
                tabs.filesTab.render(
                    state.lastGeneratedFilesPayload,
                    document.getElementById('destDir').value,
                    (p) => bridge.postMessage('openFile', {path:p}),
                    (p) => bridge.postMessage('openFinder', {path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            }
            if (state.lastReportPayload && tabs.treeViewTab) {
                tabs.treeViewTab.render(state.lastReportPayload, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
            }
        });

        // Add validation triggers to web components inputs elements
        const observedFields = ['pathList', 'destDir', 'maxFile', 'maxChunk', 'incPaths', 'excPaths', 'incExts', 'excExts', 'format', 'splitChunkByFileExtension', 'copyGeneratedFilesToClipboard', 'generateTreeView', 'generateLogConsole', 'generateLogFile'];
        observedFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('blur', () => {
                    ValidatorService.executeFieldValidation(id);
                    UIController.checkSyncStatus();
                    window.forceGlobalSummariesUpdate();
                });
                el.addEventListener('input', () => {
                    ValidatorService.executeFieldValidation(id);
                    UIController.checkSyncStatus();
                    window.forceGlobalSummariesUpdate();
                });
                el.addEventListener('change', () => {
                    window.forceGlobalSummariesUpdate();
                });
            }
        });

        // Initialize synchronized textareas dimensional heights
        this.setupTextAreaSync();

        this.setupFilterSimulator();

        bridge.postMessage('webviewReady');
    },

    handleMessage(message, tabs) {
        switch (message.command) {
            case 'excludeExplorerPathSelection': HandlerManager.handleExcludeExplorerPathSelection(message, tabs); break;
            case 'checkPathsResult': HandlerManager.handleCheckPathsResult(message, tabs); break;
            case 'updatePaths': HandlerManager.handleUpdatePaths(message, tabs); break;
            case 'initSettings':
                HandlerManager.handleInitSettings(message, tabs, isModifierPressed);
                setTimeout(() => { if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate(); }, 120);
                break;
            case 'updateFileExtsCategoryGroups': HandlerManager.handleUpdateFileExtsCategoryGroups(message, tabs, isModifierPressed); break;
            case 'updateHistory': HandlerManager.handleUpdateHistory(message, tabs); break;
            case 'terminalLog': HandlerManager.handleTerminalLog(message, tabs); break;
            case 'updateCommand': HandlerManager.handleUpdateCommand(message, tabs); break;
            case 'updateExportReport': HandlerManager.handleUpdateExportReport(message, tabs); break;
            case 'filteredFilesResult': HandlerManager.handleFilteredFilesResult(message, tabs); break;
            case 'showRichNotification': HandlerManager.handleShowRichNotification(message); break;
            case 'simulateFiltersResult':
                import('../services/filters-simulator.js').then(module => {
                    module.FiltersSimulator.updateEmojiResult(message.code);
                });
                break;
        }
    }
};
