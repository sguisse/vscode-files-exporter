import { state } from '../core/state.manager.js';
import { UIController } from '../core/ui.controller.js';

export const FiltersManager = {
    convertToRegexPattern(ext) {
        let clean = ext.trim();
        if (clean.startsWith('*') && clean.endsWith('*') && clean.length > 1) {
            return '.*' + clean.slice(1, -1) + '.*';
        } else if (clean.startsWith('*.')) {
            return '.*\\.' + clean.slice(2) + '$';
        }
        return clean;
    },
    processFileExtsCategoryGroups(groups) {
        return (groups || []).map(cat => ({
            ...cat,
            extensions: cat.extensions.map(this.convertToRegexPattern)
        }));
    },
    renderPredefinedMenu(menuId, targetFieldId, flagKey, isModifierPressed) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        menu.innerHTML = '';

        if (!state.fileExtsCategoryGroups || state.fileExtsCategoryGroups.length === 0) {
            menu.innerHTML = '<div style="padding: 6px 10px; font-size: 11px; font-style: italic; color: var(--vscode-descriptionForeground);">No categories configured</div>';
            return;
        }

        const validCategories = state.fileExtsCategoryGroups.filter(cat => cat[flagKey] === true);

        if (validCategories.length === 0) {
            menu.innerHTML = '<div style="padding: 6px 10px; font-size: 11px; font-style: italic; color: var(--vscode-descriptionForeground);">No categories enabled for this menu</div>';
            return;
        }

        validCategories.forEach(item => {
            const row = document.createElement('div');
            row.className = 'predefined-item-row';
            row.style.cssText = 'padding: 6px 10px; cursor: pointer; font-size: 12px; font-family: var(--vscode-font-family); border-radius: 2px; margin: 1px 2px; transition: background 0.15s, color 0.15s;';
            row.innerText = item.label;

            if (isModifierPressed) {
                row.style.background = '#ffcdd2';
                row.style.color = '#b71c1c';
                row.setAttribute('data-tooltip', '⚠️ DESTRUCTIVE: Click to completely OVERWRITE and REPLACE field content!');
            } else {
                row.style.background = 'transparent';
                row.style.color = 'var(--vscode-dropdown-foreground, #cccccc)';
                row.setAttribute('data-tooltip', 'Click to APPEND extensions on a new line.');
            }

            row.addEventListener('mouseenter', () => {
                if (isModifierPressed) {
                    row.style.background = '#ef9a9a';
                    row.style.color = '#7f0000';
                } else {
                    row.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';
                    row.style.color = 'var(--vscode-list-hoverForeground, #ffffff)';
                }
            });

            row.addEventListener('mouseleave', () => {
                if (isModifierPressed) {
                    row.style.background = '#ffcdd2';
                    row.style.color = '#b71c1c';
                } else {
                    row.style.background = 'transparent';
                    row.style.color = 'var(--vscode-dropdown-foreground, #cccccc)';
                }
            });

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const shouldReplace = e.ctrlKey || e.metaKey || isModifierPressed;
                this.applyPredefinedExtensions(item.extensions, shouldReplace, targetFieldId);
                menu.style.display = 'none';
            });

            menu.appendChild(row);
        });
    },
    updateMenuHotkeysLayout(isModifierPressed) {
        const incBtn = document.getElementById('btn-predefined-inclusions');
        const excBtn = document.getElementById('btn-predefined-exclusions');

        if (isModifierPressed) {
            if (incBtn) incBtn.setAttribute('data-tooltip', 'Predefined extensions (REPLACE mode active)');
            if (excBtn) excBtn.setAttribute('data-tooltip', 'Predefined extensions (REPLACE mode active)');
        } else {
            if (incBtn) incBtn.setAttribute('data-tooltip', 'Predefined extension inclusions');
            if (excBtn) excBtn.setAttribute('data-tooltip', 'Predefined extension exclusions');
        }

        const incMenu = document.getElementById('predefined-inclusions-menu');
        const excMenu = document.getElementById('predefined-exclusions-menu');

        if (incMenu && incMenu.style.display === 'block') this.renderPredefinedMenu('predefined-inclusions-menu', 'incExts', 'includeExtsMenuEnabled', isModifierPressed);
        if (excMenu && excMenu.style.display === 'block') this.renderPredefinedMenu('predefined-exclusions-menu', 'excExts', 'excludeExtsMenuEnabled', isModifierPressed);
    },
    applyPredefinedExtensions(extensions, shouldReplace, targetFieldId) {
        const extsEl = document.getElementById(targetFieldId);
        if (!extsEl || !extensions) return;

        let lines = [];
        if (!shouldReplace) {
            let currentVal = extsEl.value.trim();
            lines = currentVal ? currentVal.split('\n').map(l => l.trim()) : [];
        }

        extensions.forEach(ext => {
            const pattern = ext.trim();
            if (!pattern) return;
            if (!lines.includes(pattern)) {
                lines.push(pattern);
            }
        });

        extsEl.value = lines.join('\n');
        extsEl.dispatchEvent(new Event('input', { bubbles: true }));
        extsEl.dispatchEvent(new Event('change', { bubbles: true }));
        UIController.checkSyncStatus();
    },
    explodeRegexFilter(regexStr) {
        let results = [];
        let currentPart = "";
        let depth = 0;
        let bracketDepth = 0;
        let parts = [];

        for (let i = 0; i < regexStr.length; i++) {
            let c = regexStr[i];
            if (c === "(" && (i === 0 || regexStr[i-1] !== "\\")) depth++;
            else if (c === ")" && (i === 0 || regexStr[i-1] !== "\\")) depth--;
            else if (c === "[" && (i === 0 || regexStr[i-1] !== "\\")) bracketDepth++;
            else if (c === "]" && (i === 0 || regexStr[i-1] !== "\\")) bracketDepth--;
            else if (c === "|" && depth === 0 && bracketDepth === 0 && (i === 0 || regexStr[i-1] !== "\\")) {
                parts.push(currentPart);
                currentPart = "";
                continue;
            }
            currentPart += c;
        }
        parts.push(currentPart);

        parts.forEach(part => {
            const groupMatch = part.match(/\((?:\?:)?([^)]+)\)/);

            if (groupMatch) {
                const exts = groupMatch[1].split("|");
                const pre = part.substring(0, groupMatch.index);
                const post = part.substring(groupMatch.index + groupMatch[0].length);

                exts.forEach(ext => {
                    results.push(pre + ext + post);
                });
            } else {
                results.push(part);
            }
        });

        return results;
    },
    sortTextAreaLines(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const btn = document.getElementById("btn-sort-" + id);
        const icon = btn?.querySelector(".codicon");
        let dir = btn?.getAttribute("data-dir") || "asc";

        let lines = el.value.split("\n").map(l => l.trim()).filter(l => l);

        if (dir === "asc") {
            lines.sort((a, b) => a.localeCompare(b));
            if (btn) btn.setAttribute("data-dir", "desc");
            if (icon) {
                icon.classList.remove("codicon-triangle-down");
                icon.classList.add("codicon-triangle-up");
            }
        } else {
            lines.sort((a, b) => b.localeCompare(a));
            if (btn) btn.setAttribute("data-dir", "asc");
            if (icon) {
                icon.classList.remove("codicon-triangle-up");
                icon.classList.add("codicon-triangle-down");
            }
        }

        el.value = lines.join("\n");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        UIController.checkSyncStatus();
    },
    explodeTextAreaRegex(id) {
        const el = document.getElementById(id);
        if (!el) return;
        let lines = el.value.split("\n").map(l => l.trim()).filter(l => l);
        let explodedLines = [];
        lines.forEach(line => {
            if (line.startsWith("#")) {
                explodedLines.push(line);
            } else {
                explodedLines.push(...this.explodeRegexFilter(line));
            }
        });
        explodedLines = Array.from(new Set(explodedLines)).sort((a, b) => a.localeCompare(b));
        el.value = explodedLines.join("\n");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        UIController.checkSyncStatus();
    },
    groupTextAreaExtensions(id) {
        const el = document.getElementById(id);
        if (!el || !state.fileExtsCategoryGroups) return;
        const btn = document.getElementById("btn-group-" + id);
        let isGrouped = btn?.getAttribute("data-grouped") === "true";

        let lines = el.value.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

        if (isGrouped) {
            lines.sort((a, b) => a.localeCompare(b));
            el.value = lines.join("\n");
            if (btn) {
                btn.setAttribute("data-grouped", "false");
                btn.style.background = "";
            }
        } else {
            const groupedLines = [];
            state.fileExtsCategoryGroups.forEach(category => {
                const catRegexes = category.extensions.map(ext => ext.trim());
                const matchedInCat = [];

                lines.forEach(line => {
                    if (catRegexes.includes(line)) {
                        matchedInCat.push(line);
                    }
                });

                if (matchedInCat.length > 0) {
                    matchedInCat.sort((a, b) => a.localeCompare(b));
                    groupedLines.push("# --- " + category.label + " ---");
                    groupedLines.push(...matchedInCat);
                }
            });

            const matchedWithCat = [];
            state.fileExtsCategoryGroups.forEach(category => {
                const catRegexes = category.extensions.map(ext => ext.trim());
                lines.forEach(line => {
                    if (catRegexes.includes(line)) {
                        matchedWithCat.push(line);
                    }
                });
            });

            const remaining = lines.filter(l => !matchedWithCat.includes(l));
            if (remaining.length > 0) {
                remaining.sort((a, b) => a.localeCompare(b));
                groupedLines.push("# --- Miscellaneous ---");
                groupedLines.push(...remaining);
            }

            el.value = groupedLines.join("\n");
            if (btn) {
                btn.setAttribute("data-grouped", "true");
                btn.style.background = "var(--vscode-button-background, #007fd4)";
            }
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        UIController.checkSyncStatus();
    },

    clearTextArea(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = '';
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        UIController.checkSyncStatus();
    }
};
