export function customLayerErrorMessage(error, fallback = 'Could not update Custom Layers. Please try again.', { saving = false } = {}) {
    if (!error?.response) {
        if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
            return saving
                ? 'The request timed out. Check Custom Layers before saving again; the save may have completed.'
                : 'Loading the layer library timed out. Please try again.';
        }
        return 'Could not reach the layer library. Check your connection and try again.';
    }
    const detail = error.response.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const fields = [...new Set(detail.map(item => item.loc?.slice(1).join('.')).filter(Boolean))];
        if (fields.length) return `Check these layer fields: ${fields.join(', ')}. Then try again.`;
    }
    return fallback;
}
