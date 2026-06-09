# 🏗️ System Architecture & SOLID Blueprints

This document outlines the software engineering principles and component separations applied across the **Files Exporter** architecture.

## 🗺️ High-Level Component Topology
To ensure that processing gigabytes of text files never freezes the editor, the application is strictly decoupled into three layers:

```mermaid
flowchart TD
    subgraph Client [Presentation Layer - Webview UI iFrame]
        Canvas[webview.html Canvas] --> Ctrl[ui.controller.js Engine]
        Ctrl <--> Memory[state.manager.js Local State]
        Memory --> Modules[report-tab.js / tree-view-tab.js]
    end

    subgraph Host [Application Layer - VS Code Node.js Process]
        Router[message.router.ts Switchboard]
        History[history.service.ts JSON I/O]
        Orchestrator[export-orchestrator.service.ts]
        Env[config.service.ts Workspace Provider]
    end

    subgraph Execution [Worker Layer - Isolated Native OS Shell]
        Core[files-exporter.py CLI Core]
        Stream[Regex Scanner & Text Streamer]
        Disk[(Host File System OS)]
    end

    Client <-->|IPC Bridge: vscode.postMessage| Router
    Router <--> History
    Router <--> Env
    Router --> Orchestrator
    Orchestrator -->|spawn async child_process| Core
    Core --> Stream
    Stream <--> Disk
    Stream -->|Atomic Flush| Output[(Combined Chunks & Manifests)]
```

---

## 🧩 Architectural Layer Responsibilities

### 1. Presentation Layer (WebView Framework)
Runs inside a sandbox environment managed by VS Code.
* **Strict Theme Compliance**: `webview.html` avoids hardcoded hex color codes. It utilizes standard VS Code theme tokens (e.g., `var(--vscode-editor-background)`) to ensure the tool adapts perfectly to light, dark, or high-contrast user setups.
* **State Encapsulation**: `state.manager.js` retains a lightweight in-memory mirror of the parameters currently visible on screen.
* **Component Isolation**: Each workspace tab acts as an independent class (`report-tab.js`, `tree-view-tab.js`). This layout obeys the **Single Responsibility Principle (SRP)**: UI manipulation inside one tab cannot crash or bleed into another.

### 2. Application Layer (TypeScript Host Services)
Operates inside the core extension process.
* **`message.router.ts`**: Implements a decoupled messaging pattern. It receives JSON data packets from the webview, unpacks them, and routes the work to specific services.
* **`history.service.ts`**: Manages profile persistence. It reads and writes profile data atomically using `JSON.stringify`, preventing corruption if an export run is canceled midway.
* **`export-orchestrator.service.ts`**: Validates form inputs, maps UI options into rigorous terminal line parameters, and prepares the command context.

### 3. Worker Execution Layer (Python Engine)
Operates as an independent native operating system sub-process.
* **Memory Safety & Efficiency**: The Python `files-exporter.py` core reads file arrays using streaming buffers rather than loading whole directories into RAM simultaneously. This allows the tool to compile massive data exports without exceeding memory allocations or crashing the main editor process.

---

## 🔄 Two-Way Asynchronous State Synchronization
Maintaining clean data synchronization between the visual iFrame window and the backend host process is vital. Here is how the bidirectional pipeline works:
1. When a user types a path or clicks a setting, a `change` event fires, updating `state.manager.js`.
2. The UI pushes a `syncPaths` packet across the Inter-Process Communication (IPC) bridge.
3. The TypeScript backend catches this packet and immediately updates its internal workspace tracking state (`ExtensionState`).
4. If a separate backend routine updates the paths list (such as scanning modified Git files via `addGitDiffFiles`), the backend modifies the memory array securely and then pushes an `updatePaths` package back across the bridge to natively re-render the UI text fields.
