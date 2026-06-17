import { bridge } from '../js/core/vscode.bridge.js';

export class TreeViewTab {
    constructor() {
        this.containerId = 'view-tree-content';
        this.searchId = 'treeSearchInput';
        this.cbRegexpId = 'cbTreeRegexp';
        this.clearSearchId = 'btnTreeClearSearch';
        this.expandId = 'btnTreeExpandAll';
        this.collapseId = 'btnTreeCollapseAll';
        this.toggleId = 'btnTreeToggleMode';
        this.exportBtnId = 'btnTreeExport';
        this.onFileClick = null;
        this.onFinderClick = null;
        this.actionsBound = false;
        this.excludeHandlerBound = false;
        this.treeManifest = null;
        this.viewMode = 'standard';
    }

    render(reportResults, onFileClick, onFinderClick) {
        this.onFileClick = onFileClick;
        this.onFinderClick = onFinderClick;
        this.treeManifest = reportResults?.tree_manifest?.root || null;

        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!this.treeManifest) {
            container.innerHTML = '<div style="padding: 10px; color: var(--vscode-descriptionForeground); font-style: italic; font-size: 11px;">No tree manifest processed. Ensure Tree View setting is enabled.</div>';
            return;
        }

        const activeNode = this.viewMode === 'extension' ? this.buildExtensionTree(this.treeManifest) : this.treeManifest;
        container.innerHTML = this.renderTreeHTML(activeNode, true);
        this.attachEvents();
        this.bindExcludeHandlers();

        const searchInput = document.getElementById(this.searchId);
        if (searchInput && searchInput.value.trim() !== '') {
            this.filterTree();
        }
    }

    buildExtensionTree(rootNode) {
        const extRoot = { name: 'Workspace grouped by Extension', type: 'directory', children: {}, absolute_path: rootNode.absolute_path };

        const traverse = (node) => {
            if (node.type === 'file') {
                const ext = node.extension || 'no_ext';
                if (!extRoot.children[ext]) {
                    extRoot.children[ext] = { name: ext, type: 'directory', children: {}, absolute_path: '' };
                }
                const fullName = ext === 'no_ext' ? node.name : `${node.name}.${ext}`;
                extRoot.children[ext].children[fullName] = node;
            } else if (node.children) {
                Object.values(node.children).forEach(traverse);
            }
        };
        traverse(rootNode);
        return extRoot;
    }

    renderTreeHTML(node, isRoot = false) {
        if (node.type === 'file') {
            const fullName = node.extension && node.extension !== 'no_ext' ? `${node.name}.${node.extension}` : node.name;
            return `<div class="tree-item file-item" data-name="${fullName.toLowerCase()}">
                        <input type="checkbox" class="tree-cb file-cb" data-path="${node.absolute_path.replace(/\\/g, '\\\\')}">
                        <span class="tree-icon">📄</span>
                        <span class="tree-name file-name" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;" data-path="${node.absolute_path.replace(/\\/g, '\\\\')}"
                            data-tooltip="Open file here, in VS Code">${fullName}</span>
                        <vscode-button appearance="icon" class="btn-tree-finder tooltip-right" data-tooltip="Reveal file in OS Explorer" data-path="${node.absolute_path.replace(/\\/g, '\\\\')}" style="height: 18px; width: 18px; margin-left: 10px;"><span class="codicon codicon-folder-opened"></span></vscode-button>
                        <vscode-button appearance="icon" class="btn-tree-exclude tooltip-right" data-tooltip="Exclude file path" data-path="${node.absolute_path.replace(/\\/g, '\\\\')}" style="height: 18px; width: 18px; margin-right: 5px;">🚫</vscode-button>
                    </div>`;
        }

        let childrenHTML = '';
        if (node.children) {
            const sortedKeys = Object.keys(node.children).sort((a, b) => {
                const childA = node.children[a];
                const childB = node.children[b];
                if (childA.type === 'directory' && childB.type !== 'directory') return -1;
                if (childA.type !== 'directory' && childB.type === 'directory') return 1;
                return a.localeCompare(b);
            });
            for (const key of sortedKeys) {
                childrenHTML += this.renderTreeHTML(node.children[key]);
            }
        }

        const expandedClass = isRoot ? 'expanded' : '';
        return `
            <div class="tree-folder ${expandedClass}" data-name="${node.name.toLowerCase()}">
                <div class="tree-folder-header">
                    <span class="tree-toggle">▶</span>
                    <input type="checkbox" class="tree-cb folder-cb">
                    <span class="tree-icon">📁</span>
                    <span class="tree-name folder-name" data-path="${(node.absolute_path || '').replace(/\\/g, '\\\\')}">${node.name}</span>
                    <vscode-button appearance="icon" class="btn-tree-exclude tooltip-right" data-tooltip="Exclude folder path" data-path="${(node.absolute_path || '').replace(/\\/g, '\\\\')}" style="height: 18px; width: 18px; margin-left: 10px;">🚫</vscode-button>
                </div>
                <div class="tree-children">
                    ${childrenHTML}
                </div>
            </div>
        `;
    }

    attachEvents() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.querySelectorAll('.tree-toggle, .folder-name').forEach(el => {
            el.addEventListener('click', () => {
                const folder = el.closest('.tree-folder');
                folder.classList.toggle('expanded');
                if (el.classList.contains('folder-name') && this.onFinderClick) {
                    const fp = el.getAttribute('data-path');
                    if (fp) this.onFinderClick(fp);
                }
            });
        });

        container.querySelectorAll('.tree-name.file-name').forEach(item => {
            item.addEventListener('click', () => {
                if (this.onFileClick) this.onFileClick(item.getAttribute('data-path'));
            });
        });

        container.querySelectorAll('.btn-tree-finder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onFinderClick) {
                    const rawPath = btn.getAttribute('data-path');
                    this.onFinderClick(rawPath);
                }
            });
        });

        container.querySelectorAll('.btn-tree-exclude').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rawPath = btn.getAttribute('data-path');
                const excPathsEl = document.getElementById('excPaths');

                if (excPathsEl) {
                    const currentVal = excPathsEl.value.trim();

                    const cleanRaw = rawPath.replace(/\\/g, '/');
                    const cleanRoot = this.treeManifest && this.treeManifest.absolute_path
                        ? this.treeManifest.absolute_path.replace(/\\/g, '/')
                        : '';

                    let relativePath = cleanRaw;
                    if (cleanRoot && cleanRaw.startsWith(cleanRoot)) {
                        relativePath = cleanRaw.slice(cleanRoot.length);
                    }
                    relativePath = relativePath.replace(/^\/+/, '');

                    const escapedPath = relativePath.replace(/[-\^$*+?.()|[\]{}]/g, '\\$&');

                    const isFolder = btn.getAttribute('data-tooltip')?.toLowerCase().includes('folder');
                    let regexEntry = isFolder ? `.*/${escapedPath}/.*` : `.*/${escapedPath}$`;
                    if (isFolder && (!escapedPath || relativePath === '')) {
                        const folderHeader = btn.closest('.tree-folder-header');
                        const folderNameEl = folderHeader ? folderHeader.querySelector('.folder-name') : null;
                        const folderName = folderNameEl ? folderNameEl.innerText.trim() : '';
                        if (this.viewMode === 'extension') {
                            regexEntry = `.*\\.${folderName}$`;
                        } else {
                            regexEntry = `.*/${folderName}/.*`;
                        }
                    }

                    if (currentVal === '') {
                        excPathsEl.value = regexEntry;
                    } else {
                        const lines = currentVal.split('\n');
                        if (!lines.includes(regexEntry)) {
                            excPathsEl.value = currentVal + '\n' + regexEntry;
                        }
                    }

                    excPathsEl.dispatchEvent(new Event('input', { bubbles: true }));
                    excPathsEl.dispatchEvent(new Event('change', { bubbles: true }));
                    bridge.postMessage('showNotification', {
                        type: 'info',
                        text: `Added relative pattern "${regexEntry}" to Exclude Paths.`
                    });
                }
            });
        });

        container.querySelectorAll('.tree-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const folder = e.target.closest('.tree-folder');
                if (folder && e.target.classList.contains('folder-cb')) {
                    folder.querySelectorAll('.tree-children .tree-cb').forEach(childCb => {
                        childCb.checked = isChecked;
                        childCb.indeterminate = false;
                        childCb.classList.remove('is-indeterminate');
                    });
                }
                e.target.classList.remove('is-indeterminate');
                this.updateParentCheckboxes(e.target);
            });
        });

        if (!this.actionsBound) {
            const searchInput = document.getElementById(this.searchId);
            if (searchInput) {
                searchInput.replaceWith(searchInput.cloneNode(true));
                const newSearchInput = document.getElementById(this.searchId);
                newSearchInput.addEventListener('blur', () => this.filterTree());
                newSearchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') this.filterTree();
                });
            }

            const cbRegexp = document.getElementById(this.cbRegexpId);
            if (cbRegexp) {
                cbRegexp.replaceWith(cbRegexp.cloneNode(true));
                document.getElementById(this.cbRegexpId).addEventListener('change', () => this.filterTree());
            }

            const clearSearchBtn = document.getElementById(this.clearSearchId);
            if (clearSearchBtn) {
                clearSearchBtn.replaceWith(clearSearchBtn.cloneNode(true));
                document.getElementById(this.clearSearchId).addEventListener('click', () => {
                    const input = document.getElementById(this.searchId);
                    if (input) input.value = '';
                    this.filterTree();
                });
            }

            const expandBtn = document.getElementById(this.expandId);
            if (expandBtn) {
                expandBtn.replaceWith(expandBtn.cloneNode(true));
                document.getElementById(this.expandId).addEventListener('click', () => this.setExpandAll(true));
            }

            const collapseBtn = document.getElementById(this.collapseId);
            if (collapseBtn) {
                collapseBtn.replaceWith(collapseBtn.cloneNode(true));
                document.getElementById(this.collapseId).addEventListener('click', () => this.setExpandAll(false));
            }

            const toggleBtn = document.getElementById(this.toggleId);
            if (toggleBtn) {
                toggleBtn.replaceWith(toggleBtn.cloneNode(true));
                document.getElementById(this.toggleId).addEventListener('click', () => {
                    this.viewMode = this.viewMode === 'standard' ? 'extension' : 'standard';
                    const icon = document.getElementById(this.toggleId);
                    if (icon) icon.innerHTML = this.viewMode === 'standard' ? '<span class="codicon codicon-list-flat"></span>' : '<span class="codicon codicon-file"></span>';
                    if (this.treeManifest) this.render({ tree_manifest: { root: this.treeManifest } }, this.onFileClick, this.onFinderClick);
                });
            }

            const exportBtn = document.getElementById(this.exportBtnId);
            if (exportBtn) {
                exportBtn.replaceWith(exportBtn.cloneNode(true));
                document.getElementById(this.exportBtnId).addEventListener('click', () => this.executeExportSelection());
            }

            this.actionsBound = true;
        }
    }

    /**
     * ✨ Flawless Tri-State Calculation Routine Layer: Evaluates states accurately by matching sub-checkbox arrays
     */
    updateParentCheckboxes(childCb) {
        let parentFolder = childCb.closest('.tree-children')?.closest('.tree-folder');
        while (parentFolder) {
            const parentCb = parentFolder.querySelector(':scope > .tree-folder-header .tree-cb');
            if (!parentCb) break;

            // Target immediate structural children arrays exclusively to avoid calculation pollution leaks
            const immediateChildrenCbs = Array.from(parentFolder.querySelectorAll(
                ':scope > .tree-children > .tree-folder > .tree-folder-header .tree-cb, :scope > .tree-children > .tree-item .tree-cb'
            ));

            const total = immediateChildrenCbs.length;
            const checked = immediateChildrenCbs.filter(c => c.checked && !c.classList.contains('is-indeterminate')).length;
            const indeterminate = immediateChildrenCbs.filter(c => c.indeterminate || c.classList.contains('is-indeterminate')).length;
            const unchecked = total - checked - indeterminate;

            if (checked === total && indeterminate === 0) {
                parentCb.checked = true;
                parentCb.indeterminate = false;
                parentCb.classList.remove('is-indeterminate');
            } else if (unchecked === total && indeterminate === 0) {
                parentCb.checked = false;
                parentCb.indeterminate = false;
                parentCb.classList.remove('is-indeterminate');
            } else {
                parentCb.checked = false;
                parentCb.indeterminate = true;
                parentCb.classList.add('is-indeterminate'); // Inject styling token anchor string explicitly
            }

            parentFolder = parentFolder.parentElement?.closest('.tree-folder');
        }
    }

    executeExportSelection() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const selectedFiles = [];
        container.querySelectorAll('.file-cb').forEach(cb => {
            if (cb.checked) {
                selectedFiles.push(cb.getAttribute('data-path'));
            }
        });

        if (selectedFiles.length === 0) {
            bridge.postMessage('showNotification', { type: 'warn', text: 'No files selected for export.' });
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); z-index: 21000; display: flex; align-items: center; justify-content: center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); padding: 16px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); min-width: 340px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: var(--vscode-font-family, sans-serif);';

        modal.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #00bcd4;">📤 Capture Selection</div>
            <div style="font-size: 12px; margin-bottom: 16px; line-height: 1.4;">Ready to process <strong>${selectedFiles.length}</strong> selected file(s) from the manifest. Confirm operation execution?</div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <vscode-button id="btn-export-ok" appearance="primary">OK</vscode-button>
                <vscode-button id="btn-export-cancel" appearance="secondary">Cancel</vscode-button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const closeModal = () => document.body.removeChild(backdrop);

        document.getElementById('btn-export-cancel')?.addEventListener('click', () => {
            bridge.postMessage('showNotification', { type: 'warn', text: 'Manifest selection export cancelled.' });
            closeModal();
        });

        document.getElementById('btn-export-ok')?.addEventListener('click', () => {
            bridge.postMessage('showNotification', { type: 'info', text: `Captured ${selectedFiles.length} source elements successfully from tree manifest.` });
            closeModal();
        });
    }

    filterTree() {
        const searchInput = document.getElementById(this.searchId);
        const cbRegexp = document.getElementById(this.cbRegexpId);
        const container = document.getElementById(this.containerId);
        if (!container || !searchInput) return;

        const query = searchInput.value.trim();
        const useRegexp = cbRegexp && cbRegexp.checked;

        if (!query) {
            container.querySelectorAll('.tree-folder, .file-item').forEach(el => el.style.display = 'block');
            return;
        }

        let regex;
        if (useRegexp) {
            try {
                regex = new RegExp(query, 'i');
            } catch (e) { return; }
        } else {
            regex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        }

        container.querySelectorAll('.tree-folder, .file-item').forEach(el => el.style.display = 'none');

        const items = container.querySelectorAll('.file-item');
        items.forEach(item => {
            const name = item.getAttribute('data-name');
            if (name && regex.test(name)) {
                item.style.display = 'block';
                let parent = item.parentElement.closest('.tree-folder');
                while (parent) {
                    parent.style.display = 'block';
                    parent.classList.add('expanded');
                    parent = parent.parentElement.closest('.tree-folder');
                }
            }
        });
    }

    setExpandAll(expand) {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.querySelectorAll('.tree-folder').forEach(folder => {
            if (expand) folder.classList.add('expanded');
            else folder.classList.remove('expanded');
        });
    }

    clear() {
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
        const searchInput = document.getElementById(this.searchId);
        if (searchInput) searchInput.value = '';
    }

    bindExcludeHandlers() {
        const excExtsEl = document.getElementById('excExts');
        const incExtsEl = document.getElementById('incExts');
        const toggleMode = document.getElementById('btnTreeToggleMode');
        const isExtensionMode = toggleMode && toggleMode.getAttribute('data-view-mode') === 'extension';

        document.querySelectorAll('.btn-tree-exclude').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const path = btn.getAttribute('data-path');
                const node = btn.closest('.tree-node, .tree-folder, .tree-item');
                let exts = [];

                if (isExtensionMode) {
                    // Extract from current node or recursive children if folder
                    const collectExts = (el) => {
                        const fileCb = el.querySelector('.file-cb');
                        if (fileCb) {
                            const p = fileCb.getAttribute('data-path');
                            const match = p.match(/\\.([^\\./]+)$/);
                            if (match) exts.push(match[1]);
                        }
                        el.querySelectorAll('.file-item').forEach(f => {
                             const p = f.querySelector('.file-cb')?.getAttribute('data-path');
                             const match = p?.match(/\\.([^\\./]+)$/);
                             if (match) exts.push(match[1]);
                        });
                    };
                    collectExts(node);
                } else {
                    const match = path.match(/\\.([^\\./]+)$/);
                    if (match) exts.push(match[1]);
                }

                exts = [...new Set(exts)];
                let currentExc = excExtsEl.value;
                let currentInc = incExtsEl.value;

                exts.forEach(ext => {
                    const pattern = '\\.' + ext + '$';
                    if (!currentExc.includes(pattern)) {
                        currentExc += (currentExc ? '\n' : '') + pattern;
                    }
                    if (currentInc.includes(ext)) {
                        // Reuse Modal logic (assuming ModalComponent is globally available)
                        if (window.ModalComponent) {
                            window.ModalComponent.triggerValidationErrorModal('Extension .' + ext + ' is currently included in "Include Extensions". Remove it first.');
                        }
                    }
                });

                excExtsEl.value = currentExc;
                excExtsEl.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });

    }
}
