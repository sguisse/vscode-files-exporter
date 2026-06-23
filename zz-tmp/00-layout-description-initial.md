# 🚀 Graphify: VS Code Webview UI Architecture

## 🎯 Application Objective

**Graphify** serves as an interactive, visual exploration and structural analysis tool directly integrated into the developer's IDE environment. Its primary goal is to bridge the gap between raw source code and high-level system architecture. By ingesting a structural map (`graph.json`), it translates codebases into synchronized hierarchical trees and interactive node-based network graphs.

This enables developers to visually map dependencies, isolate specific domains via robust filtering, conduct pre-refactoring impact analysis (viewing parent/child invocation chains), and leverage an integrated AI Assistant (Gemini) to instantly audit, explain, or improve complex architectural clusters.

---

## 🏗️ Global Webview Container

* **Layout:** Full-viewport (`100vh`, `100vw`), locked scrolling (`overflow: hidden`) to behave like a native VS Code editor tab.
* **Theming Context:** Must seamlessly inherit standard VS Code CSS variables (e.g., `var(--vscode-editor-background)`, `var(--vscode-foreground)`) rather than hardcoded colors, ensuring automatic adaptation to the user's active VS Code theme (Light, Dark, or High Contrast).

## 🪧 Action Toolbar (Top Header)

* **Layout:** Flexbox Row, sticky to the top, vertically centered, mimicking a native VS Code breadcrumb or title bar.
* **Left Section (Branding):** * App icon and title, kept minimal to save vertical space.
* **Right Section (Primary Actions):**
* **Theme Toggle:** Replaced by native VS Code theme tracking (can be omitted in a pure native extension as the Webview auto-updates).
* **View Selection Button:** A primary `<vscode-button>` to open the detailed selection popup.
* **Load Data Action:** Instead of a standard file upload, this should ideally be an action that triggers a `vscode.postMessage` to the extension backend to pick the `graph.json` from the active workspace.



## 🔍 Exploration Filters (Collapsible Panel)

* **Layout:** A native `<details>` element or a `<vscode-accordion>` taking up full width just below the header.
* **Content Grid:** A responsive 3-column layout.
* **Column 1 (Types):** A multi-select box (or a series of `<vscode-checkbox>` elements) for entity types (Classes, Methods, Files).
* **Column 2 (Search):** A `<vscode-text-field>` coupled with a `<vscode-dropdown>` for match conditions (Contains, Exact, Regex toggle).
* **Column 3 (Targets):** Toggles to dictate whether the filters apply to the Tree View, the Graph View, or both.



## 🗂️ Main Workspace (VS Code Tabbed Interface)

* **Layout:** A `<vscode-panels>` component (from the Webview UI Toolkit) taking up the remaining `flex-1` space.

### 🕸️ Tab 1: Explorer View (Split Layout)

* **Layout:** A resizable split pane, heavily mirroring the VS Code primary sidebar and editor relationship.
* **Left Pane (Hierarchical Tree):**
* Takes ~30% width. Resizable horizontally.
* Features a top utility row (grouping dropdown, sort order, clear selection).
* Contains a native-feeling Tree View displaying folders, files, classes, and methods with expandable carets and multi-select checkboxes.


* **Right Pane (Network Graph):**
* Takes remaining width.
* **Top Toolbar:** Small inline inputs for "Depth" (Appelants/Appelés) and a "Recadrer" (Fit to screen) button.
* **Canvas:** Absolute positioned container for Vis.js to render the interactive physics-based node graph.
* **Legend:** Absolute positioned overlay in the bottom-left corner mapping node colors to their respective types.



### ✨ Tab 2: AI Assistant (Gemini)

* **Layout:** Two-column grid (Sidebar + Main Editor area).
* **Left Sidebar (Controls):** Contains the context summary ("You have X nodes selected") and a primary `<vscode-button>` to "Lancer l'analyse".
* **Main Area (Output):** A stylized output window simulating a read-only VS Code text editor. It receives Markdown output from the Gemini API and renders it with standard VS Code markdown styling (code blocks, bold text, lists).

### ⚙️ Tab 3: Configuration

* **Layout:** Scrollable Flex Column.
* **Header:** Title and a primary `<vscode-button>` to Save & Apply.
* **Editor:** A large text area for JSON editing. In a native Webview, this should ideally utilize a lightweight Monaco Editor instance or a highly styled `<vscode-text-area>` configured for monospaced code to allow users to tweak node colors and shapes based on file extensions.

## 🪟 Selection Overlay (Modal View)

* **Trigger:** Clicked from the top toolbar.
* **Layout:** A full-screen semi-transparent backdrop containing a centered, elevated modal card (utilizing `var(--vscode-notifications-background)` and `var(--vscode-widget-shadow)`).
* **Structure:**
* **Header:** Title and close icon.
* **Filter Strip:** Quick-toggle badges to filter the currently selected items by type.
* **List View:** A scrollable, clean list of every selected node, showing its icon, name, and underlying file path.
* **Footer:** Action area containing the "Close" button.
