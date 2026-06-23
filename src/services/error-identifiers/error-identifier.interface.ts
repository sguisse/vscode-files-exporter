export interface RelatedErrorFilesIdentificator {
    searchFiles(content: string, workspaceRoot: string, onStderr?: (data: string) => void, includeOutWorkspace?: boolean): Promise<string[]>;
}
