import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cancelDialogs, finishDialog, getCurrentDialog, subscribeToDialogs } from './appDialogs';
import './AppDialogHost.css';

function AppDialog({ dialog }) {
    const ref = useRef(null);
    const inputRef = useRef(null);
    const cancelRef = useRef(null);
    const okRef = useRef(null);
    const titleId = useId();
    const messageId = useId();
    const errorId = useId();
    const [value, setValue] = useState(dialog.options.defaultValue || '');
    const [error, setError] = useState('');
    const { kind, message, options } = dialog;
    const title = options.title || (kind === 'confirm' ? 'Confirm action' : kind === 'prompt' ? 'Enter a value' : 'Living Atlas');
    const complete = result => {
        // Close while still connected so the browser restores the invoker's focus.
        ref.current.close();
        finishDialog(dialog, result);
    };
    const cancel = () => complete(kind === 'prompt' ? null : false);

    useEffect(() => {
        const element = ref.current;
        element.showModal();
        // Destructive confirmations default to Cancel, never an affirmative action.
        (inputRef.current || cancelRef.current || okRef.current)?.focus();
        return () => element.close();
    }, []);

    const submit = event => {
        event.preventDefault();
        const validation = kind === 'prompt' && options.validate?.(value);
        if (validation) {
            setError(validation);
            inputRef.current?.focus();
            return;
        }
        complete(kind === 'prompt' ? value : true);
    };

    return (
        <dialog ref={ref} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}
            onCancel={event => { event.preventDefault(); cancel(); }}>
            <form onSubmit={submit}>
                <header className="app-dialog-header">
                    <h2 id={titleId}>{title}</h2>
                    <button type="button" className="app-dialog-close" onClick={cancel} aria-label="Close dialog">×</button>
                </header>
                <div className="app-dialog-body">
                    <p id={messageId}>{message}</p>
                    {kind === 'prompt' && <>
                        <label htmlFor={`${titleId}-input`}>{options.inputLabel || 'Value'}</label>
                        <input ref={inputRef} id={`${titleId}-input`} value={value} autoComplete="off"
                            aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
                            onChange={event => { setValue(event.target.value); setError(''); }} />
                        {error && <p id={errorId} role="alert" className="app-dialog-error">{error}</p>}
                    </>}
                </div>
                <footer className="app-dialog-actions">
                    {kind !== 'alert' && <button ref={cancelRef} type="button" onClick={cancel}>Cancel</button>}
                    <button ref={okRef} type="submit" className="app-dialog-primary">{options.confirmLabel || (kind === 'alert' ? 'OK' : 'Confirm')}</button>
                </footer>
            </form>
        </dialog>
    );
}

export default function AppDialogHost() {
    const dialog = useSyncExternalStore(subscribeToDialogs, getCurrentDialog);
    useEffect(() => () => cancelDialogs(), []);
    // A new key resets input and native modal focus for each queued request.
    // ReactModal hides #root from assistive technology while a card is open.
    return dialog ? createPortal(<AppDialog key={dialog.id} dialog={dialog} />, document.body) : null;
}
