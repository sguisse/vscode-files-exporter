import { bridge } from '../js/core/vscode.bridge.js';

export class HelpTab {
    constructor() {
        this.containerId = 'view-help';
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[QA Error] Target container #${this.containerId} not found in DOM.`);
            return;
        }

        container.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; gap: 15px; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); line-height: 1.5; padding: 10px; box-sizing: border-box;">

                <div class="section-title">📖 User Guide & Cheat Sheet</div>

                <div style="background: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textLink-foreground); padding: 10px; margin-bottom: 5px; border-radius: 0 4px 4px 0;">
                    <strong>Welcome to Files Exporter!</strong> This tool aggregates and serializes multiple workspace files into unified multi-format text structures (chunks) ideal for LLM context injection, compliance auditing, or static code reviews.
                </div>

                <h3 style="margin: 5px 0 0 0; color: #00bcd4; font-size: 14px;">🛑 Prerequisites</h3>
                <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 5px;">
                    <li><strong>Python3:</strong> You must have python 3 installed on your system. It is needed to run the local Python scripts for file processing.</li>
                </ul>

                <h3 style="margin: 5px 0 0 0; color: #00bcd4; font-size: 14px;">➡️ Core Workflows</h3>
                <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 5px;">
                    <li><strong>Source Specification:</strong> Paste multi-line absolute or relative folders/files paths inside the <em>Source Paths</em> text area. You can drop paths separated by commas, semicolons, or newlines.</li>
                    <li><strong>Adaptive Configuration Profiles:</strong> Profiles are auto-saved on execution. Use <span class="codicon codicon-lock"></span>/<span class="codicon codicon-unlock"></span> (Freeze/Unfreeze) to lock a stable configuration against modifications or dynamic variable overwrites.</li>
                    <li><strong>Verification:</strong> The workspace background engine checks for invalid locations and values, which will instantly flash in pastel red to block broken build runs.</li>
                </ul>

                <h3 style="margin: 10px 0 0 0; color: #00bcd4; font-size: 14px;">🎯 Advanced Filtering Regex Specifications</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 4px;">
                        <strong style="color: var(--vscode-charts-green);">✅ Path Inclusion / Exclusion Rules</strong>
                        <p style="margin: 5px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">Evaluated line-by-line relative to the target directory root:</p>
                        <p style="font-family: var(--vscode-editor-font-family); font-size: 11px;">
                            .*/node_modules/.* -> Skips dependency trees<br/>
                            .*/(src|lib)/.* -> Targets business logic only
                        </p>
                    </div>
                    <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 4px;">
                        <strong style="color: var(--vscode-charts-green);">🟢 Extension Inclusion / Exclusion Rules</strong>
                        <p style="margin: 5px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">Matches explicit file signatures before executing read routines:</p>
                        <p style="font-family: var(--vscode-editor-font-family); font-size: 11px;">
                            .*\\.(ts|js|py)$ -> Allows specific languages<br/>
                            .*\\.(png|jpg|exe|zip)$ -> Disallows binaries
                        </p>
                    </div>
                </div>

                <h3 style="margin: 10px 0 0 0; color: #00bcd4; font-size: 14px;">📦 Optimization Parameters</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid var(--vscode-panel-border);">
                    <thead>
                        <tr style="background: var(--vscode-sideBar-background); color: var(--vscode-textLink-foreground); text-align: left;">
                            <th style="padding: 6px; border: 1px solid var(--vscode-panel-border); width: 25%;">Parameter</th>
                            <th style="padding: 6px; border: 1px solid var(--vscode-panel-border);">Functional Specification</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 5px; border: 1px solid var(--vscode-panel-border);"><strong>Max File (KB)</strong></td>
                            <td style="padding: 5px; border: 1px solid var(--vscode-panel-border);">Explicitly rejects single source files that cross this size limit. Safeguards memory allocation.<br/>
                                Size of the file extension excluded are displayed in the report table in column <strong>Size Rejected</strong> with min and max file size.<br/> To let you reajust the filter rules or increase the limit if needed.
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border: 1px solid var(--vscode-panel-border);"><strong>Max Chunk (KB)</strong></td>
                            <td style="padding: 5px; border: 1px solid var(--vscode-panel-border);">Automatically cuts output documents when hitting size bounds and generates indexed part files (e.g., _01.yaml). Set to 0 for unlimited.
                                <ul>
                                    <li>export-2026-06-08_12-28-10_01.yaml</li>
                                    <li>export-2026-06-08_12-28-10_02.yaml</li>
                                    <li>export-2026-06-08_12-28-10_03.yaml</li>
                                </ul>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border: 1px solid var(--vscode-panel-border);"><strong>Split by Ext</strong></td>
                            <td style="padding: 5px; border: 1px solid var(--vscode-panel-border);">Isolates data streams and forces discrete output files whenever the underlying source code type transitions.
                                <ul>
                                    <li style="color: var(--vscode-charts-orange); font-size: 12px; font-family: var(--vscode-editor-font-family); font-weight: 500; text-decoration: none;">export-2026-06-08_12-28-10_<strong>java</strong>_01.xml</li>
                                    <li style="color: var(--vscode-charts-orange); font-size: 12px; font-family: var(--vscode-editor-font-family); font-weight: 500; text-decoration: none;">export-2026-06-08_12-28-10_<strong>java</strong>_02.xml</li>
                                    <li style="color: var(--vscode-charts-blue); font-size: 12px; font-family: var(--vscode-editor-font-family); font-weight: 500; text-decoration: none;">export-2026-06-08_12-28-10_<strong>properties</strong>_01.xml</li>
                                    <li style="color: var(--vscode-charts-green); font-size: 12px; font-family: var(--vscode-editor-font-family); font-weight: 500; text-decoration: none;">export-2026-06-08_12-28-10_<strong>md</strong>_01.xml</li>
                                    <li style="color: var(--vscode-charts-green); font-size: 12px; font-family: var(--vscode-editor-font-family); font-weight: 500; text-decoration: none;">export-2026-06-08_12-28-10_<strong>md</strong>_02.xml</li>
                                </ul>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <h3 style="margin: 10px 0 0 0; color: #00bcd4; font-size: 14px;">💡 Pro-Tips</h3>
                <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 4px; font-size: 12px;">
                    <div>
                        💡 <strong>Clipboard Sync</strong>
                        <ul>
                            <li>Navigate to the <strong>TERMINAL</strong> tab to review the compiled shell command built dynamically from your screen selections. </li>
                            <li>Click 📋 to copy and run headless exports outside of VS Code via standard automation task runners.</li>
                        </ul>
                    </div>
                    </div>

                    <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 4px; font-size: 12px;">
                    <div>
                        💡 <strong>Work with LLM Clients outside vscode/IntelliJ (Gemini, ChatGPT, ...):</strong>
                        <ul>
                            <li>Select only folders/files needed by LLM to create/adapt/analyze your code/documentation. To limit the context size (tokens 💰/🌱) and improve performance.</li>
                            <li> Disable ◻️ <strong>Split by ext</strong> to prevent automatic file splitting based on file extensions.</li>
                            <li>Select '<strong>YAML</strong>' as <strong>Output Format</strong> for better compatibility with LLM clients.</li>
                            <li>After '<strong>Run Export</strong>', Goto <strong>FILES</strong> tab to open the OS file explorer directly on the generated file with 📂.</li>
                            <li>D&D the file in LLM chat to be in the context (attachment).</li>
                            <li>Then you can use this sample <strong>prompt template</strong> (or in '<strong><em>Gems</em></strong>' for Gemini):
                                <vscode-button id="btn-copy-sample-prompt" appearance="secondary" class="tooltip-right icon-btn" style="color: red; data-tooltip="Copy sample prompt to OS clipboard">
                                <span class="codicon codicon-copy"></span>
                                </vscode-button>
                            </li>
                            <ul id="sample-prompt-content">
                                <li><strong>Role</strong></li>
                                    <ul>
                                        <li>You act as an Architect xxxx expert in xxxxxx code.</li>
                                    </ul>
                                <li><strong>Context</strong></li>
                                    <ul>
                                        <li>Read and analyze deeply the given codebase (partial) in attachement (file named : \"<strong>xxxxxxx</strong>\") to understand its structure and functionality.</li>
                                        <li>Read also the related technical documentation in attachement (file named : \"<strong>xxxxxxx</strong>\") to follow and respect during your code generation.</li>
                                    </ul>
                                <li><strong>Expected</strong></li>
                                        <ul>
                                            <li>Add a tab named \"Help\" in file '<em>src/webview/components/help-tab.js</em>'. Include in it the user guide of the application in HTML.</li>
                                        </ul>
                                <li><strong>Output</strong></li>
                                    <ul>
                                        <li>Does not give any theoretical explanation, introduction or textual conclusion outside of the script.</li>
                                        <li>Only provide the full content of the modified file '<em>src/webview/components/help-tab.js</em>' with the new \"Help\" tab content as described in the expected section and full other necessary modifications in other related files.</li>
                                        <li>Provide the entire output as a SINGLE, self-contained Bash script ('<em>*.sh</em>') actionnable at the workspace root.</li>
                                        <li>Use '<em>cat << 'EOF' > path/to/file</em>' blocks to create or overwrite ALL complete files (no snippets, no truncation comments, no \"...\").</li>
                                        <li>Manage the potential syntax conflict between the triple-backticks of the LLM chat GUI Markdown and the triple-backticks that the Bash script must write to the Markdown files.</li>
                                        <li>The script must manage the creation of the necessary folders ('<em>mkdir -p</em>').</li>
                                        <li>Ensure that the script is 100% compliant, without concessions, and directly executable locally in workspace root after a '<em>chmod +x</em>'.</li>
                                    </ul>
                            </ul>
                            <li>Then <strong>copy/paste</strong> the generated Bash script into a file named '<strong><em>patch.sh</em></strong>' in workspace root and execute it!</li>
                            <li>Refresh the workspace if needed to see the changes.</li>
                        </ul>
                    </div>
                  </div>

                  <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 4px; font-size: 12px;">
                    <div>
                        💡 <strong>Work with NotebookLM</strong>
                        <ul>
                            <li>Select only folders/files needed. To limit the context size (tokens 💰/🌱) and improve performance.</li>
                            <li>Enable ☑️ <strong>Split by Ext</strong> to force automatic file splitting based on file extensions.</li>
                            <li>Select '<strong>TXT</strong>' as <strong>Output Format</strong> for compatibility with NotebookLM.</li>
                            <li>After '<strong>Run Export</strong>', click on 📂 at right of <strong>Destination Directory</strong> to open the OS file explorer directly in the folder containing the generated files.</li>
                            <li>D&D the files in NotebookLM to be in the context (attachment).</li>
                            <li>Then you can apply any prompt and use available tools on injected files content.</li>
                        </ul>

                        <ul>
                            <li>For reminder actually (2026/06/10), only the following file types are supported by NotebookLM</li>
                            <ul>
                                <li><strong>Text & Data : TXT, md, csv</strong></li>
                                <li><strong>Documents & Presentations</strong> : pdf, docx, pptx, epub</li>
                                <li><strong>Audio</strong> : aac, aif, aifc, aiff, amr, au, cda, m4a, mid, mp3, ogg, opus, ra, ram, snd, wav, wma</li>
                                <li><strong>Video</strong> : 3g2, 3gp, avi, mp4, mpeg</li>
                                <li><strong>Images</strong> : avif, bmp, gif, ico, jp2, png, webp, tif, tiff, heic, heif, jpeg, jpg, jpe</li>
                            </ul>
                        </ul>

                    </div>
                  </div>

                  <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 4px; font-size: 12px;">
                    <div>
                        💡 <strong>Other information resources</strong>
                        <ul>
                            <li><a href="https://github.com/sguisse/vscode-files-exporter/blob/main/user-guide.md" target="_blank">Files Exporter - User Guide</a></li>
                            <li><a href="https://github.com/sguisse/vscode-files-exporter/blob/main/scenario.md" target="_blank">Sample complete Use-Case: How to add a new feature to your application</a></li>
                            <li><a href="https://github.com/sguisse/vscode-files-exporter/blob/main/faq.md" target="_blank">FAQ</a></li>
                            <li><a href="https://zonalogo.com/" target="_blank">Zonalogo - Find other brand icons to use in exchange config</a></li>
                        </ul>
                    </div>
                  </div>
        `;
        console.log("[QA Trace] HelpTab template successfully injected.");

        // Wiring the clipboard copy functionality for the sample prompt template
        const copyBtn = document.getElementById('btn-copy-sample-prompt');
        const promptContent = document.getElementById('sample-prompt-content');

        if (copyBtn && promptContent) {
            copyBtn.addEventListener('click', () => {
                const textToCopy = promptContent.innerText || promptContent.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    bridge.postMessage('showNotification', {
                        type: 'info',
                        text: 'Sample prompt template copied to clipboard successfully!'
                    });
                }).catch((err) => {
                    console.error('Failed to copy sample prompt layout text: ', err);
                    bridge.postMessage('showNotification', {
                        type: 'error',
                        text: 'Failed to access clipboard layout structures.'
                    });
                });
            });
        }
    }
}
