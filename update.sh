#!/usr/bin/env bash
set -euo pipefail

echo -e "================================================================="
echo -e "⚡ MONOLITHIC ONE-SHOT ARCHITECTURAL RECOVERY & REFACTORING"
echo -e "================================================================="

if [ ! -f "package.json" ]; then
    echo -e "[\e[31mERREUR\e[0m] Exécutez ce script à la racine de votre projet (workspace VS Code)."
    exit 1
fi

SVC_DIR="src/webview/js/services"
CORE_DIR="src/webview/js/core"
HTML_FILE="src/webview/webview.html"
SUMMARY_BUILDER_FILE="${SVC_DIR}/block-summary-builder.js"
INIT_MANAGER_FILE="${CORE_DIR}/initialization.manager.js"
HANDLER_MANAGER_FILE="${SVC_DIR}/handler-manager.js"

mkdir -p "$SVC_DIR"
mkdir -p "$CORE_DIR"

# -----------------------------------------------------------------
# 1. GENERATION DE L'ARCHITECTURE FRONTEND: TEMPLATE MASTER (webview.html)
# -----------------------------------------------------------------
echo -e "[\e[34mINFO\e[0m] Ériture du Master Layout avec Tooltips persistants..."

cat << 'EOF_FINAL_HTML' > "$HTML_FILE"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Files Exporter</title>
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src vscode-webview-resource: https: data:; font-src https://cdn.jsdelivr.net vscode-webview-resource:; style-src 'unsafe-inline' https://cdn.jsdelivr.net vscode-webview-resource:; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net vscode-webview-resource:;">
    <link href="https://cdn.jsdelivr.net/npm/@vscode/codicons/dist/codicon.css" rel="stylesheet">
    <script type="module" src="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit@latest/dist/toolkit.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
        .grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .full-width { width: 100%; }
        .paths-list { background: var(--vscode-input-background); padding: 10px; border: 1px solid var(--vscode-input-border); border-radius: 3px; max-height: 150px; overflow-y: auto; font-family: var(--vscode-editor-font-family); font-size: 12px;}
        .terminal { background: #1e1e1e; color: #d4d4d4; padding: 10px; font-family: 'Menlo', monospace; font-size: 12px; height: 100%; overflow-y: auto; border-radius: 4px; }
        .terminal-container { display: flex; flex-direction: column; flex-grow: 1; height: 100%; }
        .chart-container { position: relative; height: 300px; width: 100%; margin-top: 20px; }
        .selected-row { background-color: var(--vscode-list-activeSelectionBackground) !important; color: var(--vscode-list-activeSelectionForeground) !important; }
        #terminal-cmd, #terminal-cmd::part(control) { color: #d4d4d4 !important; --text-color: #d4d4d4 !important; --input-text-color: #d4d4d4 !important; }
        th { cursor: pointer; }

        #exportedFilesList { resize: vertical; overflow: auto; min-height: 80px; max-height: 400px; }
        .field-label { display: inline-block; margin-bottom: 4px; }

        .history-actions-container { display: flex; gap: 5px; align-items: center; width: 100%; }
        .icon-btn, .history-actions-container vscode-button { width: 26px !important; height: 26px !important; min-width: 26px !important; padding: 0px !important; --button-padding-horizontal: 0px !important; --button-padding-vertical: 0px !important; }

        .vertical-divider { width: 1px; height: 18px; background-color: var(--vscode-panel-border); margin: 0 3px; flex-shrink: 0; }
        #btn-copy-cmd { color: var(--vscode-button-foreground, #ffffff) !important; }

        .tree-folder > .tree-children { display: none; padding-left: 14px; border-left: 1px solid var(--vscode-panel-border); margin-left: 5px; margin-top: 2px;}
        .tree-folder.expanded > .tree-children { display: block; }
        .tree-folder-header { cursor: pointer; display: flex; align-items: center; padding: 2px 0; }
        .tree-folder-header:hover { background-color: var(--vscode-list-hoverBackground); }
        .tree-toggle { display: inline-block; width: 14px; font-size: 10px; text-align: center; margin-right: 4px; color: var(--vscode-icon-foreground); transition: transform 0.15s ease;}
        .tree-folder.expanded > .tree-folder-header .tree-toggle { transform: rotate(90deg); }
        .tree-item { display: flex; align-items: center; padding: 2px 0; padding-left: 14px; }
        .tree-item:hover { background-color: var(--vscode-list-hoverBackground); }
        .tree-icon { margin-right: 4px; font-size: 14px; }

        #treeSearchInput { max-width: 250px !important; width: 250px !important; }

        .tree-cb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border: 1px solid var(--vscode-checkbox-border, #858585);
            background-color: var(--vscode-input-background, #ffffff);
            border-radius: 3px;
            margin: 0 6px 0 0;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-sizing: border-box;
            vertical-align: middle;
        }

        .tree-cb:checked, .tree-cb.is-indeterminate {
            background-color: var(--vscode-checkbox-background, #007fd4);
            border-color: var(--vscode-checkbox-selectBorder, var(--vscode-checkbox-background), #007fd4);
        }

        .tree-cb:checked::after {
            content: '';
            width: 3px;
            height: 6px;
            border: solid var(--vscode-checkbox-foreground, #ffffff);
            border-width: 0 2px 2px 0;
            transform: translate(-50%, -60%) rotate(45deg);
            position: absolute;
            top: 50%;
            left: 50%;
        }

        .tree-cb.is-indeterminate::after {
            content: '';
            width: 8px;
            height: 2px;
            background-color: var(--vscode-checkbox-foreground, #ffffff);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }

        #global-cursor-tooltip { position: fixed; background-color: #000000; color: #ffffff; border: 1px solid #454545; box-shadow: 0px 5px 12px rgba(0, 0, 0, 0.6); padding: 6px 10px; border-radius: 4px; font-family: var(--vscode-font-family, sans-serif); font-size: 11px; font-weight: normal; z-index: 999999; pointer-events: none; display: none; width: max-content; max-width: 200px; white-space: normal; word-wrap: break-word; height: auto; }

        .btn-run-custom {
            background: linear-gradient(135deg, var(--vscode-button-background), #6b21a8);
            color: var(--vscode-button-foreground);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 12px 20px;
            font-size: 14px;
            font-family: var(--vscode-font-family);
            font-weight: 600;
            letter-spacing: 1px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .btn-run-custom:hover {
            background: linear-gradient(135deg, var(--vscode-button-hoverBackground), #9333ea);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
            transform: translateY(-1px);
        }
        .btn-run-custom:active {
            transform: translateY(1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .btn-run-custom.loading {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
            border: 1px solid var(--vscode-panel-border);
        }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin-anim { animation: spin 1s linear infinite; display: inline-block; }

        vscode-panels {
           margin-top: 10px;
           min-height: 500px;
           border-top: 1px solid var(--vscode-panel-border);
           padding-top: 0px;
        }

        .filter-actions-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        .filter-btn-group {
            display: flex;
            gap: 2px;
            align-items: center;
        }

        /* Classes unifiées pour les structures de blocs rétractables */
        .collapsible-block-header {
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
            box-shadow: 0px 4px 5px -3px rgba(0, 0, 0, 0.25);
        }
        .collapsible-title-group {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .collapsible-summary-text {
            font-size: 11px;
            font-weight: normal;
            color: var(--vscode-descriptionForeground, #858585);
            font-style: italic;
            padding-left: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 65%;
        }
        .collapsible-block-content {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <input type="hidden" id="hiddenPathListCursorIndex" value="0" />

    <div class="collapsible-block" id="block-history">
        <div class="collapsible-block-header tooltip-bottom" data-tooltip="History profile logs containing previously saved and automated configuration entries parameters values.">
            <div class="collapsible-title-group">
                <span class="codicon codicon-chevron-down" id="icon-block-history"></span>
                <span>🕒 Configuration History</span>
            </div>
            <span class="collapsible-summary-text" id="summary-block-history"></span>
        </div>
        <div class="collapsible-block-content" id="content-block-history">
            <div class="history-actions-container">
                <vscode-button id="btn-toggle-history-view" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Toggle history scope: Current Repo (🏠) / All Repos (🌐)">🏠</vscode-button>
                <vscode-dropdown id="historyCombo" style="flex-grow: 1;"></vscode-dropdown>
                <vscode-text-field id="historyRenameInput" style="display: none; flex-grow: 1;" placeholder="Enter profile name display identifier..." data-tooltip="Press 'Enter' to confirm or 'Escape' to cancel layout edits"></vscode-text-field>
                <vscode-button id="btn-freeze-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Freeze or unfreeze profile. Unfreezing allows overwriting and re-naming configurations" disabled><span class="codicon codicon-unlock"></span></vscode-button>
                <vscode-button id="btn-reset-config" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Reset configuration to last saved values." disabled><span class="codicon codicon-debug-restart"></span></vscode-button>
                <vscode-button id="btn-edit-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Rename the selected profile item display name" disabled><span class="codicon codicon-edit"></span></vscode-button>
                <vscode-button id="btn-duplicate-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Duplicate current screen configuration elements parameters values"><span class="codicon codicon-files"></span></vscode-button>
                <vscode-button id="btn-add-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Create a new fresh profile configuration from default settings"><span class="codicon codicon-add"></span></vscode-button>
                <div class="vertical-divider"></div>
                <vscode-button id="btn-open-history-file" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Open history log file config directly in VS Code"><span class="codicon codicon-file"></span></vscode-button>
                <vscode-button id="btn-reveal-history-folder" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Reveal the physical history log file database in OS Finder / Explorer"><span class="codicon codicon-folder-opened"></span></vscode-button>
                <vscode-button id="btn-clear-history" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Remove items or clear all saved configuration history entries"><span class="codicon codicon-trash"></span></vscode-button>
            </div>
        </div>
    </div>

    <div class="collapsible-block" id="block-sourcepaths">
        <div class="collapsible-block-header tooltip-bottom" data-tooltip="Absolute directory or single files locations targeted for aggregation and token estimation context.">
            <div class="collapsible-title-group">
                <span class="codicon codicon-chevron-down" id="icon-block-sourcepaths"></span>
                <span>📁 Source Paths</span>
            </div>
            <span class="collapsible-summary-text" id="summary-block-sourcepaths"></span>
        </div>
        <div class="collapsible-block-content" id="content-block-sourcepaths">
            <div style="display: flex; gap: 5px; align-items: center;">
                <vscode-text-area id="pathList" rows="4" resize="vertical" placeholder="Enter source paths (one per line)" style="flex-grow: 1; width: 100%;"></vscode-text-area>
                <vscode-button id="btn-add-open-files" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Add all currently open files to source path selection"><span class="codicon-go-to-file codicon"></span></vscode-button>
                <vscode-button id="btn-add-git-diff" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Identify and add files changed with git diff to source path selection"><span class="codicon codicon-git-compare"></span></vscode-button>
                <vscode-button id="btn-open-cursor-line" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Open path defined by current text cursor line index selection context"><span class="codicon codicon-link-external"></span></vscode-button>
                <vscode-button id="btn-clear-paths" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Clear current source paths selection"><span class="codicon-clear-all codicon"></span></vscode-button>
            </div>
        </div>
    </div>

    <div class="collapsible-block" id="block-filters">
        <div class="collapsible-block-header tooltip-bottom" data-tooltip="Regular Expression masks defining targeted directories and source formatting inclusions or exclusions lists.">
            <div class="collapsible-title-group">
                <span class="codicon codicon-chevron-down" id="icon-block-filters"></span>
                <span>🔍 Filters & Scope Constraints</span>
            </div>
            <span class="collapsible-summary-text" id="summary-block-filters"></span>
        </div>
        <div class="collapsible-block-content" id="content-block-filters">
            <div id="source-paths-filters" style="display: flex; gap: 15px; width: 100%;">
                <div>
                    <span class="field-label" data-tooltip="Max authorized physical size for a single file in Kilobytes. Larger files are skipped.">🏋️ Max File (KB)</span><br />
                    <vscode-text-field id="maxFile" value="50" style="width: 110px;"></vscode-text-field>
                </div>
                <div style="flex-grow:1;">
                    <div class="filter-actions-header">
                        <span class="field-label" data-tooltip="Regex mapping specifying inside-folder structures to explicitly allow.">✅ Include Paths</span>
                        <div class="filter-btn-group">
                            <vscode-button id="btn-sort-incPaths" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Sort contents alphabetically" data-dir="asc"><span class="codicon codicon-arrow-down"></span></vscode-button>
                            <vscode-button id="btn-explode-incPaths" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Explode unified expressions block layout to individual lines components"><span class="codicon codicon-unfold"></span></vscode-button>
                        </div>
                    </div>
                    <vscode-text-area id="incPaths" class="full-width" rows="4" resize="vertical"></vscode-text-area>
                </div>
                <div style="flex-grow:1; position: relative;">
                    <div class="filter-actions-header">
                        <span class="field-label" data-tooltip="Regex checklist specifying file extensions to let through during discovery.">🟢 Include exts</span>
                        <div class="filter-btn-group">
                            <vscode-button id="btn-sort-incExts" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Sort contents alphabetically" data-dir="asc"><span class="codicon codicon-arrow-down"></span></vscode-button>
                            <vscode-button id="btn-group-incExts" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Group extensions by category categories structure"><span class="codicon codicon-library"></span></vscode-button>
                            <vscode-button id="btn-explode-incExts" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Explode unified expressions block layout to individual lines components"><span class="codicon codicon-unfold"></span></vscode-button>
                            <vscode-button id="btn-predefined-inclusions" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Predefined extension inclusions."><span class="codicon codicon-kebab-vertical"></span></vscode-button>
                        </div>
                    </div>
                    <div id="predefined-inclusions-menu" style="display: none; position: absolute; top: 24px; right: 0; background: var(--vscode-dropdown-background, #252526); border: 1px solid var(--vscode-dropdown-border, #3c3c3c); border-radius: 3px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); z-index: 1000; min-width: 160px;"></div>
                    <vscode-text-area id="incExts" class="full-width" rows="4" resize="vertical"></vscode-text-area>
                </div>
                <div style="flex-grow:1;">
                    <div class="filter-actions-header">
                        <span class="field-label" data-tooltip="Regex blacklisting targeted folder structures (e.g. node_modules, .git) to skip.">🚫 Exclude Paths</span>
                        <div class="filter-btn-group">
                            <vscode-button id="btn-sort-excPaths" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Sort contents alphabetically" data-dir="asc"><span class="codicon codicon-arrow-down"></span></vscode-button>
                            <vscode-button id="btn-explode-excPaths" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Explode unified expressions block layout to individual lines components"><span class="codicon codicon-unfold"></span></vscode-button>
                        </div>
                    </div>
                    <vscode-text-area id="excPaths" class="full-width" rows="4" resize="vertical"></vscode-text-area>
                </div>
                <div style="flex-grow:1; position: relative;">
                    <div class="filter-actions-header">
                        <span class="field-label" data-tooltip="Regex mapping identifying forbidden raw formats (e.g. log, exe, png) to skip.">🔴 Exclude exts</span>
                        <div class="filter-btn-group">
                            <vscode-button id="btn-sort-excExts" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Sort contents alphabetically" data-dir="asc"><span class="codicon codicon-arrow-down"></span></vscode-button>
                            <vscode-button id="btn-group-excExts" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Group extensions by category categories structure"><span class="codicon codicon-library"></span></vscode-button>
                            <vscode-button id="btn-explode-excExts" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Explode unified expressions block layout to individual lines components"><span class="codicon codicon-unfold"></span></vscode-button>
                            <vscode-button id="btn-predefined-exclusions" appearance="icon" style="height: 18px; width: 18px;" data-tooltip="Predefined extension exclusions."><span class="codicon codicon-kebab-vertical"></span></vscode-button>
                        </div>
                    </div>
                    <div id="predefined-exclusions-menu" style="display: none; position: absolute; top: 24px; right: 0; background: var(--vscode-dropdown-background, #252526); border: 1px solid var(--vscode-dropdown-border, #3c3c3c); border-radius: 3px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); z-index: 1000; min-width: 160px;"></div>
                    <vscode-text-area id="excExts" class="full-width" rows="4" resize="vertical"></vscode-text-area>
                </div>
            </div>
        </div>
    </div>

    <div class="collapsible-block" id="block-destination">
        <div class="collapsible-block-header tooltip-bottom" data-tooltip="Absolute distribution path folder location where structured files will be generated.">
            <div class="collapsible-title-group">
                <span class="codicon codicon-chevron-down" id="icon-block-destination"></span>
                <span>💾 Destination Directory</span>
            </div>
            <span class="collapsible-summary-text" id="summary-block-destination"></span>
        </div>
        <div class="collapsible-block-content" id="content-block-destination">
            <div style="display: flex; gap: 5px; align-items: center;">
                <vscode-text-field id="destDir" class="full-width" placeholder="/absolute/path/to/output"></vscode-text-field>
                <vscode-button id="btn-copy-latest-files" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Copy last exported files to OS clipboard"><span class="codicon codicon-clippy"></span></vscode-button>
                <vscode-button id="btn-open-finder-dest" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Open destination directory in OS Finder / Explorer"><span class="codicon codicon-folder-opened"></span></vscode-button>
                <vscode-button id="btn-clear-dest" appearance="secondary" class="tooltip-right icon-btn" data-tooltip="Clean destination directory content"><span class="codicon codicon-trash"></span></vscode-button>
            </div>
        </div>
    </div>

    <div class="collapsible-block" id="block-options">
        <div class="collapsible-block-header tooltip-bottom" data-tooltip="Aggregated output payload formats schemas, text partitions thresholds, chunk splits and logging rules.">
            <div class="collapsible-title-group">
                <span class="codicon codicon-chevron-down" id="icon-block-options"></span>
                <span>⚙️ Output Formatting & Rules</span>
            </div>
            <span class="collapsible-summary-text" id="summary-block-options"></span>
        </div>
        <div class="collapsible-block-content" id="content-block-options">
            <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; align-items: end; margin-bottom: 10px;">
                <div style="margin-bottom: 1px;">
                    <span class="field-label" data-tooltip="Structured file format schema template applied to aggregate the files contents.">Output Format</span>
                    <vscode-dropdown id="format" class="full-width">
                        <vscode-option value="yaml">YAML</vscode-option>
                        <vscode-option value="json">JSON</vscode-option>
                        <vscode-option value="xml">XML</vscode-option>
                        <vscode-option value="toml">TOML</vscode-option>
                        <vscode-option value="txt">TXT</vscode-option>
                    </vscode-dropdown>
                </div>
                <div>
                    <span class="field-label" data-tooltip="Maximum payload slice limit for chunk splitting in Kilobytes (0 means unlimitted size).">Max Chunk (KB)</span>
                    <vscode-text-field id="maxChunk" class="full-width" value="0"></vscode-text-field>
                </div>
                <div style="margin-bottom: 2px;">
                    <vscode-checkbox id="splitChunkByFileExtension" data-tooltip="Force the export runner to partition output chunks whenever a change of file extension occurs.">Split&nbsp;by&nbsp;ext</vscode-checkbox>
                </div>
                <div style="margin-bottom: 2px;">
                    <vscode-checkbox id="copyGeneratedFilesToClipboard" data-tooltip="Automatically copy generated export files to the OS clipboard after each successful run.">Copy&nbsp;to&nbsp;clip</vscode-checkbox>
                </div>
                <div style="margin-bottom: 2px;">
                    <vscode-checkbox id="generateTreeView" data-tooltip="Instruct the backend engine to build an isolated hierarchical JSON manifest describing all processed source components." checked>Tree&nbsp;View</vscode-checkbox>
                </div>
                <div style="margin-bottom: 5px;">
                    <vscode-checkbox id="generateLogConsole" data-tooltip="Enable standard output logging directly streaming into this extension terminal window view.">Log&nbsp;Console</vscode-checkbox>
                </div>
                <div style="margin-bottom: 5px;">
                    <vscode-checkbox id="generateLogFile" data-tooltip="Instruct the exporter engine to save a physical log tracing history report in the destination directory.">Log&nbsp;File</vscode-checkbox>
                </div>
            </div>
        </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; margin: 10px 0;">
        <button id="btn-run" class="btn-run-custom" style="width: 180px; flex-shrink: 0;">
            <span class="codicon codicon-play"></span> RUN EXPORT
        </button>
        <div id="exchange-buttons-container" style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;"></div>
    </div>

    <vscode-panels>
        <vscode-panel-tab id="tab-report">REPORT</vscode-panel-tab>
        <vscode-panel-tab id="tab-files">FILES</vscode-panel-tab>
        <vscode-panel-tab id="tab-tree">TREE VIEW</vscode-panel-tab>
        <vscode-panel-tab id="tab-terminal">TERMINAL</vscode-panel-tab>
        <vscode-panel-tab id="tab-help">HELP</vscode-panel-tab>

        <vscode-panel-view id="view-report">
            <div style="width: 100%; display: flex; flex-direction: column; gap: 0px;">
                <div class="collapsible-block" id="costEstimationSection" style="display: none; margin-bottom: 15px; width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-right" id="icon-costEstimationSection"></span>
                            <span id="costEstimationTitle">💰 Cost Estimation (0 tokens)</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-costEstimationSection"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-costEstimationSection" style="display: none; padding-top: 10px;">
                        <table id="pricingTable" style="width: 100%; border-collapse: collapse; font-family: var(--vscode-editor-font-family); font-size: 12px; border: 1px solid var(--vscode-panel-border);">
                            <thead>
                                <tr style="background: var(--vscode-sideBar-background); color: #00bcd4; text-align: left;">
                                    <th style="padding: 8px; border: 1px solid var(--vscode-panel-border);">LLM</th>
                                    <th style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Model</th>
                                    <th id="th-cost-tokens" style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Cost</th>
                                </tr>
                            </thead>
                            <tbody id="pricingTableBody"></tbody>
                        </table>
                    </div>
                </div>

                <div class="collapsible-block" id="reportTableSection" style="display: none; margin-bottom: 15px; width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-reportTableSection"></span>
                            <span>📊 Export Report (by Extension)</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-reportTableSection"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-reportTableSection" style="padding-top: 10px;">
                        <table id="reportTable" style="width: 100%; border-collapse: collapse; font-family: var(--vscode-editor-font-family); font-size: 12px; border: 1px solid var(--vscode-panel-border);">
                            <thead>
                                <tr style="background: var(--vscode-sideBar-background); color: #00bcd4; text-align: left;">
                                    <th id="th-ext" style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Extension ↕</th>
                                    <th id="th-exported" style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Exported ↕</th>
                                    <th id="th-rejected" style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Size Rejected ↕</th>
                                    <th id="th-excluded" style="padding: 8px; border: 1px solid var(--vscode-panel-border);">Excluded ↕</th>
                                </tr>
                            </thead>
                            <tbody id="reportTableBody"></tbody>
                            <tfoot id="reportTableFooter"></tfoot>
                        </table>
                    </div>
                </div>

                <div class="collapsible-block" id="reportGraphSection" style="display: none; margin-bottom: 15px; width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-reportGraphSection"></span>
                            <span>🥧 Distribution (Pie Chart)</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-reportGraphSection"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-reportGraphSection" style="padding-top: 10px;">
                        <div class="chart-container"><canvas id="reportChart"></canvas></div>
                    </div>
                </div>
            </div>
        </vscode-panel-view>

        <vscode-panel-view id="view-files">
            <div style="width: 100%; display: flex; flex-direction: column; gap: 0px;">
                <div class="collapsible-block" id="section-exported-files" style="width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-section-exported-files"></span>
                            <span id="exportedFilesTitle">📂 Exported Files</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-section-exported-files"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-section-exported-files" style="padding-top: 5px;">
                        <div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 10px; width: 100%;">
                            <div style="flex-grow: 1;">
                                <span class="field-label">File Name</span>
                                <vscode-text-field id="filterFileName" placeholder="Regex pattern" class="full-width"></vscode-text-field>
                            </div>
                            <div style="flex-grow: 1;">
                                <span class="field-label">File Content</span>
                                <vscode-text-field id="filterFileContent" placeholder="Regex pattern" class="full-width"></vscode-text-field>
                            </div>
                            <vscode-button id="btn-filter-files" appearance="primary">Filter</vscode-button>
                            <vscode-button id="btn-reset-filter" appearance="secondary"><span class="codicon codicon-debug-restart"></span></vscode-button>
                        </div>
                        <div id="exportedFilesList" class="paths-list" style="margin-bottom: 15px;"></div>
                    </div>
                </div>

                <div class="collapsible-block" id="section-logs-block" style="width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-section-logs-block"></span>
                            <span>📝 Logs</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-section-logs-block"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-section-logs-block">
                        <div id="logsList" class="paths-list" style="max-height: 100px;"></div>
                    </div>
                </div>

                <div class="collapsible-block" id="section-reports-block" style="width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-section-reports-block"></span>
                            <span>📑 Reports</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-section-reports-block"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-section-reports-block">
                        <div id="reportsList" class="paths-list" style="max-height: 100px;"></div>
                    </div>
                </div>
            </div>
        </vscode-panel-view>

        <vscode-panel-view id="view-tree">
            <div style="width: 100%; display: flex; flex-direction: column; gap: 0px;">
                <div class="collapsible-block" id="section-tree-explorer" style="width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-section-tree-explorer"></span>
                            <span>🪾 Exported Source Files Explorer</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-section-tree-explorer"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-section-tree-explorer" style="padding-top: 5px;">
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
                            <vscode-button id="btnTreeToggleMode" appearance="icon" class="tooltip-bottom icon-btn" data-tooltip="Toggle structure mapping mode"><span class="codicon-list-flat codicon"></span></vscode-button>
                            <vscode-text-field id="treeSearchInput" placeholder="Search files/extensions..." style="flex-grow: 1;"></vscode-text-field>
                            <vscode-checkbox id="cbTreeRegexp">.*</vscode-checkbox>
                            <vscode-button id="btnTreeClearSearch" appearance="icon" class="tooltip-bottom icon-btn"><span class="codicon-clear-all codicon"></span></vscode-button>
                            <vscode-button id="btnTreeExpandAll" appearance="icon" class="tooltip-bottom icon-btn"><span class="codicon codicon-expand-all"></span></vscode-button>
                            <vscode-button id="btnTreeCollapseAll" appearance="icon" class="tooltip-bottom icon-btn"><span class="codicon-collapse-all codicon"></span></vscode-button>
                            <vscode-button id="btnTreeExport" appearance="icon" class="tooltip-left icon-btn"><span class="codicon codicon-export"></span></vscode-button>
                        </div>
                        <div id="view-tree-content" style="overflow-y: auto; max-height: 400px; font-family: var(--vscode-editor-font-family); font-size: 13px;"></div>
                    </div>
                </div>
            </div>
        </vscode-panel-view>

        <vscode-panel-view id="view-terminal">
            <div class="terminal-container" style="width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0px;">
                <div class="collapsible-block" id="section-terminal-cmd" style="width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-section-terminal-cmd"></span>
                            <span>⚙️ Bash command run by the tool</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-section-terminal-cmd"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-section-terminal-cmd" style="padding-top: 5px;">
                        <div style="display: flex; flex-direction: row; align-items: flex-start; background: #1e1e1e; padding: 4px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); box-sizing: border-box; width: 100%; margin-bottom: 15px;">
                            <vscode-text-area id="terminal-cmd" rows="4" resize="vertical" readonly style="flex-grow: 1; font-family: var(--vscode-editor-font-family, 'Menlo', monospace); font-size: 11px; margin: 0; --background-color: #1e1e1e; --input-background: #1e1e1e; --border-width: 0;"></vscode-text-area>
                            <div style="background: #1e1e1e; display: flex; align-items: flex-start; justify-content: center; padding: 4px 8px 0 4px;"><vscode-button id="btn-copy-cmd" appearance="icon" class="tooltip-right icon-btn"><span class="codicon codicon-copy"></span></vscode-button></div>
                        </div>
                    </div>
                </div>

                <div class="collapsible-block" id="section-terminal-logs" style="width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-section-terminal-logs"></span>
                            <span>🐍 Python script Logs</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-section-terminal-logs"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-section-terminal-logs" style="padding-top: 5px;">
                        <div class="terminal" id="terminal" style="width: 100%; box-sizing: border-box; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; border: 1px solid var(--vscode-panel-border); padding: 12px; min-height: 150px; height: 240px; resize: vertical; overflow: auto; font-family: var(--vscode-editor-font-family, 'Menlo', monospace); font-size: 12px;"></div>
                    </div>
                </div>
            </div>
        </vscode-panel-view>

        <vscode-panel-view id="view-help"></vscode-panel-view>
    </vscode-panels>

    <div id="global-cursor-tooltip"></div>
    <script type="module" src="main.js"></script>
</body>
</html>
EOF_FINAL_HTML

# -----------------------------------------------------------------
# 2. GENERATION DU BUILDER DE RESUMÉS EXTERNALISÉ (block-summary-builder.js)
# -----------------------------------------------------------------
echo -e "[\e[34mINFO\e[0m] Création du service d'inférence de résumés..."

cat << 'EOF_SUMMARY_BUILDER' > "$SUMMARY_BUILDER_FILE"
export const BlockSummaryBuilder = {
    computeBlockSummary(blockId) {
        const truncate = (str, len = 24) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len) + '...' : str;
        };

        const collectAndFormatValues = (elementsMap) => {
            const pieces = [];
            Object.keys(elementsMap).forEach(key => {
                const rawVal = elementsMap[key];
                if (rawVal !== undefined && rawVal !== null && rawVal !== '' && rawVal !== false) {
                    let displayString = typeof rawVal === 'boolean' ? key : `${key}: ${truncate(String(rawVal))}`;
                    pieces.push({ text: displayString, length: displayString.length });
                }
            });
            // Tri par longueur croissante (Shorter first)
            pieces.sort((a, b) => a.length - b.length);
            return pieces.map(p => p.text).join(' | ');
        };

        switch (blockId) {
            case 'block-history': {
                const combo = document.getElementById('historyCombo');
                const activeProfile = combo ? combo.value : 'default';
                return collectAndFormatValues({ Profile: activeProfile === 'default' ? 'Default Config' : activeProfile });
            }
            case 'block-sourcepaths': {
                const paths = (document.getElementById('pathList')?.value || '').split('\n').map(p => p.trim()).filter(p => p);
                if (paths.length === 0) return 'No paths defined';
                return collectAndFormatValues({ Count: `${paths.length} target(s)`, First: paths[0].split('/').pop() || paths[0] });
            }
            case 'block-filters': {
                const maxF = document.getElementById('maxFile')?.value || '';
                const incP = document.getElementById('incPaths')?.value || '';
                const excP = document.getElementById('excPaths')?.value || '';
                return collectAndFormatValues({ [`Max ${maxF}KB`]: true, Inc: incP.split('\n')[0], Exc: excP.split('\n')[0] });
            }
            case 'block-destination': {
                return collectAndFormatValues({ Target: document.getElementById('destDir')?.value || 'Not configured' });
            }
            case 'block-options': {
                return collectAndFormatValues({
                    Format: (document.getElementById('format')?.value || 'yaml').toUpperCase(),
                    Split: document.getElementById('splitChunkByFileExtension')?.checked,
                    Tree: document.getElementById('generateTreeView')?.checked
                });
            }
            case 'costEstimationSection': {
                const rows = Array.from(document.querySelectorAll('#pricingTableBody tr'));
                if (rows.length === 0) return 'No metrics';
                const metrics = {};
                rows.forEach(r => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 3) {
                        metrics[cells[1].innerText] = cells[2].innerText;
                    }
                });
                return collectAndFormatValues(metrics);
            }
            case 'reportTableSection': {
                const rows = Array.from(document.querySelectorAll('#reportTableBody tr'));
                if (rows.length === 0) return 'Empty Report';
                const summaryExts = {};
                rows.slice(0, 3).forEach(r => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 2) summaryExts[cells[0].innerText] = cells[1].innerText;
                });
                return collectAndFormatValues(summaryExts);
            }
            case 'reportGraphSection':
                return 'Pie-chart active';
            case 'section-exported-files': {
                const links = Array.from(document.querySelectorAll('#exportedFilesList a, #exportedFilesList div'));
                return collectAndFormatValues({ Chunks: `${links.length} files` });
            }
            case 'section-logs-block': {
                const lines = Array.from(document.querySelectorAll('#logsList div')).length;
                return collectAndFormatValues({ Files: `${lines} items` });
            }
            case 'section-reports-block': {
                const rCount = Array.from(document.querySelectorAll('#reportsList div')).length;
                return collectAndFormatValues({ Reports: `${rCount} items` });
            }
            case 'section-tree-explorer': {
                const nodes = Array.from(document.querySelectorAll('#view-tree-content div')).length;
                return collectAndFormatValues({ TreeElements: `${nodes} elements` });
            }
            case 'section-terminal-cmd': {
                const len = (document.getElementById('terminal-cmd')?.value || '').length;
                return collectAndFormatValues({ CmdSize: `${len} chars` });
            }
            case 'section-terminal-logs': {
                const lines = (document.getElementById('terminal')?.innerText || '').split('\n').filter(l => l.trim()).length;
                return collectAndFormatValues({ Lines: `${lines} log rows` });
            }
            default:
                return '';
        }
    }
};
EOF_SUMMARY_BUILDER

# -----------------------------------------------------------------
# 3. MISE A JOUR DU GESTIONNAIRE D'INITIALISATION (initialization.manager.js)
# -----------------------------------------------------------------
echo -e "[\e[34mINFO\e[0m] Alignement du moteur d'événements et couplage des triggers flous (Blur/Input)..."

cat << 'EOF_INIT_MANAGER' > "$INIT_MANAGER_FILE"
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

let isModifierPressed = false;

export const InitializationManager = {
    refreshBlockSummaryUI(blockId, isCollapsed) {
        const summaryElement = document.getElementById(`summary-${blockId}`);
        if (!summaryElement) return;

        if (isCollapsed) {
            summaryElement.innerText = BlockSummaryBuilder.computeBlockSummary(blockId);
            summaryElement.style.display = 'inline-block';
        } else {
            summaryElement.innerText = '';
            summaryElement.style.display = 'none';
        }
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

        // Trigger de validation rattaché directement à l'élément hôte du WebComponent
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
        }
    }
};
EOF_INIT_MANAGER

# -----------------------------------------------------------------
# 4. ALIGNEMENT DU DISTRIBUTEUR DE MESSAGES ET BOUTONS TIERS (handler-manager.js)
# -----------------------------------------------------------------
echo -e "[\e[34mINFO\e[0m] Alignement du récepteur d'événements et du rendu d'Exchange original..."

cat << 'EOF_HANDLER_MANAGER' > "$HANDLER_MANAGER_FILE"
import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';
import { ValidatorService } from './validator.service.js';
import { UIController } from '../core/ui.controller.js';
import { HistoryManager } from './history-manager.js';
import { FiltersManager } from './filters-manager.js';
import { ExportManager } from './export-manager.js';

export const HandlerManager = {
    // Réintégration exacte de l'implémentation originale (Boutons images 64x64 + openBrowserTab)
    buildExchangeButtons(exchangeItems) {
        const container = document.getElementById('exchange-buttons-container');
        if (!container) return;
        container.innerHTML = '';

        if (!exchangeItems || !Array.isArray(exchangeItems)) return;

        exchangeItems.forEach(item => {
            const btn = document.createElement('vscode-button');
            btn.setAttribute('appearance', 'icon');
            btn.style.width = item.width || '64px';
            btn.style.height = item.height || '64px';

            if (item.tooltip) {
                btn.setAttribute('data-tooltip', item.tooltip);
                btn.setAttribute('title', item.tooltip);
                btn.classList.add('tooltip-bottom');
            }

            const img = document.createElement('img');
            img.src = item.icon;
            img.alt = item.tooltip || 'Exchange Link';
            img.style.width = item.width || '64px';
            img.style.height = item.height || '64px';

            btn.appendChild(img);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                bridge.postMessage('openBrowserTab', {
                    url: item.url,
                    openInVSCode: item.openInVSCode !== false
                });
            });

            container.appendChild(btn);
        });
    },

    handleExcludeExplorerPathSelection(message, tabs) {
        try {
            const excPathsEl = document.getElementById('excPaths');
            if (excPathsEl && message.path) {
                const currentVal = excPathsEl.value.trim();
                const cleanRaw = message.path.replace(/\\/g, '/');
                const wsRootPath = state.defaultSettings?.src ? state.defaultSettings.src.replace(/\\/g, '/') : '';

                let relativePath = cleanRaw;
                if (wsRootPath && cleanRaw.startsWith(wsRootPath)) {
                    relativePath = cleanRaw.slice(wsRootPath.length);
                }
                relativePath = relativePath.replace(/^\/+/, '');
                const escapedPath = relativePath.replace(/[-\\^\$*+?.()|[\]{}]/g, '\\$&');

                let isFolder = true;
                if (cleanRaw.includes('.')) {
                    const lastSegment = cleanRaw.split('/').pop();
                    if (lastSegment && lastSegment.includes('.')) isFolder = false;
                }

                const regexEntry = isFolder ? `.*/${escapedPath}/.*` : `.*/${escapedPath}$`;

                if (currentVal === '') {
                    excPathsEl.value = regexEntry;
                } else {
                    const lines = currentVal.split('\n');
                    if (!lines.includes(regexEntry)) excPathsEl.value = currentVal + '\n' + regexEntry;
                }

                excPathsEl.dispatchEvent(new Event('input', { bubbles: true }));
                excPathsEl.dispatchEvent(new Event('change', { bubbles: true }));
                UIController.checkSyncStatus();

                bridge.postMessage('showNotification', { type: 'info', text: 'Added pattern to Exclude Paths: ' + regexEntry });
            }
        } catch(err) { console.error(err); }
    },

    handleCheckPathsResult(message, tabs) {
        state.invalidPathsPayload = message.invalidPaths || [];
        ValidatorService.executeFieldValidation('pathList', false, true);
    },

    handleUpdatePaths(message, tabs) {
        state.selectedPaths = message.paths || [];
        const pathListEl = document.getElementById('pathList');
        if (pathListEl) pathListEl.value = state.selectedPaths.join('\n');
        UIController.checkSyncStatus();
        ValidatorService.executeFieldValidation('pathList');
    },

    handleInitSettings(message, tabs, isModifierPressed) {
        state.defaultSettings = message.defaultSettings || {};
        if (message.tooltipDelay !== undefined) state.tooltipDelayValue = message.tooltipDelay;
        state.isInitializing = true;
        state.historyList = message.history || [];
        state.currentSelectedId = message.selectedId || 'default';
        state.historyViewMode = message.historyViewMode || 'scope-current-repo';
        state.currentRepo = message.currentRepo || '';
        state.fileExtsCategoryGroups = FiltersManager.processFileExtsCategoryGroups(message.fileExtsCategoryGroups);

        HistoryManager.updateHistoryViewToggleButton();
        HistoryManager.updateHistoryCombo(state.currentSelectedId);
        HistoryManager.applyFormFields(message.currentSettings);

        if (message.paths && message.paths.length > 0) {
            state.selectedPaths = message.paths;
            const pathListEl = document.getElementById('pathList');
            if (pathListEl) pathListEl.value = state.selectedPaths.join('\n');
        }

        FiltersManager.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
        FiltersManager.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);

        const exchangeList = message.exchange || (message.defaultSettings && message.defaultSettings.exchange) || [];
        this.buildExchangeButtons(exchangeList);

        setTimeout(() => {
            state.isInitializing = false;
            UIController.checkSyncStatus();
            ValidatorService.executeFieldValidation('pathList');
            ValidatorService.executeFieldValidation('destDir');
        }, 50);
    },

    handleUpdateFileExtsCategoryGroups(message, tabs, isModifierPressed) {
        state.fileExtsCategoryGroups = FiltersManager.processFileExtsCategoryGroups(message.fileExtsCategoryGroups);
        FiltersManager.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
        FiltersManager.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);
    },

    handleUpdateHistory(message, tabs) {
        state.historyList = message.history || [];
        state.currentSelectedId = message.selectedId || state.currentSelectedId || 'default';

        HistoryManager.updateHistoryCombo(state.currentSelectedId);
        if (!message.skipFieldSync) HistoryManager.applyHistorySelection(state.currentSelectedId);

        UIController.checkSyncStatus();
        if (state.currentSelectedId && state.currentSelectedId.endsWith('-new')) {
            HistoryManager.enterInlineRenameMode();
        }
    },

    handleTerminalLog(message, tabs) {
        if (tabs.terminalTab) tabs.terminalTab.append(message.text);
        if (message.text.includes('Export process killed manually')) {
            ExportManager.resetRunButton();
            HistoryManager.resetCurrentConfigFields();
            if (tabs.reportTab) tabs.reportTab.clear();
            if (tabs.filesTab) tabs.filesTab.clear();
            if (tabs.treeViewTab) tabs.treeViewTab.clear();
        } else if (message.text.includes('Export complete!') || message.text.includes('Export aborted') || message.text.includes('ERROR:')) {
            ExportManager.resetRunButton();
        }
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
    },

    handleUpdateCommand(message, tabs) {
        if (tabs.terminalTab) tabs.terminalTab.updateCommand(message.text);
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
    },

    handleUpdateExportReport(message, tabs) {
        ExportManager.resetRunButton();
        try { if (tabs.reportTab) tabs.reportTab.render(message.data); } catch (e) {}
        try {
            if (message.data) {
                state.lastReportPayload = message.data;
                state.totalExportedSourceFiles = message.data.summary?.total_exported || 0;

                if (message.data.generated_files && tabs.filesTab) {
                    state.lastGeneratedFilesPayload = JSON.parse(JSON.stringify(message.data.generated_files));
                    tabs.filesTab.render(
                        state.lastGeneratedFilesPayload,
                        document.getElementById('destDir').value,
                        (p) => bridge.postMessage('openFile', {path:p}),
                        (p) => bridge.postMessage('openFinder', {path:p}),
                        document.getElementById('splitChunkByFileExtension').checked,
                        state.totalExportedSourceFiles
                    );
                }
                if (tabs.treeViewTab) tabs.treeViewTab.render(message.data, (p) => bridge.postMessage('openFile',{path:p}), (p) => bridge.postMessage('openFinder',{path:p}));
            }
        } catch (e) {}
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
    },

    handleFilteredFilesResult(message, tabs) {
        try {
            const payload = { ...state.lastGeneratedFilesPayload, exports: message.files };
            if (tabs.filesTab) {
                tabs.filesTab.render(
                    payload,
                    document.getElementById('destDir').value,
                    (p) => bridge.postMessage('openFile', {path:p}),
                    (p) => bridge.postMessage('openFinder', {path:p}),
                    document.getElementById('splitChunkByFileExtension').checked,
                    state.totalExportedSourceFiles
                );
            }
        } catch (e) {}
        if (typeof window.forceGlobalSummariesUpdate === 'function') window.forceGlobalSummariesUpdate();
    }
};
EOF_HANDLER_MANAGER

# -----------------------------------------------------------------
# 5. CONTROLES DE TYPECHECK TYPESCRIPT & COMPILATION PRODUCTION
# -----------------------------------------------------------------
echo -e "\n================================================================="
echo -e "🛡️  VÉRIFICATION RIGIDE DE L'AST ET DU COMPILATEUR"
echo -e "================================================================="

echo -e "[\e[34mINFO\e[0m] Exécution de tsc --noEmit..."
if npx tsc --noEmit; then
    echo -e "[\e[32mSUCCÈS\e[0m] Zéro erreur d'arbre de types détectée."
else
    echo -e "[\e[31mERREUR\e[0m] Échec de la compilation statique TypeScript."
    exit 1
fi

if grep -q "\"compile\":" package.json; then
    echo -e "[\e[34mINFO\e[0m] Packaging du bundle de production via Webpack (npm run compile)..."
    if npm run compile; then
        echo -e "[\e[32mSUCCÈS\e[0m] Build complet opérationnel à 100% !"
    else
        echo -e "[\e[31mERREUR\e[0m] Échec lors de la création de la distribution."
        exit 1
    fi
fi

echo -e "\n================================================================="
echo -e "✅ Blocs collapsibles de configuration & Onglets : OPÉRATIONNELS"
echo -e "✅ Service externe block-summary-builder.js : INJECTÉ"
echo -e "✅ Tooltips persistants & Rendu Exchange original : RESTAURÉS"
echo -e "================================================================="
