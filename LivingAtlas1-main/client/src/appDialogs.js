// One queue keeps messages visible even when the originating panel closes.
const requests = [];
const listeners = new Set();
let nextId = 0;

function notify() {
    listeners.forEach(listener => listener());
}

function request(kind, message, options = {}) {
    return new Promise(resolve => {
        requests.push({ id: ++nextId, kind, message: String(message), options, resolve });
        notify();
    });
}

export const showAppAlert = (message, options) => request('alert', message, options);
export const showAppConfirm = (message, options) => request('confirm', message, options);
export const showAppPrompt = (message, options) => request('prompt', message, options);

export function subscribeToDialogs(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export const getCurrentDialog = () => requests[0] || null;

export function finishDialog(dialog, value) {
    if (requests[0] !== dialog) return;
    requests.shift();
    notify();
    dialog.resolve(value);
}

export function cancelDialogs() {
    requests.splice(0).forEach(dialog => dialog.resolve(dialog.kind === 'prompt' ? null : false));
    notify();
}
