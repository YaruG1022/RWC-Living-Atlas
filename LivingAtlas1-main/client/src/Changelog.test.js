import React from 'react';
import { render, screen } from '@testing-library/react';
import Modal from 'react-modal';
import ChangelogModal from './ChangelogModal';
import ChangelogHistory from './ChangelogHistory';
import { guiReleases } from './latestGuiUpdates';

test('dialog and history display the same categorized release with earlier history preserved', () => {
    const appRoot = document.createElement('div');
    document.body.appendChild(appRoot);
    Modal.setAppElement(appRoot);
    const dialog = render(<ChangelogModal isOpen onClose={() => {}} />, { container: appRoot });
    expect(guiReleases.slice(0, 4).map(release => release.date)).toEqual(['11/6/2026', '10/26/2026', '10/24/2026', '10/18/2026']);
    expect(screen.getByText('Update Date: 11/6/2026').closest('details').open).toBe(true);
    expect(screen.getByText('Update Date: 9/27/2026').closest('details').open).toBe(false);
    for (const [index, release] of guiReleases.entries()) {
        const section = screen.getByText(`Update Date: ${release.date}`).closest('details');
        expect(section.open).toBe(index === 0);
        for (const group of release.groups) {
            expect(screen.getByRole('heading', { name: group.title })).toBeTruthy();
            for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
        }
    }
    expect(screen.queryByText('Update Date: 11/11/2026')).not.toBeInTheDocument();
    expect(screen.queryByText('Update Date: 10/25/2026')).not.toBeInTheDocument();
    const modalDates = screen.getAllByRole('heading', { name: /^Update Date:/ }).slice(0, guiReleases.length).map(heading => heading.textContent);
    dialog.unmount();
    appRoot.remove();
    render(<ChangelogHistory />);
    expect(screen.getAllByRole('heading', { name: /^Update Date:/ }).slice(0, guiReleases.length).map(heading => heading.textContent)).toEqual(modalDates);
    expect(screen.getByText('Update Date: 9/27/2026')).toBeTruthy();
    for (const release of guiReleases) {
        for (const group of release.groups) {
            for (const item of group.items) expect(screen.getByText(item)).toBeTruthy();
        }
    }
    expect(screen.queryByText('Update Date: 11/11/2026')).not.toBeInTheDocument();
    expect(screen.queryByText('Update Date: 10/25/2026')).not.toBeInTheDocument();
});
