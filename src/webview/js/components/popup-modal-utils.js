export const PopupModalUtils = {
    makeResizable(modal) {
        modal.style.position = 'relative';
        modal.style.overflow = 'hidden';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';

        const handle = document.createElement('div');
        handle.style.cssText = 'position: absolute; right: 4px; bottom: 4px; width: 10px; height: 10px; cursor: se-resize; border-right: 2px solid var(--vscode-panel-border); border-bottom: 2px solid var(--vscode-panel-border); opacity: 0.6; z-index: 1000000;';
        modal.appendChild(handle);

        let isResizing = false;
        let startWidth, startHeight, startX, startY;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = modal.getBoundingClientRect().width;
            startHeight = modal.getBoundingClientRect().height;

            modal.style.width = `${startWidth}px`;
            modal.style.height = `${startHeight}px`;

            e.preventDefault();
            e.stopPropagation();

            const doResize = (moveEvent) => {
                if (!isResizing) return;
                modal.style.width = `${startWidth + (moveEvent.clientX - startX)}px`;
                modal.style.height = `${startHeight + (moveEvent.clientY - startY)}px`;
            };

            const stopResize = () => {
                isResizing = false;
                window.removeEventListener('mousemove', doResize);
                window.removeEventListener('mouseup', stopResize);
            };

            window.addEventListener('mousemove', doResize);
            window.addEventListener('mouseup', stopResize);
        });
    }
};
