import api from './api';

// Isolated from personal-library layer keys, including identically named uploads.
const states = new WeakMap();

function stateFor(map) {
    let state = states.get(map);
    if (state) return state;
    state = { entries:new Map(), drawing:null };
    states.set(map,state);
    map.on?.('style.load',() => {
        state.entries.forEach(entry => {
            if (entry.enabled && entry.payload && state.drawing) render(map,state,entry);
        });
    });
    return state;
}

function render(map,state,entry,refresh=false) {
    if (!entry.enabled || !entry.payload) return;
    if (map.isStyleLoaded && !map.isStyleLoaded()) return;
    const {service,geojson} = entry.payload;
    if (refresh || !map.getSource(state.drawing.uploadedSourceId(service.key))) {
        state.drawing.addUploadedVectorLayer(map,service,geojson,.7);
    }
}

export async function toggleSharedCardLayer(item,checked,map=window.atlasMapInstance) {
    if (!map || !item.shared_layer_key) throw new Error('The map or shared layer is not ready. Please try again.');
    const state = stateFor(map);
    const key = item.shared_layer_key;
    const entry = state.entries.get(key) || {revision:0};
    entry.revision += 1;
    entry.enabled = checked;
    state.entries.set(key,entry);
    const revision = entry.revision;
    // Lazy loading also keeps map SDKs out of non-map project rendering.
    state.drawing = state.drawing || await import('./uploadedVectorUtils');
    if (revision !== entry.revision) return;
    if (!checked) {
        state.drawing.removeUploadedVectorLayer(map,key);
        return;
    }
    try {
        const response = await api.get(`/cardArcGISLinks/public-custom-layer/${item.id}`);
        if (revision !== entry.revision || !entry.enabled) return;
        if (response.data?.service?.key !== key || !response.data?.geojson) throw new Error('This shared layer is unavailable.');
        entry.payload = response.data;
        render(map,state,entry,true);
    } catch (error) {
        if (revision !== entry.revision) return;
        entry.enabled = false;
        state.drawing.removeUploadedVectorLayer(map,key);
        throw error;
    }
}
