#!/usr/bin/env bash

# 1. Update user-guide.md safely without shell expansion side effects
python3 << 'EOF'
import os

filepath = 'user-guide.md'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    # Sync Serialization Options
    old_serialization = '* **Tree view**: It generate a file storing only the folder structure of exported files, used by the tab `Tree View` to display more efficiently exported files.'
    new_serialization = old_serialization + '\n* **Copy to clip**: Automatically copies generated export files directly to your OS clipboard after each successful export run.\n* **Log Console**: Toggles streaming log outputs directly into the extension webview terminal view interface.\n* **Log File**: Enables saving a physical log tracking tracing file inside your configured destination folder.'

    if old_serialization in text and 'Copy to clip' not in text:
        text = text.replace(old_serialization, new_serialization)

    # Sync Context Menus titles with package.json settings mapping
    replacements = {
        '* **Files Exporter --> Open UI:**': '* **Files Exporter - 01 --> 🎛️ Open UI:**',
        '* **Files Exporter --> Add from Explorer:**': '* **Files Exporter - 02 --> ➕ Sources Paths:**',
        '* **Files Exporter --> 🚫 Exclude paths:**': '* **Files Exporter - 03 --> 🚫 Exclude paths:**',
        '* **Files Exporter --> 📤 Export selected paths:**': '* **Files Exporter - 04 --> 📥 Export selected paths:**'
    }

    for old_menu, new_menu in replacements.items():
        text = text.replace(old_menu, new_menu)

    # Add the newly added copySelectedFilesToClipboard menu action to manual guide section
    target_line = '* **Files Exporter - 04 --> 📥 Export selected paths:** Triggers a "Headless" background export.'
    added_line = target_line + '\n* **Files Exporter - 05 --> 📋 Copy selected files:** Recursively harvests all absolute paths within your selection to copy them to the clipboard. Automatically prompts a safety warning popup if payload exceeds 50 files or 5MB.'
    if target_line in text and '05 --> 📋 Copy selected files' not in text:
        text = text.replace(target_line, added_line)

    # Sync notification sub-actions descriptions
    target_alt = '        * **Notifications:** You will receive a rich notification with the export metrics and a button to quickly copy the source paths if needed.'
    added_alt = target_alt + '\n      * **Files Exporter - 05 --> 📋 Copy selected files:** Traverses all selected files and folder branches recursively to gather absolute paths and commit them to the OS clipboard via the Python service runner. Includes a performance safety guardrail modal warning if the collection crosses 50 files or 5 megabytes.'
    if target_alt in text and 'Files Exporter - 05 -->' not in text:
        text = text.replace(target_alt, added_alt)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
EOF

# 2. Update README.md safely using a clean string Heredoc input stream
python3 << 'EOF'
import os

filepath = 'README.md'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    old_block = '* **🎛️ Open UI / Add from Explorer:** Launch the tool or append paths to your active selection.\n* **🚫 Exclude paths:** Automatically generate and inject regex exclusions. *(Note: To keep your context menu clean, this option is only visible when the Files Exporter UI tab is actively open).*'
    new_block = '* **Files Exporter - 01 --> 🎛️ Open UI / 02 --> ➕ Sources Paths:** Launch the primary cockpit interface or append explorer elements directly into active source arrays.\n* **Files Exporter - 03 --> 🚫 Exclude paths:** Injects specialized regex exclusions directly into filters. Visible exclusively while the toolkit webview panel is active.'

    if old_block in text:
        text = text.replace(old_block, new_block)

    text = text.replace('* **📤 Export selected paths:**', '* **Files Exporter - 04 --> 📥 Export selected paths:**')

    target = '* **Files Exporter - 04 --> 📥 Export selected paths:** Runs a silent headless export. A rich notification will pop up upon completion, and the generated files are instantly copied to your clipboard.'
    addition = target + '\n* **Files Exporter - 05 --> 📋 Copy selected files:** Performs a deep recursive file discovery walk across chosen folders to stage absolute paths onto your clipboard. Governed by a safety modal guardrail warning triggering at 50+ files or 5MB+ size constraints.'

    if target in text and '05 --> 📋 Copy selected files' not in text:
        text = text.replace(target, addition)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
EOF

# 3. Update architecture.md safely protecting Markdown backticks from Bash substitution execution
python3 << 'EOF'
import os

filepath = 'architecture.md'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    target_anchor = '* `filters-simulator.js`: Manages user input debouncing and delegates Regex evaluation via the VS Code bridge to the actual Python engine.'

    additions = (
        '\n* `files-tab.js`: Handles file presentation lists, content pattern queries, and routes native filesystem workspace opening tasks.\n'
        '* `terminal-tab.js`: Dedicated streaming window mapping raw CLI feedback and manual subprocess orchestration operations.\n'
        '* `help-tab.js`: Powers inline user manual presentation layouts and interactive clipboard prompt reference builders.\n'
        '* `pricing-service.js`: Aggregates modular sub-calculators (`pricing-gemini-service.js`, `pricing-gpt-service.js`, `pricing-claude-service.js`) to parse input character matrices into actionable developer financial projections.'
    )

    if target_anchor in text and 'files-tab.js' not in text:
        text = text.replace(target_anchor, target_anchor + additions)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
EOF

# 4. Update faq.md safely bypasses BSD/GNU sed platform issues using Python stream injection
python3 << 'EOF'
import os

filepath = 'faq.md'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    old_faq = 'The Files Exporter --> 🚫 Exclude paths command is dynamically hidden when the extension\'s UI is closed.'
    new_faq = 'The Files Exporter - 03 --> 🚫 Exclude paths command is dynamically hidden when the extension\'s UI is closed.'
    text = text.replace(old_faq, new_faq)

    old_faq_clip = 'During a headless background export, the extension automatically copies the **generated output files**'
    new_faq_clip = 'During a headless background export via Files Exporter - 04 --> 📥 Export selected paths, the extension automatically copies the **generated output files**'
    text = text.replace(old_faq_clip, new_faq_clip)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
EOF

## ✅ Script updated. Using a quoted 'EOF' Heredoc now completely shields all documentation backticks from broken Bash command evaluation routines!
