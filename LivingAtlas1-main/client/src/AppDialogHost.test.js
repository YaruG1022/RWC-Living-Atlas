import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import AppDialogHost from './AppDialogHost';
import Modal from 'react-modal';
import { showAppAlert, showAppConfirm, showAppPrompt } from './appDialogs';

// JSDOM has no top layer; real-browser checks cover inertness, focus trapping and restoration.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterAll(() => {
    delete HTMLDialogElement.prototype.showModal;
    delete HTMLDialogElement.prototype.close;
});
afterEach(cleanup);

test('confirmation waits for an explicit choice, focuses Cancel, and Escape declines', async () => {
    render(<AppDialogHost />);
    let result;
    act(() => { result = showAppConfirm('Delete this image?'); });
    const settled = jest.fn();
    result.then(settled);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(settled).not.toHaveBeenCalled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    await expect(result).resolves.toBe(false);
    act(() => { result = showAppConfirm('Delete this image?'); });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await expect(result).resolves.toBe(true);
});

test('prompt validates inline, preserves input and returns the submitted value', async () => {
    render(<AppDialogHost />);
    let result;
    act(() => { result = showAppPrompt('Choose a name.', {
        title: 'New Folder', inputLabel: 'Folder name', confirmLabel: 'Create Folder',
        validate: name => !name.trim() ? 'Enter a folder name.' : name === 'Existing' ? 'Name already exists.' : '',
    }); });
    const input = screen.getByRole('textbox', { name: 'Folder name' });
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a folder name.');
    fireEvent.change(input, { target: { value: 'Existing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    expect(input).toHaveValue('Existing');
    expect(screen.getByRole('alert')).toHaveTextContent('Name already exists.');
    fireEvent.change(input, { target: { value: 'Rivers' } });
    fireEvent.submit(input.closest('form'));
    await expect(result).resolves.toBe('Rivers');
});

test.each(['Cancel', 'Close dialog'])('closing a prompt with %s returns null', async name => {
    render(<AppDialogHost />);
    let result;
    act(() => { result = showAppPrompt('Choose a name.'); });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name }));
    await expect(result).resolves.toBeNull();
});

test('queued messages retain order and reset the input between prompts', async () => {
    render(<AppDialogHost />);
    let alert, first, second;
    act(() => {
        alert = showAppAlert('Saved.');
        first = showAppPrompt('First name');
        second = showAppPrompt('Second name');
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(alert).resolves.toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await expect(first).resolves.toBe('First');
    expect(screen.getByText('Second name')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(second).resolves.toBeNull();
});

test('unmount cancels pending requests instead of leaving callers suspended', async () => {
    const { unmount } = render(<AppDialogHost />);
    let result;
    act(() => { result = showAppConfirm('Continue?'); });
    unmount();
    await expect(result).resolves.toBe(false);
});

test('a confirmation stays accessible above an existing ReactModal', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    Modal.setAppElement(root);
    let result;
    const view = render(<><Modal isOpen contentLabel="Card details">
        <button onClick={() => { result = showAppConfirm('Delete this project?'); }}>Delete project</button>
    </Modal><AppDialogHost /></>, { container: root });
    try {
        fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
        const dialog = screen.getByRole('dialog', { name: 'Confirm action' });
        expect(root).toHaveAttribute('aria-hidden', 'true');
        expect(dialog.parentElement).toBe(document.body);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await expect(result).resolves.toBe(false);
        expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
    } finally {
        view.unmount();
        root.remove();
    }
});
