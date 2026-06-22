export const FiltersSimulator = {

    /**
     * Apply all filters to a given string
     * @param {string} input - The string to test against all filters
     * @returns {boolean} - True if the string matches all filters, false otherwise
     */
    applyFilters(input) {
        console.info ("input = " + input);

        // If input is empty, return true (no filter applied)
        if (!input || input.trim() === '') {
            return true;
        }

        // Get all filter values
        const incPaths = document.getElementById('incPaths').value;
        const incExts = document.getElementById('incExts').value;
        const excPaths = document.getElementById('excPaths').value;
        const excExts = document.getElementById('excExts').value;

        // Check include paths filter
        if (incPaths && incPaths.trim() !== '') {
            const incPathsRegex = new RegExp(incPaths, 'i');
            if (!incPathsRegex.test(input)) {
                return false;
            }
        }

        // Check include extensions filter
        if (incExts && incExts.trim() !== '') {
            const incExtsRegex = new RegExp(incExts, 'i');
            if (!incExtsRegex.test(input)) {
                return false;
            }
        }

        // Check exclude paths filter
        if (excPaths && excPaths.trim() !== '') {
            const excPathsRegex = new RegExp(excPaths, 'i');
            if (excPathsRegex.test(input)) {
                return false;
            }
        }

        // Check exclude extensions filter
        if (excExts && excExts.trim() !== '') {
            const excExtsRegex = new RegExp(excExts, 'i');
            if (excExtsRegex.test(input)) {
                return false;
            }
        }

        return true;
    },

    /**
     * Update the emoji indicator based on filter results
     * @param {string} input - The string to test
     */
    updateEmoji(input) {
        const filterSimulatorInput = document.getElementById('filters-simulator-input');
        const filterSimulatorEmoji = document.getElementById('filters-simulator-emoji');

        if (!filterSimulatorInput) return;

        console.info ("filterSimulatorEmoji.innerHTML before = " + filterSimulatorEmoji.innerHTML);

        if (!input || input.trim() === '') {
            filterSimulatorEmoji.innerHTML = '❓';
            filterSimulatorEmoji.setAttribute('data-tooltip', "Fill 'Filter Simulator' field to check if Filters match.");
        } else {
            const isValid = this.applyFilters(input);
            console.info ("isValid = " + isValid);
            if (isValid) {
                filterSimulatorEmoji.innerHTML =  '✅';
                filterSimulatorEmoji.setAttribute('data-tooltip', 'The input <strong>match</strong> the Filters.');
            }
            else {
                filterSimulatorEmoji.innerHTML =  '❌'
                filterSimulatorEmoji.setAttribute('data-tooltip', 'The input <strong>not match</strong> the Filters.');
            }

            console.info ("filterSimulatorEmoji.innerHTML after = " + filterSimulatorEmoji.innerHTML);
        }
    }

}
