import { bridge } from '../core/vscode.bridge.js';

export const FiltersSimulator = {
    timeoutId: null,

    updateEmoji(input) {
        const filterSimulatorEmoji = document.getElementById('filters-simulator-emoji');
        if (!filterSimulatorEmoji) return;

        if (!input || input.trim() === '') {
            filterSimulatorEmoji.innerHTML = '❓';
            filterSimulatorEmoji.setAttribute('data-tooltip', "Fill 'Filter Simulator' field to check if Filters match.");
            return;
        }

        filterSimulatorEmoji.innerHTML = '⏳';
        filterSimulatorEmoji.setAttribute('data-tooltip', 'Simulating against Python engine...');

        if (this.timeoutId) clearTimeout(this.timeoutId);

        this.timeoutId = setTimeout(() => {
            const payload = {
                input: input.trim(),
                incPaths: document.getElementById('incPaths')?.value || '',
                excPaths: document.getElementById('excPaths')?.value || '',
                incExts: document.getElementById('incExts')?.value || '',
                excExts: document.getElementById('excExts')?.value || ''
            };

            console.info('=========================================');
            console.info('[Simulator UI] 📤 Sending payload to Backend:', payload);
            bridge.postMessage('simulateFilters', payload);

        }, 500);
    },

    updateEmojiResult(code) {
        console.info('[Simulator UI] 📥 Received Result Code:', code);
        console.info('=========================================');

        const filterSimulatorEmoji = document.getElementById('filters-simulator-emoji');
        if (!filterSimulatorEmoji) return;

        if (code === 0) {
            filterSimulatorEmoji.innerHTML = '✅';
            filterSimulatorEmoji.setAttribute('data-tooltip', 'The input <strong>matches</strong> the Filters.');
        } else if (code === 1) {
            filterSimulatorEmoji.innerHTML = '❌';
            filterSimulatorEmoji.setAttribute('data-tooltip', 'The input <strong>does not match</strong> the Filters.');
        } else {
            filterSimulatorEmoji.innerHTML = '⚠️';
            filterSimulatorEmoji.setAttribute('data-tooltip', '<strong>Error</strong> evaluating Regex in Python engine.');
        }
    }
};
