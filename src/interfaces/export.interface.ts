export interface ExportConfig {
    src: string;
    dest: string;
    format: string;
    max_file: string;
    max_chunk: string;
    groupByExt: boolean;
    logConsole: boolean;
    logFile: boolean;
    inc_paths: string;
    exc_paths: string;
    inc_ext: string;
    exc_ext: string;
}

export interface HistoryEntry {
    id: string;
    display: string;
    config: ExportConfig;
    frozen: boolean; // Ajout du flag de verrouillage
}

export interface ExtensionState {
    selectedPaths: string[];
}
