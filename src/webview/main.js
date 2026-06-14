import { InitializationManager } from './js/core/initialization.manager.js';
import { ReportTab } from './components/report-tab.js';
import { FilesTab } from './components/files-tab.js';
import { TreeViewTab } from './components/tree-view-tab.js';
import { TerminalTab } from './components/terminal-tab.js';
import { HelpTab } from './components/help-tab.js';

const tabs = {
    reportTab: new ReportTab(),
    filesTab: new FilesTab(),
    treeViewTab: new TreeViewTab(),
    terminalTab: new TerminalTab(),
    helpTab: new HelpTab()
};

window.addEventListener('message', (event) => {
    InitializationManager.handleMessage(event.data, tabs);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => InitializationManager.init(tabs));
} else {
    InitializationManager.init(tabs);
}
