import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CardDescriptionEditor from './CardDescriptionEditor';
import api from './api';

jest.mock('./api', () => ({ post: jest.fn() }));

const links = [{ url: 'https://example.invalid/report', text: 'Survey' }];
const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }));

beforeEach(() => api.post.mockReset());

test('handles no sources without a model request', async () => {
    const onChange = jest.fn();
    render(<CardDescriptionEditor onChange={onChange} />);
    generate();
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a link, image, or file');
    expect(api.post).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
});

test('inserts plain model text in the actual editor and shows skipped sources', async () => {
    api.post.mockResolvedValue({ data: {
        description: 'River & lake\n\n<img src="remote">', warnings: ['Unable to read survey.pdf.'],
    } });
    function Field() {
        const [value, setValue] = React.useState('');
        return <CardDescriptionEditor links={links} value={value} onChange={setValue} />;
    }
    render(<Field />);
    generate();
    await screen.findByText('Draft added to Description.');
    const editor = screen.getByRole('textbox', { name: 'Description' });
    expect(editor).toHaveTextContent('River & lake');
    expect(editor).toHaveTextContent('<img src="remote">');
    expect(editor.querySelector('img')).toBeNull();
    expect(screen.getByText('Unable to read survey.pdf.')).toBeInTheDocument();
});

test('uses the prepared gallery image and retains the original source name', async () => {
    const originalFetch = global.fetch;
    const file = new File(['original image'], 'survey.png', { type: 'image/png' });
    const preview = new Blob(['preview'], { type: 'image/webp' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => preview });
    try {
        api.post.mockResolvedValue({ data: { description: 'Image draft' } });
        render(<CardDescriptionEditor images={[{ file, previewUrl: 'blob:preview' }]} onChange={jest.fn()} />);
        generate();
        await screen.findByText('Draft added to Description.');
        const image = api.post.mock.calls[0][1].get('images');
        expect(image.name).toBe('survey.png');
        expect(image.type).toBe('image/webp');
        expect(image.size).toBe(preview.size);
    } finally {
        global.fetch = originalFetch;
    }
});

test('a late result preserves text entered during generation until explicitly applied', async () => {
    let resolve;
    api.post.mockImplementation(() => new Promise(next => { resolve = next; }));
    const onChange = jest.fn();
    const { rerender } = render(<CardDescriptionEditor links={links} onChange={onChange} />);
    generate();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
    rerender(<CardDescriptionEditor links={links} value="<p>User edits</p>" onChange={onChange} />);
    await act(async () => resolve({ data: { description: 'Generated draft' } }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveTextContent('User edits');
    fireEvent.click(screen.getByRole('button', { name: 'Use draft' }));
    expect(onChange).toHaveBeenCalledWith('<p>Generated draft</p>');
});

test('closing the form aborts a pending request and drops a late response', async () => {
    let resolve;
    api.post.mockImplementation(() => new Promise(next => { resolve = next; }));
    const onChange = jest.fn();
    const { unmount } = render(<CardDescriptionEditor links={links} onChange={onChange} />);
    generate();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const { signal, skipRetry } = api.post.mock.calls[0][2];
    expect(skipRetry).toBe(true);
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ data: { description: 'Late draft' } }));
    expect(onChange).not.toHaveBeenCalled();
});
