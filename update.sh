#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────────────────────────────
# FILES EXPORTER - ATOMIC DELTA TOOLTIP CORRECTION PATCH
# ───────────────────────────────────────────────────────────────────────────────────────────────────
# This targeted script isolates and patches exactly the requested tooltip string attribute inside
# src/webview/webview.html using a localized stream sed replacement to ensure precise integration.

set -e

TARGET_FILE="src/webview/webview.html"

# Verify file existence before attempting atomic modification loops
if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ Error: $TARGET_FILE not found in the workspace root directory context."
    exit 1
fi

echo "⚙️ Applying precise streaming inline modification patch to tooltip layout attributes..."

# Use standard cross-platform sed replacement matching the specific kebab button definition context
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS BSD sed syntax version execution layout
    sed -i '' 's/data-tooltip="Predefined extension inclusions"/data-tooltip="Predefined extension inclusions. Press \&lt;strong\&gt;Ctrl\/Cmd\&lt;\/strong\&gt; key to \&lt;strong\&gt;replace\&lt;\/strong\&gt; content, instead adding them."/g' "$TARGET_FILE"
else
    # Linux GNU sed syntax version execution layout
    sed -i 's/data-tooltip="Predefined extension inclusions"/data-tooltip="Predefined extension inclusions. Press \&lt;strong\&gt;Ctrl\/Cmd\&lt;\/strong\&gt; key to \&lt;strong\&gt;replace\&lt;\/strong\&gt; content, instead adding them."/g' "$TARGET_FILE"
fi

echo "⚡ Recompiling target workspace assets..."
npm run compile

echo "✅ Delta patch applied smoothly! The tooltip now accurately describes modifier key replacement mechanics."
