import api from './api';

const GUEST_KEY = 'atlas_guest_linked_layer_visibility_v1';
const pending = new Map();

function guestPreferences() {
    try {
        const value = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
}

export function resolveLinkedLayerVisibility(items, email) {
    if (email) return items;
    const preferences = guestPreferences();
    return items.map(item => ({...item,is_visible:preferences[item.id] === true}));
}

export function saveLinkedLayerVisibility(item, checked, email) {
    if (!email) {
        try {
            localStorage.setItem(GUEST_KEY,JSON.stringify({...guestPreferences(),[item.id]:checked}));
            return Promise.resolve();
        } catch (error) { return Promise.reject(error); }
    }
    // Keep rapid clicks in order, independently for each account and association.
    const key = `${email.toLowerCase()}:${item.id}`;
    const request = (pending.get(key) || Promise.resolve()).catch(() => {}).then(() =>
        api.patch(`/cardArcGISLinks/${item.id}`,{is_visible:checked,requester_email:email})
    );
    pending.set(key,request);
    const clear = () => { if (pending.get(key) === request) pending.delete(key); };
    request.then(clear,clear);
    return request;
}
