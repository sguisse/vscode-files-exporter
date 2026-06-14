import { state } from '../core/state.manager.js';
import { bridge } from '../core/vscode.bridge.js';

export const ValidatorService = {
    validateRegexSyntax(val) {
        if (!val || !val.trim()) return null;
        const lines = val.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                try { new RegExp(trimmed); }
                catch (e) { return `Invalid regex on line: "${trimmed}"`; }
            }
        }
        return null;
    },
    validatePathList(val) {
        // Always reset path validity state before performing evaluations
        state.pathListInvalid = false;

        if (!val || !val.trim()) {
            state.pathListInvalid = true;
            return "At least one source path is required.";
        }

        // Split paths by structural separators
        const paths = val.split(/[\n,;]/).map(p => p.trim()).filter(p => p);

        // Iterate through paths, if an asynchronous invalid marker exists in payload matching the line item, drop run immediately
        for (const rawPath of paths) {
            if (state.invalidPathsPayload && state.invalidPathsPayload.includes(rawPath)) {
                state.pathListInvalid = true;
                return "The path '" + rawPath + "' does not exist on the local file system.";
            }
        }

        return null;
    },
    validators: {
        pathList: (val) => ValidatorService.validatePathList(val),
        destDir: (val) => val.trim().length > 0 ? null : "Destination directory path is required.",
        maxFile: (val) => {
            const cleanVal = val.trim();
            if (!cleanVal || isNaN(Number(cleanVal))) return "Must be a strict positive number. No letters allowed.";
            return Number(cleanVal) > 0 ? null : "Must be a positive number greater than 0.";
        },
        maxChunk: (val) => {
            const cleanVal = val.trim();
            if (!cleanVal || isNaN(Number(cleanVal))) return "Must be a strict non-negative number. No letters allowed.";
            return Number(cleanVal) >= 0 ? null : "Must be a non-negative number (0 for unlimited).";
        },
        incPaths: (val) => ValidatorService.validateRegexSyntax(val),
        excPaths: (val) => ValidatorService.validateRegexSyntax(val),
        incExts: (val) => ValidatorService.validateRegexSyntax(val),
        excExts: (val) => ValidatorService.validateRegexSyntax(val),
        filterFileName: (val) => ValidatorService.validateRegexSyntax(val),
        filterFileContent: (val) => ValidatorService.validateRegexSyntax(val)
    },
    executeFieldValidation(id, silentMode = false, skipBackend = false) {
        const el = document.getElementById(id);
        if (!el) return true;
        const validator = this.validators[id];
        if (!validator) return true;

        const errorMsg = validator(el.value);
        if (errorMsg) {
            if (!silentMode) {
                el.classList.add('field-invalid');
                if (!el.hasAttribute('data-orig-tooltip')) el.setAttribute('data-orig-tooltip', el.getAttribute('data-tooltip') || '');
                el.setAttribute('data-tooltip', `⚠️ Error: ${errorMsg}`);
            }
            if (id === 'pathList') state.pathListInvalid = true;
            return false;
        } else {
            if (id === 'pathList' && !silentMode && !skipBackend) {
                const paths = el.value.split(/[\n,;]/).map(p => p.trim()).filter(p => p);
                if (paths.length > 0) bridge.postMessage('checkPaths', { paths });
            }
            el.classList.remove('field-invalid');
            if (el.hasAttribute('data-orig-tooltip')) {
                const originalTooltip = el.getAttribute('data-orig-tooltip');
                if (originalTooltip) el.setAttribute('data-tooltip', originalTooltip);
                else el.removeAttribute('data-tooltip');
                el.removeAttribute('data-orig-tooltip');
            }
            if (id === 'pathList' && !state.invalidPathsPayload?.length) state.pathListInvalid = false;

            if (id === 'destDir' || id === 'pathList') {
                const workspaceRoot = state.defaultSettings?.src || '';
                const linesToCheck = id === 'pathList' ? el.value.split('\n').map(p => p.trim()).filter(p => p) : [el.value.trim()];

                let isOutsideWorkspace = false;
                linesToCheck.forEach(line => {
                    if (line && !line.startsWith('#') && workspaceRoot) {
                        let cleanLine = line.replace(/^['"]|['"]$/g, '').trim();
                        if (!cleanLine.toLowerCase().startsWith(workspaceRoot.toLowerCase())) {
                            isOutsideWorkspace = true;
                        }
                    }
                });

                let baseTooltip = el.getAttribute('data-tooltip') || '';
                const warningMsg = "⚠️ You reference a folder outside current Workspace";
                baseTooltip = baseTooltip.replace(new RegExp('\\s*' + warningMsg.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '').trim();

                if (isOutsideWorkspace && linesToCheck.length > 0 && linesToCheck[0] !== '') {
                    el.style.setProperty('--input-background', '#fff9c4', 'important');
                    el.style.setProperty('--background-color', '#fff9c4', 'important');
                    el.style.backgroundColor = '#fff9c4';

                    const finalTooltip = baseTooltip ? `${baseTooltip}\n${warningMsg}` : warningMsg;
                    el.setAttribute('data-tooltip', finalTooltip);
                } else {
                    el.style.removeProperty('--input-background');
                    el.style.removeProperty('--background-color');
                    el.style.backgroundColor = '';

                    if (baseTooltip) {
                        el.setAttribute('data-tooltip', baseTooltip);
                    } else {
                        el.removeAttribute('data-tooltip');
                    }
                }
            }
            return true;
        }
    },
    clearAllValidationStyles() {
        Object.keys(this.validators).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('field-invalid');
                el.style.removeProperty('--input-background');
                el.style.removeProperty('--background-color');
                el.style.backgroundColor = '';
                if (el.hasAttribute('data-orig-tooltip')) {
                    const originalTooltip = el.getAttribute('data-orig-tooltip');
                    if (originalTooltip) el.setAttribute('data-tooltip', originalTooltip);
                    else el.removeAttribute('data-tooltip');
                    el.removeAttribute('data-orig-tooltip');
                }

                let currentTooltip = el.getAttribute('data-tooltip') || '';
                const warningMsg = "⚠️ You reference a folder outside current Workspace";
                currentTooltip = currentTooltip.replace(new RegExp('\\s*' + warningMsg.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '').trim();
                if (currentTooltip) {
                    el.setAttribute('data-tooltip', currentTooltip);
                } else {
                    el.removeAttribute('data-tooltip');
                }
            }
        });
        state.pathListInvalid = false;
        state.invalidPathsPayload = [];
    }
};
