import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faLocationCrosshairs, faTrash, faSpinner, faQuestion, faPlay } from '@fortawesome/free-solid-svg-icons';
import './WatershedPanel.css';
import PolygonDrawingModal from './PolygonDrawingModal';
import { saveCustomLayer } from './arcgisServicesDb';
import { basinFeatureCollection, basinPolygonVertices } from './watershedGeometry';
import WatershedPanelOnboarding from './OnboardingWatershedPanel';

// USGS SS-Delineate service (same API the streamstats.usgs.gov site uses; CORS-enabled).
// The legacy /streamstatsservices API was decommissioned in January 2026.
const SS_DELINEATE_URL = 'https://streamstats.usgs.gov/ss-delineate/v1/delineate/sshydro';
const REQUEST_TIMEOUT_MS = 120000;
// StreamStats snaps the click to its 30m stream grid; below this zoom the click is too imprecise
const MIN_DELINEATION_ZOOM = 12;
// Match SSStateLayers in https://streamstats.usgs.gov/ss/appConfig.js.
// The old combined StreamStats/stateServices endpoint returns an HTML error page,
// sometimes with HTTP 200. Each state now has its own MapServer.
const SS_RIVERS_URL = 'https://gis.streamstats.usgs.gov/arcgis/rest/services/stateServices';

const STATES = [
    { code: 'WA', label: 'Washington', riverLayer: 152, riverZoom: 12 },
    { code: 'ID', label: 'Idaho', riverLayer: 46, riverZoom: 13 },
    { code: 'OR', label: 'Oregon', riverLayer: 119, riverZoom: 12 },
];

const BASIN_SOURCE = 'streamstats-basin';
const POINT_SOURCE = 'streamstats-point';
const BASIN_FILL_LAYER = 'streamstats-basin-fill';
const BASIN_OUTLINE_LAYER = 'streamstats-basin-outline';
const POINT_LAYER = 'streamstats-point-circle';

// Walk any GeoJSON coordinates array and accumulate [minLng, minLat, maxLng, maxLat]
function extendBounds(coords, bounds) {
    if (typeof coords[0] === 'number') {
        bounds[0] = Math.min(bounds[0], coords[0]);
        bounds[1] = Math.min(bounds[1], coords[1]);
        bounds[2] = Math.max(bounds[2], coords[0]);
        bounds[3] = Math.max(bounds[3], coords[1]);
        return;
    }
    coords.forEach(c => extendBounds(c, bounds));
}

function geojsonBounds(geojson) {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    features.forEach(f => {
        if (f?.geometry?.coordinates) extendBounds(f.geometry.coordinates, bounds);
    });
    return Number.isFinite(bounds[0]) ? bounds : null;
}

export default function WatershedPanel({ isOpen, onClose, splitBottom = false, mapInstance, isLoggedIn, userEmail, onCustomLayerSaved }) {
    const [stateCode, setStateCode] = useState('WA');
    const [isArmed, setIsArmed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [clickedPoint, setClickedPoint] = useState(null);
    const [workspaceId, setWorkspaceId] = useState('');
    const [error, setError] = useState('');
    const [zoomHint, setZoomHint] = useState(false);
    const [hasResult, setHasResult] = useState(false);
    const [showRivers, setShowRivers] = useState(false);
    const [riverError, setRiverError] = useState('');
    const [basinData, setBasinData] = useState(null);
    const [basinName, setBasinName] = useState('StreamStats watershed');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [saveError, setSaveError] = useState('');
    const [polygonVertices, setPolygonVertices] = useState(null);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const savingRef = useRef(false);
    const abortRef = useRef(null);
    const selectedState = STATES.find(s => s.code === stateCode);

    useEffect(() => {
        if (!isOpen) setIsOnboardingOpen(false);
    }, [isOpen]);

    // Keep the overlay when the panel closes; basemap changes also restore it.
    useEffect(() => {
        const map = typeof mapInstance === 'function' ? mapInstance() : mapInstance;
        if (!map) return;
        setRiverError('');
        const syncRivers = () => {
            try {
                STATES.forEach(state => {
                    const id = `streamstats-rivers-${state.code}`;
                    const visible = showRivers && state.code === stateCode;
                    if (visible && !map.getSource(id)) {
                        map.addSource(id, {
                            type: 'raster',
                            tiles: [`${SS_RIVERS_URL}/${state.code.toLowerCase()}/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&layers=show:${state.riverLayer}`],
                            tileSize: 256,
                            minzoom: state.riverZoom,
                            maxzoom: 18,
                            attribution: '<a href="https://streamstats.usgs.gov/">USGS StreamStats</a>',
                        });
                    }
                    if (visible && !map.getLayer(id)) {
                        map.addLayer({
                            id,
                            type: 'raster',
                            source: id,
                            minzoom: state.riverZoom,
                            paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 },
                        }, map.getLayer(BASIN_FILL_LAYER) ? BASIN_FILL_LAYER : undefined);
                    }
                    if (map.getLayer(id)) {
                        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
                    }
                });
            } catch (err) {
                setRiverError('Unable to display StreamStats rivers. Toggle rivers off and on to retry.');
            }
        };
        const onRiverError = (event) => {
            if (showRivers && event.sourceId === `streamstats-rivers-${stateCode}`) {
                setRiverError('StreamStats rivers could not load. Toggle rivers off and on to retry.');
            }
        };
        // isStyleLoaded can be false while existing tiles are still downloading.
        if (map.isStyleLoaded() || STATES.some(state => map.getLayer(`streamstats-rivers-${state.code}`))) {
            syncRivers();
        } else {
            map.once('idle', syncRivers);
        }
        map.on('style.load', syncRivers);
        map.on('error', onRiverError);
        return () => {
            map.off('style.load', syncRivers);
            map.off('idle', syncRivers);
            map.off('error', onRiverError);
        };
    }, [mapInstance, stateCode, showRivers, isOpen]);

    const getMap = () => (typeof mapInstance === 'function' ? mapInstance() : mapInstance);

    // Panel remounts each open; recover "result on map" state so Clear stays available
    useEffect(() => {
        const map = getMap();
        if (map && map.getSource(BASIN_SOURCE)) {
            setHasResult(true);
            setBasinData(map.getStyle?.()?.sources?.[BASIN_SOURCE]?.data || null);
        }
        return () => {
            abortRef.current?.abort();
        };
        // eslint-disable-next-line
    }, []);

    // While armed: crosshair cursor + one delineation per map click
    useEffect(() => {
        if (!isArmed) return;
        const map = getMap();
        if (!map) {
            setIsArmed(false);
            setError('Map is not ready yet. Please try again.');
            return;
        }

        map.getCanvas().style.cursor = 'crosshair';
        const handler = (e) => {
            if (map.getZoom() < MIN_DELINEATION_ZOOM) {
                setZoomHint(true);
                return;
            }
            setZoomHint(false);
            setIsArmed(false);
            delineate(e.lngLat);
        };
        map.on('click', handler);

        return () => {
            map.off('click', handler);
            map.getCanvas().style.cursor = '';
        };
        // eslint-disable-next-line
    }, [isArmed, stateCode]);

    const renderResult = (map, basin, point) => {
        clearResultLayers(map);

        map.addSource(BASIN_SOURCE, { type: 'geojson', data: basin });
        map.addLayer({
            id: BASIN_FILL_LAYER,
            type: 'fill',
            source: BASIN_SOURCE,
            paint: { 'fill-color': '#f5c542', 'fill-opacity': 0.3 },
        });
        map.addLayer({
            id: BASIN_OUTLINE_LAYER,
            type: 'line',
            source: BASIN_SOURCE,
            paint: { 'line-color': '#b8860b', 'line-width': 2.5 },
        });

        if (point) {
            map.addSource(POINT_SOURCE, { type: 'geojson', data: point });
            map.addLayer({
                id: POINT_LAYER,
                type: 'circle',
                source: POINT_SOURCE,
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#d32f2f',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                },
            });
        }

        const bounds = geojsonBounds(basin);
        if (bounds) {
            map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 60 });
        }
        setHasResult(true);
        setBasinData(basinFeatureCollection(basin));
        setBasinName(`StreamStats watershed (${stateCode})`);
        setSaveMessage('');
        setSaveError('');
    };

    const clearResultLayers = (map) => {
        [BASIN_FILL_LAYER, BASIN_OUTLINE_LAYER, POINT_LAYER].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
        });
        [BASIN_SOURCE, POINT_SOURCE].forEach(id => {
            if (map.getSource(id)) map.removeSource(id);
        });
    };

    const delineate = async ({ lng, lat }) => {
        setError('');
        setWorkspaceId('');
        setClickedPoint({ lng, lat });
        setIsLoading(true);

        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const params = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6) });
            const res = await fetch(`${SS_DELINEATE_URL}/${stateCode}?${params}`, { signal: controller.signal });
            if (!res.ok) throw new Error(`StreamStats returned HTTP ${res.status}. Please try again later.`);
            const data = await res.json();

            // featurecollection nests entry lists one level deep
            const entries = (data?.bcrequest?.wsresp?.featurecollection || []).flat(2);
            const basin = entries.find(f => f?.name === 'globalwatershed')?.feature;
            const point = entries.find(f => f?.name === 'globalwatershedpoint')?.feature;
            if (!basin) {
                throw new Error('No watershed was returned. Try clicking closer to a stream channel.');
            }

            const map = getMap();
            if (map) renderResult(map, basin, point);
            setWorkspaceId(data?.bcrequest?.wsresp?.workspace_id || '');
        } catch (err) {
            if (err.name === 'AbortError') {
                setError('The request timed out or was cancelled. StreamStats can be slow — please try again.');
            } else {
                setError(err.message || 'Delineation failed.');
            }
        } finally {
            clearTimeout(timeoutTimer);
            setIsLoading(false);
            abortRef.current = null;
        }
    };

    const handleArmToggle = () => {
        setError('');
        setZoomHint(false);
        setIsArmed(v => !v);
    };

    const handleCancel = () => {
        abortRef.current?.abort();
    };

    const handleClear = () => {
        const map = getMap();
        if (map) clearResultLayers(map);
        setHasResult(false);
        setClickedPoint(null);
        setWorkspaceId('');
        setError('');
        setBasinData(null);
        setSaveMessage('');
        setSaveError('');
    };

    const canSave = () => {
        setSaveError('');
        setSaveMessage('');
        if (!isLoggedIn || !userEmail) {
            setSaveError('Please log in to save this basin.');
            return false;
        }
        return true;
    };

    const handleSaveCustomLayer = async () => {
        if (savingRef.current || !canSave()) return;
        const label = basinName.trim();
        if (!label) {
            setSaveError('Enter a name for the custom layer.');
            return;
        }
        savingRef.current = true;
        setIsArmed(false);
        setIsSaving(true);
        try {
            const geojson = basinFeatureCollection(basinData);
            const key = `uploaded_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await saveCustomLayer(userEmail, {
                key, label, url: `local://${key}`, type: 'uploaded', folder: 'Root', state: '', geojson,
            });
            setSaveMessage(`Saved "${label}" to Custom Layers / Root.`);
            onCustomLayerSaved?.();
        } catch (err) {
            setSaveError(err.message || 'Could not save the custom layer. Please try again.');
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    };

    const handleSavePolygon = () => {
        if (!canSave()) return;
        try {
            setPolygonVertices(basinPolygonVertices(basinData));
            setIsArmed(false);
        } catch (err) {
            setSaveError(err.message);
        }
    };

    const handlePolygonEdited = (allRings, centroid, style, ringStyles = []) => {
        setPolygonVertices(null);
        // Continue through Content2 -> FormModal, just like the existing polygon tool.
        const vertices = allRings.flatMap((ring, ringIndex) => ring.map(vertex => ({
            ...vertex, ring: ringIndex, ...ringStyles[ringIndex],
        })));
        window.dispatchEvent(new CustomEvent('polygon-tool-save', {
            detail: { vertices, centroid, fillColor: style?.fillColor, fillOpacity: style?.fillOpacity, lineStyle: style?.lineStyle },
        }));
    };

    if (!isOpen) return null;

    return (
        <div className={`watershed-panel${splitBottom ? ' watershed-panel--split-bottom' : ''}${isOnboardingOpen ? ' onboarding-locked' : ''}`}>
            <div className="watershed-panel-header">
                <span className="watershed-panel-title">Watershed Delineation</span>
                <div className="watershed-panel-header-actions">
                    <button className="watershed-panel-icon-btn" title="Help" aria-label="Watershed help" data-onboarding-target="watershed-help"
                        onClick={() => window.open('/user-manual?section=watershed-panel', '_blank', 'noopener,noreferrer')}>
                        <FontAwesomeIcon icon={faQuestion} />
                    </button>
                    <button className="watershed-panel-icon-btn" title="Tutorial" aria-label="Watershed tutorial"
                        disabled={isLoading || isSaving || !!polygonVertices}
                        onClick={() => { setIsArmed(false); setIsOnboardingOpen(true); }}>
                        <FontAwesomeIcon icon={faPlay} />
                    </button>
                    <button className="watershed-panel-icon-btn" title="Close" onClick={onClose}>
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>

            <div className="watershed-panel-body" inert={isOnboardingOpen ? '' : undefined}>
                <p className="watershed-panel-intro">
                    Powered by USGS StreamStats. Zoom in to a stream, place a point on it, and the
                    upstream drainage basin is computed and drawn on the map.
                </p>

                <label className="watershed-panel-field" data-onboarding-target="watershed-state">
                    <span>State</span>
                    <select
                        value={stateCode}
                        onChange={(e) => setStateCode(e.target.value)}
                        disabled={isArmed || isLoading}
                    >
                        {STATES.map(s => (
                            <option key={s.code} value={s.code}>{s.label} ({s.code})</option>
                        ))}
                    </select>
                </label>

                <label className="watershed-panel-river-toggle" data-onboarding-target="watershed-rivers">
                    <input
                        type="checkbox"
                        checked={showRivers}
                        onChange={e => setShowRivers(e.target.checked)}
                        aria-describedby="watershed-river-hint"
                    />
                    <span>Show StreamStats rivers</span>
                </label>
                <p id="watershed-river-hint" className="watershed-panel-intro">
                    Rivers for {selectedState.label}. Zoom to level {selectedState.riverZoom} or closer
                    to see stream channels. Uncheck to hide.
                </p>
                {showRivers && riverError && <div role="alert" className="watershed-panel-error">{riverError}</div>}

                <button
                    className={`watershed-panel-arm-btn${isArmed ? ' watershed-panel-arm-btn--armed' : ''}`}
                    data-onboarding-target="watershed-select"
                    onClick={handleArmToggle}
                    disabled={isLoading || isSaving || !!polygonVertices}
                >
                    <FontAwesomeIcon icon={faLocationCrosshairs} />
                    {isArmed ? ' Cancel point selection' : ' Select point on map'}
                </button>

                {isArmed && (
                    <div className="watershed-panel-note">
                        Click a stream on the map to place the pour point.
                        {zoomHint && (
                            <div className="watershed-panel-warning">
                                Please zoom in further (zoom ≥ {MIN_DELINEATION_ZOOM}) so the point
                                snaps to the correct stream.
                            </div>
                        )}
                    </div>
                )}

                {isLoading && (
                    <div className="watershed-panel-loading">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Delineating watershed… this can take up to 30 seconds.</span>
                        <button className="watershed-panel-cancel-btn" onClick={handleCancel}>Cancel</button>
                    </div>
                )}

                {error && <div className="watershed-panel-error">{error}</div>}

                {clickedPoint && !isLoading && !error && hasResult && (
                    <div className="watershed-panel-result" data-onboarding-target="watershed-results">
                        <div><strong>Pour point:</strong> {clickedPoint.lat.toFixed(5)}, {clickedPoint.lng.toFixed(5)}</div>
                        {workspaceId && (
                            <div className="watershed-panel-result-workspace"><strong>Workspace:</strong> {workspaceId}</div>
                        )}
                    </div>
                )}

                {hasResult && !isLoading && (
                    <>
                    <label className="watershed-panel-field">
                        <span>Basin name</span>
                        <input value={basinName} onChange={e => setBasinName(e.target.value)} disabled={isSaving} />
                    </label>
                    <button className="watershed-panel-arm-btn" data-onboarding-target="watershed-save-layer" onClick={handleSaveCustomLayer} disabled={isSaving || !basinData}>
                        {isSaving ? 'Saving…' : 'Save as custom layer'}
                    </button>
                    <button className="watershed-panel-arm-btn" data-onboarding-target="watershed-save-polygon" onClick={handleSavePolygon} disabled={isSaving || !basinData}>
                        Save as polygon
                    </button>
                    {saveMessage && <div role="status" className="watershed-panel-result">{saveMessage}</div>}
                    {saveError && <div role="alert" className="watershed-panel-error">{saveError}</div>}
                    <button className="watershed-panel-clear-btn" data-onboarding-target="watershed-clear" onClick={handleClear} disabled={isSaving}>
                        <FontAwesomeIcon icon={faTrash} /> Clear result from map
                    </button>
                    </>
                )}
            </div>
            <WatershedPanelOnboarding isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} isPanelCollapsed={!isOpen} />
            {polygonVertices && (
                <PolygonDrawingModal
                    mode="polygon"
                    title="Edit Polygon"
                    initialVertices={polygonVertices}
                    initialFillColor="#f5c542"
                    initialLineStyle="solid"
                    onSave={handlePolygonEdited}
                    onCancel={() => setPolygonVertices(null)}
                />
            )}
        </div>
    );
}
