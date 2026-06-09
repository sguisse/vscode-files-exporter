export class TerminalTab {
    append(text) {
        const term = document.getElementById('terminal');
        if (term) {
            term.innerText += text;
            term.scrollTop = term.scrollHeight;
        }
    }

    clear() {
        const term = document.getElementById('terminal');
        const cmd = document.getElementById('terminal-cmd');
        if (term) term.innerText = "";
        if (cmd) cmd.value = "";
    }

    updateCommand(text) {
        const cmd = document.getElementById('terminal-cmd');
        if (cmd) cmd.value = text;
    }

    copyCommand() {
        const cmd = document.getElementById('terminal-cmd').value;
        if (cmd) {
            navigator.clipboard.writeText(cmd);
            this.append("\n✨ Command copied to clipboard!\n");
        }
    }
}
