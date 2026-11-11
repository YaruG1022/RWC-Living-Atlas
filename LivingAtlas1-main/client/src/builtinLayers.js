// Labels, map IDs and data provenance live together. Local data is served by
// this application; upstream URLs below are credits, never runtime data sources.
const naturalEarthCredit = '<a href="https://www.naturalearthdata.com/">Natural Earth</a> (public domain)';

export const BUILTIN_LAYERS = [
    {
        id: 'River', label: 'Hydrological Boundaries', color: '#7063ac', geometry: 'polygon', fillOpacity: 0.25,
        file: 'watersheds.geojson', layerIds: ['builtin-watershed-fill', 'builtin-watershed-outline'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'USGS HUC8 subbasin boundaries intersecting the WA / OR / ID region. Generalized drainage areas, not river channels. Full subbasins can extend across state borders.',
        sourceLabel: 'USGS · Watershed Boundary Dataset',
        sourceUrl: 'https://www.usgs.gov/national-hydrography/watershed-boundary-dataset',
        attribution: '<a href="https://www.usgs.gov/national-hydrography/watershed-boundary-dataset">USGS WBD</a> (public domain)',
        codeLabel: 'HUC8',
    },
    {
        id: 'Rivers', label: 'Rivers', color: '#2563a6', geometry: 'line',
        file: 'rivers.geojson', layerIds: ['builtin-rivers-line'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'Major rivers and connecting lake centerlines in the WA / OR / ID region and border areas. Generalized 1:10 million overview; smaller rivers and tributaries may be absent.',
        sourceLabel: 'Natural Earth · Public domain', sourceUrl: 'https://www.naturalearthdata.com/',
        attribution: naturalEarthCredit,
    },
    {
        id: 'Places', label: 'City Limits', color: '#b84f68', geometry: 'polygon', fillOpacity: 0.35,
        file: 'cities.geojson', layerIds: ['builtin-city-fill', 'builtin-city-outline'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'Census TIGERweb incorporated place boundaries for WA / OR / ID. Generalized city and town limits; excludes census-designated places and urban growth areas. Snapshot for reference, not legal boundary determination.',
        sourceLabel: 'U.S. Census Bureau · TIGERweb',
        sourceUrl: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4',
        attribution: '<a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html">U.S. Census Bureau</a> (public domain)',
        codeLabel: 'Census GEOID',
    },
    {
        id: 'Forest', label: 'National Forests', color: '#34834b', geometry: 'polygon', fillOpacity: 0.35,
        file: 'forests.geojson', layerIds: ['builtin-forest-fill', 'builtin-forest-outline'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'Selected WA / OR / ID national forest proclaimed boundaries. Generalized boundaries, not tree cover or a complete forest inventory.',
        sourceLabel: 'USFS via Theodore Roosevelt Presidential Library',
        sourceUrl: 'https://github.com/Theodore-Roosevelt-Presidential-Library/PresidentialPublicLands',
        attribution: 'USFS; <a href="https://github.com/Theodore-Roosevelt-Presidential-Library/PresidentialPublicLands">Theodore Roosevelt Presidential Library</a> (MIT)',
    },
    {
        id: 'Lake', label: 'Lakes & Reservoirs', color: '#197db4', geometry: 'polygon', fillOpacity: 0.8,
        file: 'lakes.geojson', layerIds: ['builtin-lake-fill', 'builtin-lake-outline'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'Major lakes and reservoirs in the WA / OR / ID region and border areas. Generalized 1:10 million overview; smaller water bodies may be absent.',
        sourceLabel: 'Natural Earth · Public domain', sourceUrl: 'https://www.naturalearthdata.com/',
        attribution: naturalEarthCredit,
    },
    {
        id: 'Roads', label: 'Major Roads', color: '#b7681e', geometry: 'line',
        file: 'roads.geojson', layerIds: ['builtin-roads-line'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'Generalized roads in the WA / OR / ID region and border areas. Regional overview, not a complete street network or navigation data.',
        sourceLabel: 'Natural Earth · Public domain', sourceUrl: 'https://www.naturalearthdata.com/',
        attribution: naturalEarthCredit,
    },
];

export const LOCAL_BUILTIN_LAYERS = BUILTIN_LAYERS.filter(layer => layer.file);
export const BUILTIN_STATUS_EVENT = 'atlas:builtin-layer-status';
export const builtinDataUrl = file => `${process.env.PUBLIC_URL || ''}/data/builtin-layers/${file}`;
export const defaultAreaVisibility = () => Object.fromEntries([
    ...BUILTIN_LAYERS.map(layer => [layer.id, false]), ['Watershed', false],
]);

export function matchingBuiltinLayers(keyword, searchType, layers = BUILTIN_LAYERS) {
    const query = String(keyword || '').trim().toLowerCase();
    if (!query || searchType === 'service') return [];
    const folderMatch = 'built-in layers'.includes(query);
    return layers.filter(layer => searchType === 'folder' ? folderMatch : layer.label.toLowerCase().includes(query) || (searchType === 'any' && folderMatch));
}

export function builtinSearchMatches(layers) {
    return layers.map(layer => ({ id: `builtin-layer-${layer.id}`, type: 'builtin', stateCode: '__builtin__' }));
}
