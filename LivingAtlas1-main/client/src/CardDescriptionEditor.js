import React, { useEffect, useId, useRef, useState } from 'react';
import api from './api';
import { prepareImagePreview } from './imageUploads';
import RichTextEditor from './RichTextEditor';
import { htmlToPlainText } from './richTextUtils';
import './CardDescriptionEditor.css';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

function collectLinks(links, description) {
    const document = new DOMParser().parseFromString(description, 'text/html');
    const inlineLinks = Array.from(document.querySelectorAll('a[href]'), anchor => ({
        url: anchor.getAttribute('href'),
        text: anchor.textContent,
    })).filter(link => /^https?:\/\//i.test(link.url));
    const unique = new Map();
    for (const link of [...links, ...inlineLinks]) {
        const url = link.url?.trim();
        if (url && !unique.has(url)) unique.set(url, { url, text: link.text?.trim() || '' });
    }
    return [...unique.values()];
}

async function imageForDescription({ file, previewUrl }, signal) {
    const hasPreview = previewUrl?.startsWith('blob:');
    if (!hasPreview && file.size <= MAX_SOURCE_BYTES) return file;
    const temporaryUrl = hasPreview ? null : await prepareImagePreview(file, signal);
    try {
        const preview = await fetch(temporaryUrl || previewUrl, { signal });
        if (!preview.ok) throw new Error('Unable to read preview.');
        return await preview.blob();
    } catch (error) {
        if (!signal.aborted && file.size <= MAX_SOURCE_BYTES) return file;
        throw error;
    } finally {
        if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    }
}

async function buildRequest({ title, links, description, images, files, cardId, imageIds, fileIds, includeThumbnail }, signal) {
    const sourceLinks = collectLinks(links, description);
    const uniqueImages = [...new Map(images.filter(image => image.file).map(image => [image.file, image])).values()];
    if (!sourceLinks.length && !uniqueImages.length && !files.length && !imageIds.length && !fileIds.length && !includeThumbnail) {
        throw new Error('Add a link, image, or file to generate a description.');
    }
    const body = new FormData();
    body.append('title', title || '');
    body.append('links', JSON.stringify(sourceLinks));
    if (cardId) {
        body.append('card_id', cardId);
        body.append('image_ids', JSON.stringify(imageIds));
        body.append('file_ids', JSON.stringify(fileIds));
        body.append('include_thumbnail', String(includeThumbnail));
    }

    const warnings = [];
    let uploadedBytes = 0;
    if (uniqueImages.length > 8) warnings.push('Only the first 8 new images can be used in a draft.');
    if (files.length > 12) warnings.push('Only the first 12 new files can be used in a draft.');
    for (const image of uniqueImages.slice(0, 8)) {
        let blob;
        try {
            blob = await imageForDescription(image, signal);
        } catch (error) {
            if (signal.aborted) throw error;
            warnings.push(`Could not prepare ${image.file.name} for generation.`);
            continue;
        }
        if (blob.size > MAX_SOURCE_BYTES || uploadedBytes + blob.size > MAX_UPLOAD_BYTES) {
            warnings.push(`Skipped ${image.file.name} because it exceeded the generation upload limit.`);
            continue;
        }
        body.append('images', blob, image.file.name);
        uploadedBytes += blob.size;
    }
    for (const file of files.slice(0, 12)) {
        if (!file.size) {
            warnings.push(`Skipped ${file.name} because it is empty.`);
            continue;
        }
        if (file.size > MAX_SOURCE_BYTES || uploadedBytes + file.size > MAX_UPLOAD_BYTES) {
            warnings.push(`Skipped ${file.name} because it exceeded the generation upload limit.`);
            continue;
        }
        body.append('files', file);
        uploadedBytes += file.size;
    }
    if (!sourceLinks.length && !uploadedBytes && !imageIds.length && !fileIds.length && !includeThumbnail) {
        throw new Error('None of the selected images or files could be prepared. Try a smaller file or add a link.');
    }
    return { body, warnings };
}

function draftToHtml(text) {
    return text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(paragraph => {
        const escaped = document.createElement('p');
        escaped.textContent = paragraph;
        return `<p>${escaped.innerHTML.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

function generationError(error) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    if (status === 401) return 'Sign in again to generate a description.';
    if (status === 404) return 'Description generation is unavailable or this project is no longer accessible.';
    if (status === 413) return 'These sources are too large. Try fewer images or files.';
    if (typeof detail === 'string') return detail;
    if (error.code === 'ECONNABORTED') return 'Generation timed out. Try again with fewer sources.';
    if (error.code === 'ERR_NETWORK') return 'Unable to reach the server. Check your connection and try again.';
    return error.response ? 'Could not generate a description. Please try again.' : error.message || 'Could not generate a description.';
}

export default function CardDescriptionEditor({
    value = '', onChange, title, links = [], images = [], files = [], cardId,
    imageIds = [], fileIds = [], includeThumbnail = false, optional = false, disabled = false,
    onboardingTarget, ...editorProps
}) {
    const labelId = useId();
    const currentValue = useRef(value);
    currentValue.current = value;
    const activeRequest = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [draft, setDraft] = useState('');
    const [notice, setNotice] = useState('');
    const [warnings, setWarnings] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => () => activeRequest.current?.abort(), []);
    useEffect(() => {
        if (disabled && activeRequest.current) {
            activeRequest.current.abort();
            activeRequest.current = null;
            setIsGenerating(false);
        }
    }, [disabled]);

    const generate = async () => {
        if (activeRequest.current || disabled) return;
        const controller = new AbortController();
        activeRequest.current = controller;
        setIsGenerating(true);
        setDraft('');
        setNotice('');
        setWarnings([]);
        setError('');
        try {
            const request = await buildRequest({
                title, links, description: value, images, files, cardId, imageIds, fileIds, includeThumbnail,
            }, controller.signal);
            if (controller.signal.aborted) return;
            const { data } = await api.post('/cards/generate-description', request.body, {
                signal: controller.signal, skipRetry: true, timeout: 120000,
            });
            if (controller.signal.aborted) return;
            const generated = typeof data?.description === 'string' ? data.description.trim().slice(0, 2000) : '';
            if (!generated) throw new Error('The service did not return a description. Please try again.');
            setWarnings([...request.warnings, ...(Array.isArray(data.warnings) ? data.warnings : [])]);
            if (htmlToPlainText(value) || currentValue.current !== value) {
                setDraft(generated);
                setNotice('Draft ready. Use it to replace the current description.');
            } else {
                onChange(draftToHtml(generated));
                setNotice('Draft added to Description.');
            }
        } catch (requestError) {
            if (!controller.signal.aborted) setError(generationError(requestError));
        } finally {
            if (activeRequest.current === controller && !controller.signal.aborted) {
                activeRequest.current = null;
                setIsGenerating(false);
            }
        }
    };

    return (
        <div className="card-description" data-onboarding-target={onboardingTarget}>
            <div className="card-description-heading">
                <strong id={labelId}>Description{optional ? ' (optional)' : ''}</strong>
                <button className="card-description-button" type="button" disabled={disabled || isGenerating} onClick={generate}>
                    {isGenerating ? 'Generating…' : 'Generate with AI'}
                </button>
            </div>
            {(isGenerating || notice) && <div className="card-description-feedback" role="status">
                {isGenerating ? 'Reading sources and generating a draft…' : notice}
            </div>}
            {error && <div className="card-description-feedback card-description-error" role="alert">{error}</div>}
            {warnings.length > 0 && <ul className="card-description-warnings" aria-label="Sources skipped">
                {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>}
            {draft && <div className="card-description-preview">
                <div>{draft}</div>
                <div className="card-description-actions">
                    <button className="card-description-button" type="button" disabled={disabled} onClick={() => {
                        onChange(draftToHtml(draft));
                        setDraft('');
                        setNotice('Draft added to Description.');
                    }}>Use draft</button>
                    <button className="card-description-button" type="button" onClick={() => {
                        setDraft('');
                        setNotice('');
                        setWarnings([]);
                    }}>Discard draft</button>
                </div>
            </div>}
            <RichTextEditor {...editorProps} value={value} onChange={onChange} labelledBy={labelId} />
        </div>
    );
}
