#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────────
# STEP 1: PATCH THE WEBVIEW CONTROLLER (src/webview/main.js) DELTA INJECTIONS
# ────────────────────────────────────────────────────────────────────────────────
node -e '
const fs = require("fs");
const file = "src/webview/main.js";

if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");

    // 1. Rewrite explodeRegexFilter to match the exact requirement
    const oldExplodeFilter = `function explodeRegexFilter(regexStr) {
    const [noExtensionPart, extensionsPart] = regexStr.split(\x27|\x27);
    if (!extensionsPart) {
        return [regexStr];
    }
    const extensionsMatch = extensionsPart.match(/\\((?:\\?:)?([^)]+)\\)/);
    if (!extensionsMatch) {
        return [regexStr];
    }
    const extensions = extensionsMatch[1].split(\x27|\x27);
    const individualExtensions = extensions.map(ext => \x60.*\\\\.\x24{ext}$\x60);
    return [noExtensionPart, ...individualExtensions];
}`;

    const newExplodeFilter = `function explodeRegexFilter(regexStr) {
    const [noExtensionPart, extensionsPart] = regexStr.split(\x27|\x27);
    if (!extensionsPart) return [regexStr];
    const extensionsMatch = extensionsPart.match(/\\((?:\\?:)?([^)]+)\\)/);
    if (!extensionsMatch) return [regexStr];
    const extensions = extensionsMatch[1].split(\x27|\x27);
    return [noExtensionPart, ...extensions.map(ext => ".*\\\\." + ext + "$")];
}`;

    if (content.includes(oldExplodeFilter)) {
        content = content.replace(oldExplodeFilter, newExplodeFilter);
    }

    // 2. Rewrite sortTextAreaLines to correctly cycle ASC/DESC and toggle arrow-down / arrow-up icons
    const oldSortTextAreaLines = `const sortTextAreaLines = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const btn = document.getElementById(\x60btn-sort-\x24{id}\x60);
    const icon = btn?.querySelector(\x27.codicon\x27);
    let dir = btn?.getAttribute(\x27data-dir\x27) || \x27asc\x27;

    let lines = el.value.split(\x27\\n\x27).map(l => l.trim()).filter(l => l);
    lines.sort((a, b) => a.localeCompare(b));
    el.value = lines.join(\x27\\n\x27);
    el.dispatchEvent(new Event(\x27input\x27, { bubbles: true }));
    el.dispatchEvent(new Event(\x27change\x27, { bubbles: true }));
};`;

    const newSortTextAreaLines = `const sortTextAreaLines = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const btn = document.getElementById("btn-sort-" + id);
    const icon = btn?.querySelector(".codicon");
    let dir = btn?.getAttribute("data-dir") || "asc";

    let lines = el.value.split("\\n").map(l => l.trim()).filter(l => l);

    if (dir === "asc") {
        lines.sort((a, b) => a.localeCompare(b));
        if (btn) btn.setAttribute("data-dir", "desc");
        if (icon) {
            icon.classList.remove("codicon-arrow-down");
            icon.classList.add("codicon-arrow-up");
        }
    } else {
        lines.sort((a, b) => b.localeCompare(a));
        if (btn) btn.setAttribute("data-dir", "asc");
        if (icon) {
            icon.classList.remove("codicon-arrow-up");
            icon.classList.add("codicon-arrow-down");
        }
    }

    el.value = lines.join("\\n");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    UIController.checkSyncStatus();
};`;

    if (content.includes(oldSortTextAreaLines)) {
        content = content.replace(oldSortTextAreaLines, newSortTextAreaLines);
    }

    // 3. Rewrite explodeTextAreaRegex to process line-by-line, sort the results, and trigger sync updates
    const oldExplodeTextAreaRegex = `const explodeTextAreaRegex = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const exploded = explodeRegexFilter(el.value);
    el.value = exploded.join(\x27\\n\x27);
    el.dispatchEvent(new Event(\x27input\x27, { bubbles: true }));
    el.dispatchEvent(new Event(\x27change\x27, { bubbles: true }));
};`;

    const newExplodeTextAreaRegex = `const explodeTextAreaRegex = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    let lines = el.value.split("\\n").map(l => l.trim()).filter(l => l);
    let explodedLines = [];
    lines.forEach(line => {
        if (line.startsWith("#")) {
            explodedLines.push(line);
        } else {
            explodedLines.push(...explodeRegexFilter(line));
        }
    });
    explodedLines = Array.from(new Set(explodedLines)).sort((a, b) => a.localeCompare(b));
    el.value = explodedLines.join("\\n");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    UIController.checkSyncStatus();
};`;

    if (content.includes(oldExplodeTextAreaRegex)) {
        content = content.replace(oldExplodeTextAreaRegex, newExplodeTextAreaRegex);
    }

    // 4. Rewrite groupTextAreaExtensions to support toggling state and background highlighting variables
    const oldGroupTextAreaExtensions = `const groupTextAreaExtensions = (id) => {
    const el = document.getElementById(id);
    if (!el || !state.predefinedInclusions) return;
    const lines = el.value.split(\x27\\n\x27).map(l => l.trim()).filter(l => l);
    const groupedLines = [];

    state.predefinedInclusions.forEach(category => {
        const catExtensions = category.extensions.map(ext => ext.replace(/^\x5e\x2a/, \x27\x27).trim().replace(/^\x5e\x2e/, \x27\x27));
        const matchedInCat = [];

        lines.forEach(line => {
            const extMatch = line.match(/\\\x2e\\\*\x5c\x5c\\\x2e\x28\x5b\x5e\x24\x5d\x2b\x29\x5c\x24/);
            if (extMatch && catExtensions.includes(extMatch[1])) {
                matchedInCat.push(line);
            }
        });

        if (matchedInCat.length > 0) {
            matchedInCat.sort((a, b) => a.localeCompare(b));
            groupedLines.push(\x60# --- \x24{category.label} ---\x60);
            groupedLines.push(...matchedInCat);
        }
    });

    const matchedWithCat = [];
    state.predefinedInclusions.forEach(category => {
        const catExtensions = category.extensions.map(ext => ext.replace(/^\x5e\x2a/, \x27\x27).trim().replace(/^\x5e\x2e/, \x27\x27));
        lines.forEach(line => {
            const extMatch = line.match(/\\\x2e\\\*\x5c\x5c\\\x2e\x28\x5b\x5e\x24\x5d\x2b\x29\x5c\x24/);
            if (extMatch && catExtensions.includes(extMatch[1])) {
                matchedWithCat.push(line);
            }
        });
    });

    const remaining = lines.filter(l => !matchedWithCat.includes(l) && !l.startsWith(\x27#\x27));
    if (remaining.length > 0) {
        remaining.sort((a, b) => a.localeCompare(b));
        groupedLines.push(\x27# --- Miscellaneous ---\x27);
        groupedLines.push(...remaining);
    }

    el.value = groupedLines.join(\x27\\n\x27);
    el.dispatchEvent(new Event(\x27input\x27, { bubbles: true }));
    el.dispatchEvent(new Event(\x27change\x27, { bubbles: true }));
};`;

    const newGroupTextAreaExtensions = `const groupTextAreaExtensions = (id) => {
    const el = document.getElementById(id);
    if (!el || !state.predefinedInclusions) return;
    const btn = document.getElementById("btn-group-" + id);
    let isGrouped = btn?.getAttribute("data-grouped") === "true";

    let lines = el.value.split("\\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

    if (isGrouped) {
        lines.sort((a, b) => a.localeCompare(b));
        el.value = lines.join("\\n");
        if (btn) {
            btn.setAttribute("data-grouped", "false");
            btn.style.background = "";
        }
    } else {
        const groupedLines = [];
        state.predefinedInclusions.forEach(category => {
            const catExtensions = category.extensions.map(ext => ext.replace(/^\\*/, "").trim().replace(/^\\./, ""));
            const matchedInCat = [];

            lines.forEach(line => {
                const extMatch = line.match(/\\.\\*\\\\\\.([^$]+)\\x24/);
                if (extMatch && catExtensions.includes(extMatch[1])) {
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
        state.predefinedInclusions.forEach(category => {
            const catExtensions = category.extensions.map(ext => ext.replace(/^\\*/, "").trim().replace(/^\\./, ""));
            lines.forEach(line => {
                const extMatch = line.match(/\\.\\*\\\\\\.([^$]+)\\x24/);
                if (extMatch && catExtensions.includes(extMatch[1])) {
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

        el.value = groupedLines.join("\\n");
        if (btn) {
            btn.setAttribute("data-grouped", "true");
            btn.style.background = "var(--vscode-button-background, #007fd4)";
        }
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    UIController.checkSyncStatus();
};`;

    if (content.includes(oldGroupTextAreaExtensions)) {
        content = content.replace(oldGroupTextAreaExtensions, newGroupTextAreaExtensions);
    }

    fs.writeFileSync(file, content, "utf8");
}
'

echo "✅ Script modified. Filter sorting state toggle cycle and codicon layout icon alternation are fixed!"
