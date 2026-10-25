// Shared with the map so refreshes and style changes cannot reveal a card being edited.
const editingCards = new Set();
const hiddenLayers = new WeakMap();
export const CARD_LOCATION_EDIT_EVENT = 'atlas:card-location-edit';

export const isCardLocationEditing = cardID => editingCards.has(String(cardID));
export const hasCardLocationEdits = () => editingCards.size > 0;

export function setCardLocationEditing(cardID, active) {
    if (cardID == null || cardID === '') return;
    const id = String(cardID);
    if (active) editingCards.add(id);
    else editingCards.delete(id);
    if (active) {
        document.querySelectorAll('.card-pin-rich-popup .mapboxgl-popup-close-button').forEach(button => button.click());
    }
    window.dispatchEvent(new CustomEvent(CARD_LOCATION_EDIT_EVENT, { detail: { cardID: id, active } }));
}

export function syncCardLocationEditing(map, markers, markersVisible = true) {
    markers.forEach(marker => {
        const element = marker.getElement();
        if (!element) return;
        if (isCardLocationEditing(element.dataset.cardMarkerId)) element.dataset.cardLocationEditing = 'true';
        else delete element.dataset.cardLocationEditing;
    });
    let previous = hiddenLayers.get(map);
    if (!previous) { previous = new Map(); hiddenLayers.set(map, previous); }
    (map.getStyle()?.layers || []).forEach(layer => {
        const match = /^card-(?:polygon-(?:fill|line|hover)|image-(?:layer|outline|hover|hit))-(\d+)(?:-(?:solid|dashed|dotted|dashdot))?$/.exec(layer.id);
        if (!match) return;
        if (isCardLocationEditing(match[1])) {
            const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
            if (!previous.has(layer.id)) previous.set(layer.id, visibility);
            if (visibility !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
        } else if (previous.has(layer.id)) {
            const visibility = markersVisible ? previous.get(layer.id) : 'none';
            previous.delete(layer.id); // Delete before a style event can re-enter this function.
            map.setLayoutProperty(layer.id, 'visibility', visibility);
        }
    });
}
