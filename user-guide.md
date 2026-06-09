# 📖 Extension Interface User Guide for Beginners

Welcome to the Files Exporter interface! This reference guide explains every button, setting, and dashboard tab so you can start preparing context packages for AI development like a pro.

## 🎛️ The Main Control Cockpit

### 1. Configuration History Profiles (Top Row)
Think of this section as your "Saved Configuration Slots." Once you create perfect filters, you can save them here.
* **Dropdown Registry**: Select a saved profile. Choosing `< Default Configuration >` clears your screen and restores your default system settings.
* **Lock/Unlock Button (`codicon-unlock` / `codicon-lock`)**: Locks your profile settings. When locked, you cannot accidentally overwrite your complex regular expressions or filter rules.
* **Pencil Button (`codicon-edit`)**: Opens a prompt box to give your active configuration profile a clear name (e.g., "Export React Code Only").
* **Duplicate Button (`codicon-files`)**: Copies your current settings into a fresh profile slot so you can experiment with variations.
* **Trash Button (`codicon-trash`)**: Permanently purges profiles. Offers "Soft" deletion (moves them to a `.del` backup file) or "Hard" deletion (absolute erase).

### 2. Path & Source File Selectors
* **Source Paths Textbox (`pathList`)**: Type or paste the folders or files you want to combine. You can separate paths using newlines, commas, or semicolons. If you type a path that does not exist on your computer, the textbox instantly flashes in a red pastel color to warn you.
* **Active Tabs File Inserter (`codicon-go-to-file`)**: Click this to automatically read the paths of all code files you currently have open in your active VS Code tabs.
* **Git Sync Delta Button (`codicon-git-compare`)**: Automatically checks which files have changed between your computer and the remote repository, adding only those modified files to the list. Great for asking an AI: *"Can you review my recent code changes?"*

### 3. File Restrictions & Regex Filtering
* **Max File (KB)**: Any file larger than this number is ignored. This keeps huge database files or video files from bloating your output.
* **Include Paths / Exclude Paths Textareas**: Advanced filters using Regular Expressions (Regex). For example, typing `.*/node_modules/.*` inside Exclude Paths tells the engine to skip heavy dependency folders entirely.
* **Include Exts / Exclude Exts Textareas**: Filter by file type. Want only Python? Type `.*\.py$` inside Include Exts. Want to ignore compiled files? Type `.*\.pyc$` in Exclude Exts.

### 4. Serialization Options
* **Output Format**: Choose the structure of your output file. **YAML** is highly recommended for ChatGPT/Gemini because AI models read its layout efficiently. **XML** is ideal for Google NotebookLM.
* **Max Chunk (KB)**: Set this to `500` to automatically split a large export into multiple files of 500KB each. Set to `0` to keep everything in one single file.
* **Split by Ext**: Check this if you want different file types saved in separate files.

---

## 📊 Understanding the Analytics & Tabs (Bottom Layout)

Once you click **🚀 RUN EXPORT**, the results panels activate at the bottom of the screen.

### 1. REPORT Tab
Displays metrics for every file extension discovered. It shows exactly how many files were safely exported, how many were rejected (too large), and how many were excluded by filters. It also includes an interactive, responsive pie chart visualizing the file composition.

### 2. FILES Tab
Lists the exact files generated on your computer. You can click any file line item to open it in your VS Code editor, or click the folder icon (📂) to reveal it directly in Windows Explorer or macOS Finder.

### 3. TREE VIEW Tab
This is a visual file explorer of your export manifest. It maps your files using a hierarchical tree.
* **Search Bar**: Type any word to quickly filter your files or extension groups.
* **3-State Checkboxes**: Selecting a folder checks all its underlying subfiles. If you only select *some* files inside a folder, the folder checkbox automatically displays a minus dash (`-`) to represent an accurate indeterminate state.
* **Export Button (`codicon-export`)**: Captures the absolute paths of all currently checked files, sending them back to your source paths list for your next export run.

### 4. TERMINAL Tab
Shows the raw background process logs.
* **Command Bar**: Automatically prints the exact shell terminal command built from your visual settings. Click the copy button (`codicon-copy`) to run this headless command in an external shell pipeline or server.
* **Shell Console**: Emulates a real IDE terminal window, displaying timestamps, process metrics tables, system diagnostics, and background tracing details.
