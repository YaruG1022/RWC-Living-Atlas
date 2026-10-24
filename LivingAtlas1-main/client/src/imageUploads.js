import api from './api';

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 160000000;
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/bmp';
// Mirror the responsive gallery grid when framing a not-yet-created image.
export function galleryFrameAspect(count, index = 0, viewportWidth = window.innerWidth) {
    const total = Math.max(1, Math.min(6, count));
    const gap = viewportWidth <= 600 ? 4 : 8;
    const columns = total === 1 ? 1 : total === 2 || total === 4 || (total === 5 && index < 2) ? 2 : 3;
    const rows = total >= 4 ? 2 : 1;
    const width = (Math.min(1000, viewportWidth) - gap * (columns - 1)) / columns;
    const height = (Math.min(380, Math.max(280, viewportWidth * .42)) - gap * (rows - 1)) / rows;
    return width / height;
}

export const defaultPresentation = () => ({ fit: 'cover', x: 50, y: 50, zoom: 1 });
export const presentationOf = image => ({ ...defaultPresentation(), ...(image?.presentation || {}) });
export const framingStyle = image => {
    const p = presentationOf(image);
    return { objectFit: p.fit, objectPosition: p.fit === 'contain' ? '50% 50%' : `${p.x}% ${p.y}%`, transform: p.fit === 'contain' ? 'none' : `scale(${p.zoom})`, transformOrigin: `${p.x}% ${p.y}%` };
};
export const imageUploadError = error => typeof error.response?.data?.detail === 'string' ? error.response.data.detail
    : error.message && !/network|timeout/i.test(error.message) ? error.message
    : 'Upload interrupted. Check your connection and retry this image.';
export const uploadPercent = event => event.total ? Math.min(100, Math.round(event.loaded * 100 / event.total)) : null;
export const uploadToken = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function validateImage(file) {
    if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)) throw new Error('Use a PNG, JPG, WebP, GIF or BMP image.');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Image exceeds 50 MiB. Choose a smaller original file.');
}

// Read only headers before deciding whether a browser decode is small enough.
// Large originals and unfamiliar formats use the streaming server fallback.
export function previewDimensions(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) return [view.getUint32(16), view.getUint32(20)];
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    for (let offset = 2; offset + 8 < view.byteLength;) {
        if (view.getUint8(offset) !== 0xff) return null;
        const marker = view.getUint8(offset + 1);
        const length = view.getUint16(offset + 2);
        if (length < 2 || offset + length + 2 > view.byteLength) return null;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
        offset += length + 2;
    }
    return null;
}

export async function prepareImagePreview(file) {
    validateImage(file);
    // Common, modest photos get local previews without a second upload. Never
    // create an original-sized canvas; preflight dimensions before any decode.
    let bitmap;
    try {
        const dimensions = previewDimensions(await file.slice(0, 256 * 1024).arrayBuffer());
        if (dimensions && dimensions.every(value => value > 0 && value <= 16384)
            && dimensions[0] * dimensions[1] <= 12000000
            && Math.max(...dimensions) / Math.min(...dimensions) <= 8
            && typeof createImageBitmap === 'function') {
            bitmap = await createImageBitmap(file, { resizeWidth: Math.min(2048, ...dimensions), resizeQuality: 'high' });
            const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .88));
                if (blob?.size) return URL.createObjectURL(blob);
            }
        }
    } catch (_) { /* A decoder/canvas limit should fall back, not block upload. */ }
    finally { bitmap?.close(); }
    // Very large originals only reach <img> after the server has reduced them.
    const body = new FormData();
    body.append('image', file);
    try {
        const response = await api.post('/imagePreview', body, { responseType: 'blob', timeout: 180000, skipRetry: true });
        return URL.createObjectURL(response.data);
    } catch (error) {
        if (error.response?.data instanceof Blob) {
            try { error.response.data = JSON.parse(await error.response.data.text()); } catch (_) { /* Keep network fallback. */ }
        }
        throw error;
    }
}
