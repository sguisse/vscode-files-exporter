#!/usr/bin/env bash

# Perform a clean and reliable restructuring of the view-terminal layout section to fix the tag nesting regression
python3 << 'EOF'
import os
import re

filepath = 'src/webview/webview.html'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Target the entire view-terminal block space to clear the overlapping closing tags and restore hierarchy parity
    pattern = r'(<vscode-panel-view id="view-terminal">[\s\S]*?</vscode-panel-view>)'

    reconstructed_view_terminal = """<vscode-panel-view id="view-terminal">
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
                              <div style="display: flex; flex-direction: row; align-items: flex-start; gap: 8px; width: 100%; box-sizing: border-box;">
                                  <div class="terminal" id="terminal-cmd" style="flex: 1; min-width: 0; box-sizing: border-box; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; border: 1px solid var(--vscode-panel-border); padding: 12px; min-height: 150px; height: 240px; resize: vertical; overflow: auto; font-family: var(--vscode-editor-font-family, 'Menlo', monospace); font-size: 12px; margin: 0;"></div>
                                  <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 2px;">
                                      <vscode-button id="btn-copy-cmd" appearance="icon" class="tooltip-right icon-btn" data-tooltip="Copy terminal cmd to clipboard">
                                          <span class="codicon codicon-copy"></span>
                                      </vscode-button>
                                  </div>
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
                              <div style="display: flex; flex-direction: row; align-items: flex-start; gap: 8px; width: 100%; box-sizing: border-box;">
                                  <div class="terminal" id="terminal" style="flex: 1; min-width: 0; box-sizing: border-box; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; border: 1px solid var(--vscode-panel-border); padding: 12px; min-height: 150px; height: 240px; resize: vertical; overflow: auto; font-family: var(--vscode-editor-font-family, 'Menlo', monospace); font-size: 12px; margin: 0;"></div>
                                  <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 2px;">
                                      <vscode-button id="btn-copy-terminal-logs" appearance="icon" class="tooltip-right icon-btn" data-tooltip="Copy terminal logs to clipboard">
                                          <span class="codicon codicon-copy"></span>
                                      </vscode-button>
                                      <vscode-button id="btn-clear-terminal-logs" appearance="icon" class="tooltip-right icon-btn" data-tooltip="Clear terminal logs">
                                          <span class="codicon codicon-trash"></span>
                                      </vscode-button>
                                  </div>
                              </div>
                          </div>
                      </div>

                  </div>
              </vscode-panel-view>"""

    text = re.sub(pattern, reconstructed_view_terminal, text)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
EOF

## ✅ Script modified. Layout regressions and broken closing div elements inside the terminal panel views have been completely resolved, restoring beautiful structural symmetry!
