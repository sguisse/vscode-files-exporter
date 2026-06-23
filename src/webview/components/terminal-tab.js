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
        if (cmd) cmd.innerHTML = "";
    }

    updateCommand(text) {
        const cmd = document.getElementById('terminal-cmd');
        if (cmd) cmd.innerHTML = this.splitCommandToMultiLine(text);
    }

    copyCommand() {
        const cmd = document.getElementById('terminal-cmd').innerText;
        if (cmd) {
            navigator.clipboard.writeText(cmd);
            this.append("\n✨ Command copied to clipboard!\n");
        }
    }

    splitCommandToMultiLine(cmdStr) {
        // Regex to match flags, arguments with arguments, or quoted strings accurately
        const regex = /'[^']*'|"[^"]*"|[^\s"']+/g;
        const tokens = cmdStr.match(regex);

        if (!tokens) return '';

        const lines = [];
        // Keep the base command and the script path on the first line
        lines.push(`${tokens[0]} ${tokens[1]}`);

        // Loop through the remaining arguments
        for (let i = 2; i < tokens.length; i++) {
            const token = tokens[i];

            if (token.startsWith('--')) {
            // If the next token doesn't start with '--', pair them up on the same line
            if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
                lines.push(`  ${token} ${tokens[i + 1]}`);
                i++; // Skip the next token since we paired it
            } else {
                // Flag-only parameter (like --log-console or --tree-view)
                lines.push(`  ${token}`);
            }
            } else {
            lines.push(`  ${token}`);
            }
        }

        // Join lines with backslashes for bash/zsh multi-line execution compatibility
        return lines.join(' \\ <br/>');
    }

}
