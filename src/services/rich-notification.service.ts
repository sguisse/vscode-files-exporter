import * as vscode from 'vscode';

export type NotificationPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

export type NotificationType = 'info' | 'warn' | 'error' | 'success';

export interface NotificationAction {
    label: string;
    command: string;
    data?: any;
}

export interface RichNotificationOptions {
    type?: NotificationType;
    position?: NotificationPosition;
    header?: string;
    message?: string;    // Rich HTML for the Webview
    durationMs?: number;
    actions?: NotificationAction[];
}

export class RichNotificationService {
    constructor(private panel: vscode.WebviewPanel | undefined) {}

    public setPanel(panel: vscode.WebviewPanel | undefined) {
        this.panel = panel;
    }

    /**
     * Displays a rich notification. Routes to Webview if available, otherwise falls back to native VS Code UI.
     */
    public show(
        fallbackText: string, // Plain text for native VS Code UI
        options: RichNotificationOptions = {},
        callback?: (command: string, payload: any) => void
    ) {
        const type = options.type || 'info';
        const position = options.position || 'bottom-right';
        const durationMs = options.durationMs || 3000;

        // 1. Send to Webview if it is currently active and visible
        if (this.panel && this.panel.visible) {
            this.panel.webview.postMessage({
                command: 'showRichNotification',
                payload: {
                    text: options.message || fallbackText,
                    header: options.header,
                    type,
                    position,
                    durationMs,
                    actions: options.actions
                }
            });
            // Note: To handle button clicks inside the Webview, your MessageRouter
            // will need to listen for the specific commands returned by the UI.
            return;
        }

        // 2. Fallback to native VS Code notifications (positioning ignored by VS Code)
        this.fallbackToNative(fallbackText, type, options.actions, callback);
    }

    private fallbackToNative(
        text: string,
        type: NotificationType,
        actions?: NotificationAction[],
        callback?: (command: string, payload: any) => void
    ) {
        // Extract just the labels for VS Code native buttons (Filter out "Dismiss" as native has an 'X')
        const actionLabels = actions
            ? actions.filter(a => a.label !== "Dismiss").map(a => a.label)
            : [];

        let promise: Thenable<string | undefined>;

        switch (type) {
            case 'error':
                promise = vscode.window.showErrorMessage(text, ...actionLabels);
                break;
            case 'warn':
                promise = vscode.window.showWarningMessage(text, ...actionLabels);
                break;
            default: // Handles both 'info' and 'success'
                promise = vscode.window.showInformationMessage(text, ...actionLabels);
                break;
        }

        // Handle the button click natively
        promise.then(selection => {
            if (selection && actions && callback) {
                const selectedAction = actions.find(a => a.label === selection);
                if (selectedAction) {
                    callback(selectedAction.command, selectedAction.data);
                }
            }
        });
    }
}
