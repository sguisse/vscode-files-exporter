# 🐍 Python script workflow
Here is the Mermaid flowchart visualizing the step-by-step workflow of the `files-exporter.py` script:


## Overview

```mermaid
flowchart TD
    %% Trigger
    Trigger((VS Code UI Trigger)) --> CLI

    %% Main Python Workflow
    subgraph PythonEngine ["⚙️ files-exporter.py (Worker Execution Layer)"]
        direction TB

        CLI["📥 1. CLI Parameters Reception<br/>(Parses arguments via <i>argparse</i>)"]
        Filter["🔍 2. File Analysis & Filtering<br/>(Evaluates via <i>is_file_allowed</i>)"]
        Stream["🌊 3. Optimized Streaming Extraction<br/>(Buffers data via <i>StreamExporter</i>)"]
        Chunk["✂️ 4. Chunking & Grouping<br/>(Splits sizes via <i>open_new_chunk</i>)"]
        Report["📊 5. Reports & Metadata Generation<br/>(Finalizes exports & tracking)"]

        CLI -->|Passes target dirs & rules| Filter
        Filter -->|Valid files within size limits| Stream
        Stream -->|Formats to YAML/JSON/XML| Chunk
        Chunk -->|Sequence bundles| Report
    end

    %% Resulting Artifacts
    subgraph Outputs ["Final Export Artifacts"]
        direction TB
        Tree["🌲 -tree.json<br/>(Hierarchical map)"]
        JSON["📝 -report.json<br/>(Export metrics)"]
        Logs["💻 Execution Logs<br/>(Terminal / .log file)"]
    end

    Report -.->|create_tree_manifest| Tree
    Report -.->|create_json_report| JSON
    Report -.->|streams| Logs
```

### 🧩 Flowchart Breakdown:

*   **1. CLI Parameters Reception**: The script operates independently as a standalone command-line tool, collecting settings like `--src`, `--dest`, and `--max-file` through the `argparse` module.
*   **2. File Analysis & Filtering**: It uses the strict **`is_file_allowed`** function to run regex validation (for paths and extensions) while enforcing the `MAX_SIZE_BYTES` limit to prevent AI context bloat.
*   **3. Optimized Streaming**: Instead of exhausting system RAM, the tool pipelines data using **`StreamExporter`**, wrapping it safely into your requested layout (e.g., YAML, XML, JSON).
*   **4. Chunking & Grouping**: To respect strict AI token limits, it dynamically slices outputs via the **`open_new_chunk`** function and regroups them by file extensions if the `--group-ext` flag is enabled.
*   **5. Reports Generation**: The execution completes by invoking **`create_tree_manifest`** (for the directory hierarchy) and **`create_json_report`** (for detailed metrics), while the custom `log` function streams real-time data back to VS Code.
