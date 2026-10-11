import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faQuestion, faPlay, faSearch } from '@fortawesome/free-solid-svg-icons';
import './BasemapSwitcher.css';
import BasemapPanelOnboarding from './OnboardingBasemapPanel';

const SEATTLE_TILE_SAMPLE = { z: 10, y: 357, x: 163 };

function createRasterStyle(id, tileUrl, attribution, maxzoom) {
    return {
        version: 8,
        name: id,
        sources: {
            [id]: {
                type: 'raster',
                tiles: [tileUrl],
                tileSize: 256,
                maxzoom,
                attribution,
            },
        },
        layers: [
            {
                id: `${id}-layer`,
                type: 'raster',
                source: id,
                minzoom: 0,
            },
        ],
    };
}

const BASEMAPS = [
    {
        id: 'satellite-v9',
        label: 'Satellite (Imagery)',
        description: 'Most realistic aerial imagery view with no labels.',
        style: 'mapbox://styles/mapbox/satellite-v9',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'satellite-streets-v12',
        label: 'Satellite + Streets',
        description: 'Aerial imagery with roads and place labels overlaid.',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'navigation-day-v1',
        label: 'Navigation Day',
        description: 'High-contrast daytime style optimized for routing.',
        style: 'mapbox://styles/mapbox/navigation-day-v1',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'navigation-night-v1',
        label: 'Navigation Night',
        description: 'Dark navigation style designed for low-light viewing.',
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'outdoors-v12',
        label: 'Outdoors',
        description: 'Terrain-forward style emphasizing land and trails.',
        style: 'mapbox://styles/mapbox/outdoors-v12',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'streets-v12',
        label: 'Streets',
        description: 'General-purpose street map for everyday exploration.',
        style: 'mapbox://styles/mapbox/streets-v12',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'light-v11',
        label: 'Light',
        description: 'Minimal light basemap for data-overlay readability.',
        style: 'mapbox://styles/mapbox/light-v11',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/light-v11/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
    {
        id: 'dark-v11',
        label: 'Dark',
        description: 'Dark-theme basemap that reduces visual glare.',
        style: 'mapbox://styles/mapbox/dark-v11',
        thumbnail: 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-122.4194,37.7749,12,0/200x140@2x?access_token=',
        thumbnailNeedsToken: true,
    },
];

// Public tile services: use normal browser caching and request only visible tiles.
const PUBLIC_BASEMAPS = [
    {
        id: 'openstreetmap',
        label: 'OpenStreetMap',
        description: 'Community street map worldwide. Free public tiles; availability is best effort.',
        tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxzoom: 19,
    },
    {
        id: 'usgs-topo',
        label: 'USGS Topographic',
        description: 'U.S. topographic map with contours, waterways, roads and terrain. Free, no API key.',
        service: 'USGSTopo',
    },
    {
        id: 'usgs-imagery',
        label: 'USGS Aerial Imagery',
        description: 'U.S. aerial imagery without labels. Detailed coverage varies by location. Free, no API key.',
        service: 'USGSImageryOnly',
    },
    {
        id: 'usgs-relief',
        label: 'USGS Shaded Relief',
        description: 'U.S. terrain shading for landforms and elevation context. Free, no API key.',
        service: 'USGSShadedReliefOnly',
        maxzoom: 7,
    },
];

PUBLIC_BASEMAPS.forEach(({ id, label, description, tiles, service, attribution, maxzoom }) => {
    const tileUrl = tiles || `https://basemap.nationalmap.gov/arcgis/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;
    const credit = attribution || `${id === 'usgs-imagery' ? 'USDA, ' : ''}<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>`;
    const sampleZoom = Math.min(SEATTLE_TILE_SAMPLE.z, maxzoom || 16);
    const sampleScale = 2 ** (SEATTLE_TILE_SAMPLE.z - sampleZoom);
    const sample = { z: sampleZoom, x: Math.floor(SEATTLE_TILE_SAMPLE.x / sampleScale), y: Math.floor(SEATTLE_TILE_SAMPLE.y / sampleScale) };
    BASEMAPS.push({
        id,
        label,
        description,
        style: createRasterStyle(id, tileUrl, credit, maxzoom || 16),
        thumbnail: tileUrl.replace(/\{([zxy])\}/g, (_, axis) => sample[axis]),
        sourceLabel: id === 'openstreetmap' ? '© OpenStreetMap contributors' : 'USGS The National Map',
        sourceUrl: id === 'openstreetmap' ? 'https://www.openstreetmap.org/copyright' : 'https://www.usgs.gov/programs/national-geospatial-program/national-map',
    });
});

const rasterBasemapSources = new Set(PUBLIC_BASEMAPS.map(({ id }) => id));

function isOverlaySource(id) {
    return id && !id.startsWith('mapbox') && !id.startsWith('composite') && !rasterBasemapSources.has(id);
}

function getAccessToken() {
    // Read token from mapboxgl global (set in Content1.js)
    if (window.mapboxgl && window.mapboxgl.accessToken) return window.mapboxgl.accessToken;
    try {
        const mapboxgl = require('mapbox-gl');
        return mapboxgl.accessToken || '';
    } catch {
        return '';
    }
}

export default function BasemapSwitcher({ isOpen, onClose, splitBottom = false, mapInstance, currentBasemapId, onBasemapChange }) {
    const [currentBasemap, setCurrentBasemap] = useState(currentBasemapId || 'streets-v12');
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');
    const previousControlledBasemapRef = useRef(currentBasemapId || 'streets-v12');
    const token = getAccessToken();

    const filteredBasemaps = BASEMAPS.filter((item) => {
        if (!searchKeyword.trim()) {
            return true;
        }
        const keyword = searchKeyword.trim().toLowerCase();
        return item.label.toLowerCase().includes(keyword) || item.description.toLowerCase().includes(keyword);
    });

    const applyBasemap = (map, basemap) => {
        if (!map || !basemap) return;

        // Save current map state
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();

        // Collect existing non-basemap sources and layers to restore after style change
        const style = map.getStyle();
        const customSources = {};
        const customLayers = [];

        if (style) {
            // Save custom (non-mapbox) sources
            Object.keys(style.sources || {}).forEach(id => {
                if (isOverlaySource(id)) {
                    customSources[id] = style.sources[id];
                }
            });
            // Save custom layers
            (style.layers || []).forEach(layer => {
                const src = layer.source || '';
                if (isOverlaySource(src)) {
                    customLayers.push(layer);
                }
            });
        }

        map.setStyle(basemap.style);

        // Restore custom sources and layers after style loads
        map.once('style.load', () => {
            // Restore view
            map.setCenter(center);
            map.setZoom(zoom);
            map.setBearing(bearing);
            map.setPitch(pitch);

            // Re-add custom sources
            Object.keys(customSources).forEach(id => {
                if (!map.getSource(id)) {
                    try {
                        map.addSource(id, customSources[id]);
                    } catch (e) {
                        console.warn('Failed to restore source:', id, e);
                    }
                }
            });

            // Re-add custom layers
            customLayers.forEach(layer => {
                if (!map.getLayer(layer.id)) {
                    try {
                        map.addLayer(layer);
                    } catch (e) {
                        console.warn('Failed to restore layer:', layer.id, e);
                    }
                }
            });
        });
    };

    useEffect(() => {
        const controlledId = currentBasemapId || 'streets-v12';
        if (controlledId === currentBasemap) {
            return;
        }

        const previousId = previousControlledBasemapRef.current;
        previousControlledBasemapRef.current = controlledId;
        setCurrentBasemap(controlledId);

        if (previousId === controlledId) {
            return;
        }

        const target = BASEMAPS.find(item => item.id === controlledId);
        if (!target) return;

        const map = typeof mapInstance === 'function' ? mapInstance() : mapInstance;
        if (map) {
            applyBasemap(map, target);
            return;
        }

        const retryTimer = window.setTimeout(() => {
            const retryMap = typeof mapInstance === 'function' ? mapInstance() : mapInstance;
            if (retryMap) {
                applyBasemap(retryMap, target);
            }
        }, 500);

        return () => window.clearTimeout(retryTimer);
    }, [currentBasemapId, currentBasemap, mapInstance]);

    const handleSelect = (basemap) => {
        const map = typeof mapInstance === 'function' ? mapInstance() : mapInstance;
        if (!map) return;
        applyBasemap(map, basemap);
        setCurrentBasemap(basemap.id);
        previousControlledBasemapRef.current = basemap.id;
        onBasemapChange?.(basemap.id);
    };

    useEffect(() => {
        if (!isOpen && isOnboardingOpen) {
            setIsOnboardingOpen(false);
        }
    }, [isOpen, isOnboardingOpen]);

    if (!isOpen) return null;

    const runSearch = () => {
        setSearchKeyword(searchInput.trim());
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearchKeyword('');
    };

    return (
        <>
        <div className={`basemap-switcher-panel${splitBottom ? ' basemap-switcher-panel--split-bottom' : ''}${isOnboardingOpen ? ' onboarding-locked' : ''}`}>
            <div className="basemap-switcher-header">
                <span className="basemap-switcher-title">Map Style</span>
                <div className="basemap-switcher-header-actions">
                    <button className="basemap-switcher-icon-btn" data-onboarding-target="basemap-help-button" title="Help" onClick={() => window.open('/user-manual?section=basemap-panel', '_blank')}>
                        <FontAwesomeIcon icon={faQuestion} />
                    </button>
                    <button className="basemap-switcher-icon-btn basemap-switcher-icon-btn--play" title="Tutorial" onClick={() => setIsOnboardingOpen(true)}>
                        <FontAwesomeIcon icon={faPlay} />
                    </button>
                    <button className="basemap-switcher-icon-btn" title="Close" onClick={onClose}>
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>
            <div className="upload-panel-searchbar" data-onboarding-target="basemap-search-row">
                <input
                    type="text"
                    placeholder="Search map style"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            runSearch();
                        }
                    }}
                />
                <button
                    type="button"
                    className="upload-panel-searchbar-btn search"
                    title="Search"
                    onClick={runSearch}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
                <button
                    type="button"
                    className="upload-panel-searchbar-btn clear"
                    title="Clear Search"
                    onClick={clearSearch}
                    disabled={!searchInput && !searchKeyword}
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>
            <div className="basemap-switcher-list" data-onboarding-target="basemap-list">
                {filteredBasemaps.map(basemap => (
                    <div
                        key={basemap.id}
                        className={`basemap-switcher-item${currentBasemap === basemap.id ? ' basemap-switcher-item--active' : ''}`}
                        data-basemap-id={basemap.id}
                        data-onboarding-target={currentBasemap === basemap.id ? 'basemap-active-item' : 'basemap-item'}
                        onClick={() => handleSelect(basemap)}
                    >
                        <img
                            className="basemap-switcher-thumb"
                            src={basemap.thumbnailNeedsToken ? basemap.thumbnail + token : basemap.thumbnail}
                            alt={basemap.label}
                            loading="lazy"
                        />
                        <div className="basemap-switcher-text">
                            <span className="basemap-switcher-label">{basemap.label}</span>
                            <span className="basemap-switcher-desc">{basemap.description}</span>
                            {basemap.sourceUrl && (
                                <a className="basemap-switcher-credit" href={basemap.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>
                                    {basemap.sourceLabel}
                                </a>
                            )}
                        </div>
                    </div>
                ))}
                {filteredBasemaps.length === 0 && (
                    <div className="basemap-switcher-empty">No map style matches your search.</div>
                )}
            </div>
        </div>
        <BasemapPanelOnboarding
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            isPanelCollapsed={!isOpen}
        />
        </>
    );
}
