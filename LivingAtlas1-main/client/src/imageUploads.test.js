import api from './api';
import { prepareImagePreview, previewDimensions } from './imageUploads';
jest.mock('./api', () => ({ post: jest.fn() }));
const header = (width, height) => {
    const data = new ArrayBuffer(24), view = new DataView(data);
    view.setUint32(0, 0x89504e47); view.setUint32(4, 0x0d0a1a0a);
    view.setUint32(16, width); view.setUint32(20, height);
    return data;
};
const file = (width, height) => {
    const source = new File(['source'], 'fixture.png', { type: 'image/png' });
    source.slice = () => ({ arrayBuffer: async () => header(width, height) });
    return source;
};
beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:bounded-preview');
    api.post.mockResolvedValue({ data: new Blob(['display']) });
    global.createImageBitmap = jest.fn();
});
afterEach(() => { jest.restoreAllMocks(); delete global.createImageBitmap; });

test.each([[12000, 12000], [100000, 100]])('large %ix%i originals go to the server without browser decoding', async (width, height) => {
    await expect(prepareImagePreview(file(width, height))).resolves.toBe('blob:bounded-preview');
    expect(global.createImageBitmap).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/imagePreview', expect.any(FormData), expect.objectContaining({ responseType:'blob', skipRetry:true }));
});

test('modest images use a bounded canvas without a duplicate network transfer', async () => {
    const bitmap = { width: 2000, height: 1000, close: jest.fn() };
    global.createImageBitmap.mockResolvedValue(bitmap);
    const drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function(callback) {
        expect(Math.max(this.width, this.height)).toBeLessThanOrEqual(2048);
        callback(new Blob(['display']));
    });
    await expect(prepareImagePreview(file(4000, 2000))).resolves.toBe('blob:bounded-preview');
    expect(api.post).not.toHaveBeenCalled();
    expect(drawImage).toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalled();
});

test('a browser decoder failure falls back to processing without losing the original', async () => {
    global.createImageBitmap.mockRejectedValue(new Error('Image too large for browser'));
    const original = file(4000, 2000);
    await prepareImagePreview(original);
    expect(api.post.mock.calls[0][1].get('image')).toBe(original);
    expect(previewDimensions(new ArrayBuffer(0))).toBeNull();
});
