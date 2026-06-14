#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────────
# DECOUPLE PATH VALIDATION: DELEGATE RENDERING STRICTLY TO VALIDATOR.SERVICE
# ────────────────────────────────────────────────────────────────────────────────
node -e '
const fs = require("fs");

// 1. Upgrade ValidatorService to accept a skipBackend loop-breaker flag
const valFile = "src/webview/js/services/validator.service.js";
if (fs.existsSync(valFile)) {
    let content = fs.readFileSync(valFile, "utf8");

    // Inject the skipBackend loop-breaker into the execution signature
    content = content.replace(
        "executeFieldValidation(id, silentMode = false) {",
        "executeFieldValidation(id, silentMode = false, skipBackend = false) {"
    );

    // Prevent the validator from triggering another backend IPC check if it is just consuming the backend'\''s reply
    content = content.replace(
        "if (id === \x27pathList\x27 && !silentMode) {",
        "if (id === \x27pathList\x27 && !silentMode && !skipBackend) {"
    );

    fs.writeFileSync(valFile, content, "utf8");
}

// 2. Gut the UI logic out of checkPathsResult and delegate to ValidatorService
const mainFile = "src/webview/main.js";
if (fs.existsSync(mainFile)) {
    let content = fs.readFileSync(mainFile, "utf8");

    const startIndex = content.indexOf("case \x27checkPathsResult\x27:");
    const endIndex = content.indexOf("case \x27updatePaths\x27:");

    if (startIndex !== -1 && endIndex !== -1) {
        const newBlock = `case \x27checkPathsResult\x27:
            state.invalidPathsPayload = message.invalidPaths || [];
            // Trigger the validator to handle the UI rendering, but skip sending a new backend request
            ValidatorService.executeFieldValidation(\x27pathList\x27, false, true);
            break;\n        `;

        content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
        fs.writeFileSync(mainFile, content, "utf8");
    }
}
'

echo "✅ Script modified. Path validation UI logic strictly centralized into ValidatorService!"
