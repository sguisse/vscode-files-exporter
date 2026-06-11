export interface ExportConfig {
    src: string;
    dest: string;
    format: string;
    max_file: string;
    max_chunk: string;
    groupByExt: boolean;
    copyGeneratedFilesToClipboard: boolean;
    generateTreeView: boolean;
    logConsole: boolean;
    logFile: boolean;
    inc_paths: string;
    exc_paths: string;
    inc_ext: string;
    exc_ext: string;
}

export interface HistoryEntry {
    id: string;
    repo: string;
    display: string;
    frozen: boolean;
    config: ExportConfig;
}

export interface ExtensionState {
    selectedPaths: string[];
}
