// Keep saved attachment references independent of the frontend/backend host.
export const attachmentHref = id => `/downloadFile?fileID=${encodeURIComponent(id)}`;
export const pendingAttachmentHref = token => `#pending-file-${token}`;
export function appendDescriptionFileTokens(data, files) {
    data.append('description_file_tokens', JSON.stringify((files || []).map(file => file.descriptionToken || null)));
}
export function resolveDescriptionAttachments(html, baseURL) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (/^\/downloadFile\?fileID=\d+$/.test(href)) {
            link.setAttribute('href', `${baseURL.replace(/\/$/, '')}${href}`);
            link.removeAttribute('target');
        }
    });
    return doc.body.innerHTML;
}
