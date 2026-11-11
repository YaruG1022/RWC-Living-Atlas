// Labels, map IDs and data provenance live together. Local data is served by
// this application; upstream URLs below are credits, never runtime data sources.
const naturalEarthCredit = '<a href="https://www.naturalearthdata.com/">Natural Earth</a> (public domain)';

export const BUILTIN_LAYERS = [
    { id: 'River', label: 'Hydrological Boundaries', layerIds: ['vector-tileset'] },
    { id: 'Places', label: 'City Limits', layerIds: ['urban-areas-fill', 'urban-areas-outline'] },
    {
        id: 'Forest', label: 'National Forests', color: '#34834b', geometry: 'polygon',
        file: 'forests.geojson', layerIds: ['builtin-forest-fill', 'builtin-forest-outline'],
        bounds: [[-125, 41.9], [-110.8, 49.1]],
        description: 'Selected WA / OR / ID national forest proclaimed boundaries. Generalized boundaries, not tree cover or a complete forest inventory.',
        sourceLabel: 'USFS via Theodore Roosevelt Presidential Library',
        sourceUrl: 'https://github.com/Theodore-Roosevelt-Presidential-Library/PresidentialPublicLands',
        attribution: 'USFS; <a href="https://github.com/Theodore-Roosevelt-Presidential-Library/PresidentialPublicLands">Theodore Roosevelt Presidential Library</a> (MIT)',
    },
    {
        id: 'Lake', label: 'Lakes & Reservoirs', color: '#197db4', geometry: 'polygon',
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
