import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RichTextEditor from './RichTextEditor';
import { resolveDescriptionAttachments, appendDescriptionFileTokens } from './descriptionAttachments';

beforeAll(() => {
    Range.prototype.getClientRects = () => [];
    Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
    let token = 0;
    global.crypto = { randomUUID: () => `aaaaaaaa-aaaa-aaaa-aaaa-${String(++token).padStart(12, '0')}` };
});

test('inserts a link and rejects unsafe addresses', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }));
    const panel = screen.getByRole('dialog');
    fireEvent.change(screen.getByLabelText('Display text'), { target: { value: 'Reference' } });
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Insert link' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'example.com/report' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Insert link' }));
    expect(onChange.mock.calls.at(-1)[0]).toContain('href="https://example.com/report"');
    expect(onChange.mock.calls.at(-1)[0]).toContain('Reference');
});

test('edits and removes an existing link without deleting its text', () => {
    const onChange = jest.fn();
    const { unmount } = render(<RichTextEditor value='<p><a href="https://example.com">Original</a></p>' onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }));
    expect(screen.getByLabelText('Display text').value).toBe('Original');
    fireEvent.change(screen.getByLabelText('Display text'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByLabelText('Link address'), { target: { value: 'https://example.com/new' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Insert link' }));
    expect(onChange.mock.calls.at(-1)[0]).toContain('Updated');
    expect(onChange.mock.calls.at(-1)[0]).not.toContain('Original');
    const saved = onChange.mock.calls.at(-1)[0];
    unmount();
    render(<RichTextEditor value={saved} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove link' }));
    expect(onChange.mock.calls.at(-1)[0]).toBe('<p>Updated</p>');
});

test('inserts an existing attachment reference without hardcoding the API host', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="" onChange={onChange} attachments={[{ fileid: 42, filename: '报告.txt' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert file' }));
    fireEvent.click(screen.getByRole('button', { name: '报告.txt' }));
    expect(onChange.mock.calls.at(-1)[0]).toContain('/downloadFile?fileID=42');
    const html = resolveDescriptionAttachments(onChange.mock.calls.at(-1)[0], 'http://localhost:8000/');
    expect(html).toContain('href="http://localhost:8000/downloadFile?fileID=42"');
    expect(html).not.toContain('target=');
});

test('queues a selected file, inserts its draft reference and serializes the token', () => {
    const onChange = jest.fn(), onInsertFiles = jest.fn();
    render(<RichTextEditor value="" onChange={onChange} onInsertFiles={onInsertFiles} />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert file' }));
    const input = screen.getByLabelText('Insert files into description');
    expect(input.multiple).toBe(true);
    const file = new File(['report'], 'report.txt', { type: 'text/plain' });
    const second = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file, second] } });
    expect(onInsertFiles).toHaveBeenCalledWith([file, second]);
    expect(onChange.mock.calls.at(-1)[0]).toContain(`#pending-file-${file.descriptionToken}`);
    expect(onChange.mock.calls.at(-1)[0]).toContain(`#pending-file-${second.descriptionToken}`);
    expect(onChange.mock.calls.at(-1)[0].indexOf('report.txt')).toBeLessThan(onChange.mock.calls.at(-1)[0].indexOf('notes.txt'));
    const data = new FormData();
    appendDescriptionFileTokens(data, [file]);
    expect(JSON.parse(data.get('description_file_tokens'))).toEqual([file.descriptionToken]);
});
