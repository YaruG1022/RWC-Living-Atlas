import React from 'react';
import { render, screen } from '@testing-library/react';
import Modal from 'react-modal';
import ChangelogModal from './ChangelogModal';
import ChangelogHistory from './ChangelogHistory';
import { latestGuiUpdateDate, latestGuiUpdates, previousGuiUpdateDate, previousGuiUpdates, contactGuiUpdateDate, contactGuiUpdates } from './latestGuiUpdates';

test('dialog and history display the same categorized release with earlier history preserved', () => {
    const appRoot = document.createElement('div');
    document.body.appendChild(appRoot);
    Modal.setAppElement(appRoot);
    const dialog = render(<ChangelogModal isOpen onClose={() => {}} />, { container: appRoot });
    expect(screen.getByText(`Update Date: ${latestGuiUpdateDate}`).closest('details').open).toBe(true);
    expect(screen.getByText('Update Date: 9/27/2026').closest('details').open).toBe(false);
    expect(screen.getByText(`Update Date: ${previousGuiUpdateDate}`).closest('details').open).toBe(false);
    expect(screen.getByText(`Update Date: ${contactGuiUpdateDate}`).closest('details').open).toBe(false);
    for (const group of contactGuiUpdates) for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
    for (const group of previousGuiUpdates) {
        for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
    }
    for (const group of latestGuiUpdates) {
        expect(screen.getByRole('heading', { name: group.title })).toBeTruthy();
        for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
    }
    dialog.unmount();
    appRoot.remove();
    render(<ChangelogHistory />);
    expect(screen.getByText(`Update Date: ${latestGuiUpdateDate}`)).toBeTruthy();
    expect(screen.getByText('Update Date: 9/27/2026')).toBeTruthy();
    expect(screen.getByText(`Update Date: ${previousGuiUpdateDate}`)).toBeTruthy();
    expect(screen.getByText(`Update Date: ${contactGuiUpdateDate}`)).toBeTruthy();
    for (const group of contactGuiUpdates) for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
    for (const group of previousGuiUpdates) {
        for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
    }
    for (const group of latestGuiUpdates) {
        for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
    }
});
