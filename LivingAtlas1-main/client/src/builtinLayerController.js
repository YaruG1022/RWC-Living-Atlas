import mapboxgl from 'mapbox-gl';
import { BUILTIN_STATUS_EVENT, LOCAL_BUILTIN_LAYERS, builtinDataUrl } from './builtinLayers';

const controllers = new WeakMap();

export function getBuiltinLayerStatuses(map) {
    return controllers.get(map)?.statuses() || {};
}

export function setLocalBuiltinVisibility(map, id, visible) {
    if (!LOCAL_BUILTIN_LAYERS.some(layer => layer.id === id)) return false;
    controllers.get(map)?.setVisible(id, visible);
    return true;
}

export function setBuiltinLayerOpacity(map, opacity) {
    controllers.get(map)?.setOpacity(opacity);
}

export function retryBuiltinLayer(map, id) {
    controllers.get(map)?.retry(id);
}

function popupContent(layer, properties) {
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = properties.name || layer.label;
    content.appendChild(title);
    [properties.kind, properties.states, properties.code && `${layer.codeLabel}: ${properties.code}`, layer.sourceLabel, layer.description].filter(Boolean).forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        content.appendChild(paragraph);
    });
    return content;
}

/** Owns lazy same-origin data requests and reattaches overlays after style changes. */
export function installBuiltinLayers(map, fetchData = (...args) => fetch(...args)) {
    if (controllers.has(map)) return controllers.get(map);
    let disposed = false;
    let popup = null;
    let opacity = 0.7;
    const entries = new Map(LOCAL_BUILTIN_LAYERS.map(layer => [layer.id, {
        layer, visible: false, data: null, pending: null, abort: null, status: { state: 'idle' },
    }]));
    const handlers = [];
    const notify = (entry, status) => {
        entry.status = status;
        window.dispatchEvent(new CustomEvent(BUILTIN_STATUS_EVENT, { detail: { id: entry.layer.id, ...status } }));
    };
    const setVisibility = entry => entry.layer.layerIds.forEach(id => {
        const visibility = entry.visible ? 'visible' : 'none';
        if (map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== visibility) {
            map.setLayoutProperty(id, 'visibility', visibility);
        }
    });
    const attach = entry => {
        if (disposed || !map.isStyleLoaded() || !entry.data) return;
        const { layer } = entry;
        const sourceId = `builtin-${layer.id.toLowerCase()}-source`;
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: 'geojson', data: entry.data, attribution: layer.attribution });
        }
        const before = map.getStyle()?.layers?.find(item => item.type === 'symbol' && item.layout?.['text-field'])?.id;
        const visibility = entry.visible ? 'visible' : 'none';
        const layers = layer.geometry === 'line' ? [{
            id: layer.layerIds[0], type: 'line', source: sourceId, layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': layer.color, 'line-opacity': opacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 2, 13, 4] },
        }] : [{
            id: layer.layerIds[0], type: 'fill', source: sourceId, layout: { visibility },
            paint: { 'fill-color': layer.color, 'fill-opacity': opacity * layer.fillOpacity },
        }, {
            id: layer.layerIds[1], type: 'line', source: sourceId, layout: { visibility },
            paint: { 'line-color': layer.color, 'line-width': 1.2, 'line-opacity': opacity },
        }];
        layers.forEach(item => { if (!map.getLayer(item.id)) map.addLayer(item, before); });
        setVisibility(entry);
    };
    const load = entry => {
        if (entry.data) {
            attach(entry);
            return;
        }
        if (entry.pending) return;
        entry.abort = new AbortController();
        notify(entry, { state: 'loading' });
        entry.pending = Promise.resolve().then(() => fetchData(builtinDataUrl(entry.layer.file), { signal: entry.abort.signal }))
            .then(response => {
                if (!response.ok) throw new Error('Data file unavailable');
                return response.json();
            })
            .then(data => {
                if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
                    throw new Error('Invalid layer data');
                }
                if (disposed) return;
                entry.data = data;
                // An unchecked layer must stay hidden even if its request finishes later.
                if (entry.visible) attach(entry);
                notify(entry, { state: 'ready', count: data.features.length });
            })
            .catch(error => {
                if (disposed || error.name === 'AbortError') return;
                notify(entry, { state: 'error', message: `Unable to load ${entry.layer.label}. Please retry.` });
            })
            .finally(() => { entry.pending = null; });
    };
    const onStyleLoad = () => entries.forEach(entry => {
        if (entry.visible) load(entry);
    });
    map.on('style.load', onStyleLoad);
    // Source/tile work can keep isStyleLoaded() false after style.load. Retry
    // attachment on idle, including data fetched while a basemap is loading.
    const onIdle = () => entries.forEach(entry => {
        if (entry.visible && entry.data) attach(entry);
    });
    map.on('idle', onIdle);
    entries.forEach(entry => {
        const id = entry.layer.layerIds[0];
        const click = event => {
            const feature = event.features?.[0];
            if (!entry.visible || !feature) return;
            popup?.remove();
            popup = new mapboxgl.Popup({ offset: 12, maxWidth: '320px', className: 'builtin-layer-popup' }).setLngLat(event.lngLat)
                .setDOMContent(popupContent(entry.layer, feature.properties || {})).addTo(map);
        };
        const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
        const leave = () => { map.getCanvas().style.cursor = ''; };
        [['click', click], ['mouseenter', enter], ['mouseleave', leave]].forEach(([event, handler]) => {
            map.on(event, id, handler);
            handlers.push([event, id, handler]);
        });
    });
    const controller = {
        statuses: () => Object.fromEntries([...entries].map(([id, entry]) => [id, entry.status])),
        setVisible(id, visible) {
            const entry = entries.get(id);
            if (!entry || disposed) return;
            entry.visible = visible;
            setVisibility(entry);
            if (visible) load(entry);
            else popup?.remove();
        },
        setOpacity(value) {
            if (disposed || !Number.isFinite(value)) return;
            opacity = Math.min(1, Math.max(0, value));
            entries.forEach(({ layer }) => layer.layerIds.forEach((id, index) => {
                if (!map.getLayer(id)) return;
                const isFill = layer.geometry === 'polygon' && index === 0;
                map.setPaintProperty(id, isFill ? 'fill-opacity' : 'line-opacity',
                    isFill ? opacity * layer.fillOpacity : opacity);
            }));
        },
        retry(id) {
            const entry = entries.get(id);
            if (entry?.visible && !disposed) load(entry);
        },
        destroy() {
            disposed = true;
            entries.forEach(entry => entry.abort?.abort());
            popup?.remove();
            map.off('style.load', onStyleLoad);
            map.off('idle', onIdle);
            handlers.forEach(args => map.off(...args));
            controllers.delete(map);
        },
    };
    controllers.set(map, controller);
    return controller;
}
