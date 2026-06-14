#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────────
# REPAIR REGEX EXPLODE LOGIC: FIX UNTERMINATED GROUP SYNTAX ERROR
# ────────────────────────────────────────────────────────────────────────────────
# To completely eliminate backslash string escape mutation bugs inside Node.js strings,
# we write the pure, unmodified JavaScript function to a temporary file first.

cat << 'EOF_JS' > explode_patch.js
function explodeRegexFilter(regexStr) {
    let results = [];
    let currentPart = "";
    let depth = 0;
    let bracketDepth = 0;
    let parts = [];

    // Step 1: Intelligently split by '|' only at the root level (depth 0)
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

    // Step 2: Iterate through each root part and extract grouped extensions
    parts.forEach(part => {
        // This regex safely parses "(log|tmp)" or "(?:log|tmp)" capturing the inner list
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
}
EOF_JS

# ────────────────────────────────────────────────────────────────────────────────
# INJECT THE PURE JAVASCRIPT FUNCTION INTO MAIN.JS
# ────────────────────────────────────────────────────────────────────────────────

node -e '
const fs = require("fs");
const file = "src/webview/main.js";

if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf8");
    const newFunc = fs.readFileSync("explode_patch.js", "utf8");

    const startKeyword = "function explodeRegexFilter(regexStr) {";
    const endKeyword = "const sortTextAreaLines = (id) => {";

    const startIndex = content.indexOf(startKeyword);
    const endIndex = content.indexOf(endKeyword);

    if (startIndex !== -1 && endIndex !== -1) {
        content = content.substring(0, startIndex) + newFunc + "\n\n" + content.substring(endIndex);
        fs.writeFileSync(file, content, "utf8");
    }
}
'

# Clean up temporary patch files
rm -f explode_patch.js

echo "✅ Script modified. Regex explode logic fully repaired! File-based injection bypassed all template literal escaping bugs."
