export const SplitPane = {
    init(resizerId, leftId, rightId) {
        const resizer = document.getElementById(resizerId);
        const left = document.getElementById(leftId);
        const right = document.getElementById(rightId);

        if (!resizer || !left || !right) return;

        let isResizing = false;
        let startX, startWidth;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = left.getBoundingClientRect().width;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerWidth = left.parentElement.getBoundingClientRect().width;
            const newWidth = startWidth + (e.clientX - startX);
            const percentage = (newWidth / containerWidth) * 100;

            if (percentage > 10 && percentage < 90) {
                left.style.flex = `0 0 ${percentage}%`;
                right.style.flex = '1';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
            }
        });
    }
};
