import { BUILTIN_LAYERS } from './builtinLayers';
import { setLocalBuiltinVisibility } from './builtinLayerController';

// Utility functions to show/hide colored area layers on the map

// Mapbox layer IDs for colored areas
const LAYER_IDS = Object.fromEntries([
    ...BUILTIN_LAYERS.map(layer => [layer.id, layer.layerIds]),
    ['Watershed', ['watershed-areas-fill']],
]);

/**
 * Set visibility for a single area category.
 * @param {string} category - A built-in layer ID
 * @param {boolean} visible
 */
export function setAreaVisibility(category, visible) {
    const mapboxMap = window?.atlasMapInstance;
    if (!mapboxMap) return;

    if (setLocalBuiltinVisibility(mapboxMap, category, visible)) return;

    const ids = LAYER_IDS[category];
    if (!ids) return;

    if (Array.isArray(ids)) {
        ids.forEach(id => {
            if (mapboxMap.getLayer(id)) {
                mapboxMap.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
            }
        });
    } else {
        if (mapboxMap.getLayer(ids)) {
            mapboxMap.setLayoutProperty(ids, 'visibility', visible ? 'visible' : 'none');
        }
    }
}

/**
 * Set visibility for all area categories at once.
 * @param {Object<string, boolean>} areaVisibility
 */
export function applyAreaVisibility(areaVisibility) {
    Object.entries(areaVisibility).forEach(([category, visible]) => {
        setAreaVisibility(category, visible);
    });
}