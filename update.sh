#!/bin/bash

# Ensure components directory exists
mkdir -p src/webview/js/components

# 1. Create the SplitPane component to handle horizontal resizing
cat << 'EOF' > src/webview/js/components/split-pane.js
export const SplitPane = {
    init(resizerId, leftId, rightId) {
        const resizer = document.getElementById(resizerId);
        const left = document.getElementById(leftId);
        const right = document.getElementById(rightId);

        if (!resizer || !left || !right) return;

        let isResizing = false;
        let startX, startWidth;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = left.getBoundingClientRect().width;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerWidth = left.parentElement.getBoundingClientRect().width;
            const newWidth = startWidth + (e.clientX - startX);
            const percentage = (newWidth / containerWidth) * 100;

            if (percentage > 10 && percentage < 90) {
                left.style.flex = `0 0 ${percentage}%`;
                right.style.flex = '1';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
            }
        });
    }
};
EOF

# 2. Use a robust Python script to precisely manipulate HTML & JS files
cat << 'EOF' > patch.py
import re

# ---- 1. UPDATE WEBVIEW.HTML ----
with open('src/webview/webview.html', 'r') as f:
    html = f.read()

# Remove TREE VIEW tab header
html = re.sub(r'<vscode-panel-tab id="tab-tree">TREE VIEW</vscode-panel-tab>\s*', '', html)

# Remove old view-tree panel completely
html = re.sub(r'<vscode-panel-view id="view-tree">.*?</vscode-panel-view>\s*', '', html, flags=re.DOTALL)

# Inject the new split-pane format inside the Report Table Section
# NOTE: flex-wrap: wrap is added to the toolbar to prevent overflow on extreme resize
report_block = r'''<div class="collapsible-block" id="reportTableSection" style="display: none; margin-bottom: 15px; width: 100%;">
                    <div class="collapsible-block-header">
                        <div class="collapsible-title-group">
                            <span class="codicon codicon-chevron-down" id="icon-reportTableSection"></span>
                            <span>📊 Export Report &amp; Tree View</span>
                        </div>
                        <span class="collapsible-summary-text" id="summary-reportTableSection"></span>
                    </div>
                    <div class="collapsible-block-content" id="content-reportTableSection" style="padding-top: 10px;">
                        <div style="display: flex; width: 100%; border: 1px solid var(--vscode-panel-border); min-height: 400px; max-height: 600px; overflow: hidden; background: var(--vscode-editor-background);">
                            <div id="split-left-table" style="flex: 1; overflow: auto; min-width: 150px; padding: 5px;">
                                <table id="reportTable" style="width: 100%; border-collapse: collapse; font-family: var(--vscode-editor-font-family); font-size: 12px;">
                                    <thead>
                                        <tr style="background: var(--vscode-sideBar-background); color: #00bcd4; text-align: left;">
                                            <th id="th-ext" style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">Extension ↕</th>
                                            <th id="th-exported" style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">Exported ↕</th>
                                            <th id="th-rejected" style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">Size Rejected ↕</th>
                                            <th id="th-excluded" style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">Excluded ↕</th>
                                        </tr>
                                    </thead>
                                    <tbody id="reportTableBody"></tbody>
                                    <tfoot id="reportTableFooter"></tfoot>
                                </table>
                            </div>
                            <div id="split-resizer" style="width: 5px; cursor: col-resize; background: var(--vscode-panel-border); flex-shrink: 0; transition: background 0.2s;" onmouseover="this.style.background='var(--vscode-focusBorder)'" onmouseout="this.style.background='var(--vscode-panel-border)'"></div>
                            <div id="split-right-tree" style="flex: 1; overflow: auto; min-width: 150px; padding: 5px; border-left: 1px solid var(--vscode-panel-border);">
                                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
                                    <vscode-button id="btnTreeToggleMode" appearance="icon" class="tooltip-bottom icon-btn" data-tooltip="Toggle structure mapping mode"><span class="codicon-list-flat codicon"></span></vscode-button>
                                    <vscode-text-field id="treeSearchInput" placeholder="Search files/extensions..." style="flex-grow: 1;"></vscode-text-field>
                                    <vscode-checkbox id="cbTreeRegexp">.*</vscode-checkbox>
                                    <vscode-button id="btnTreeClearSearch" appearance="icon" class="tooltip-bottom icon-btn"><span class="codicon-clear-all codicon"></span></vscode-button>
                                    <div class="vertical-divider"></div>
                                    <vscode-button id="btnTreeExpandAll" appearance="icon" class="tooltip-bottom icon-btn"><span class="codicon codicon-expand-all"></span></vscode-button>
                                    <vscode-button id="btnTreeCollapseAll" appearance="icon" class="tooltip-bottom icon-btn"><span class="codicon-collapse-all codicon"></span></vscode-button>
                                    <div class="vertical-divider"></div>
                                    <vscode-button id="btnTreeExport" appearance="icon" class="tooltip-left icon-btn"><span class="codicon codicon-export"></span></vscode-button>
                                </div>
                                <div id="view-tree-content" style="overflow-y: auto; max-height: 500px; font-family: var(--vscode-editor-font-family); font-size: 13px;"></div>
                            </div>
                        </div>
                    </div>
                </div>'''

# Execute HTML Replacement
html = re.sub(r'<div class="collapsible-block" id="reportTableSection".*?<tfoot id="reportTableFooter"></tfoot>\s*</table>\s*</div>\s*</div>', report_block, html, flags=re.DOTALL)

with open('src/webview/webview.html', 'w') as f:
    f.write(html)


# ---- 2. UPDATE INITIALIZATION.MANAGER.JS ----
with open('src/webview/js/core/initialization.manager.js', 'r') as f:
    init_js = f.read()

# Remove the standalone tree-explorer id from global checks, as it's now wrapped within Report section
init_js = init_js.replace("'section-tree-explorer', ", "")

with open('src/webview/js/core/initialization.manager.js', 'w') as f:
    f.write(init_js)


# ---- 3. UPDATE BLOCK-SUMMARY-BUILDER.JS ----
with open('src/webview/js/services/block-summary-builder.js', 'r') as f:
    summary_js = f.read()

# Merge Tree Elements summary into ReportTableSection summary
new_summary = r'''            case 'reportTableSection': {
                const rows = Array.from(document.querySelectorAll('#reportTableBody tr'));
                let treeStr = '';
                const nodes = Array.from(document.querySelectorAll('#view-tree-content .tree-item, #view-tree-content .tree-folder')).length;
                if (nodes > 0) treeStr = ` | Tree: ${nodes} elements`;
                if (rows.length === 0) return 'Empty Report' + treeStr;
                const summaryExts = {};
                rows.slice(0, 3).forEach(r => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 2) summaryExts[cells[0].innerText] = cells[1].innerText;
                });
                return collectAndFormatValues(summaryExts) + treeStr;
            }'''

summary_js = re.sub(r'case \'reportTableSection\': \{.*?return collectAndFormatValues\(summaryExts\);\s*\}', new_summary, summary_js, flags=re.DOTALL)
summary_js = re.sub(r'case \'section-tree-explorer\': \{.*?\s*return collectAndFormatValues\(\{ TreeElements: `\$\{nodes\} elements` \}\);\s*\}', '', summary_js, flags=re.DOTALL)

with open('src/webview/js/services/block-summary-builder.js', 'w') as f:
    f.write(summary_js)


# ---- 4. UPDATE MAIN.JS (BUGFIXED FOR SYNTAX SAFETY) ----
with open('src/webview/main.js', 'r') as f:
    main_js = f.read()

if "SplitPane" not in main_js:
    main_js = main_js.replace("import { HelpTab } from './components/help-tab.js';", "import { HelpTab } from './components/help-tab.js';\nimport { SplitPane } from './js/components/split-pane.js';")

    # Safely replace the initialization block to avoid arrow-function syntax errors
    init_pattern = r"if \(document\.readyState === 'loading'\) \{\s*document\.addEventListener\('DOMContentLoaded', \(\) => InitializationManager\.init\(tabs\)\);\s*\} else \{\s*InitializationManager\.init\(tabs\);\s*\}"

    init_replacement = """const initApp = () => {
    InitializationManager.init(tabs);
    SplitPane.init('split-resizer', 'split-left-table', 'split-right-tree');
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}"""

    main_js = re.sub(init_pattern, init_replacement, main_js)

with open('src/webview/main.js', 'w') as f:
    f.write(main_js)


# ---- 5. UPDATE REPORT-TAB.JS (Fix Sort Issue) ----
with open('src/webview/components/report-tab.js', 'r') as f:
    report_js = f.read()

# Fix the missing header onclick binding that broke Multi-Sort functionality
sort_fix = r'''th.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; cursor: pointer;">
                                <span>${headers[col]}</span>
                                <span>${indicator}</span>
                            </div>`;
            th.onclick = (e) => this.sort(e, col);'''

report_js = re.sub(r'th\.innerHTML = `<div style="display: flex.*?</div>`;', sort_fix, report_js, flags=re.DOTALL)

with open('src/webview/components/report-tab.js', 'w') as f:
    f.write(report_js)

EOF

python3 patch.py
rm patch.py
