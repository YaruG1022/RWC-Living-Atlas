export function filterUploadPanelData({ services, serviceLayers, searchType, keyword }) {
    if (!keyword) return null; // Show all if no keyword

    const lowerKeyword = keyword.toLowerCase();

    // Helper to check if a string contains the keyword
    const matches = (str) => str && str.toLowerCase().includes(lowerKeyword);

    // Filter logic
    const filteredFolders = Object.create(null);
    let expandedFolders = new Set();
    let expandedServices = new Set();
    let expandedLayerKeys = new Set(); // Track group/layer expand keys: "serviceKey-layerId"

    // Track which items matched the keyword for bold highlighting
    let matchedFolderNames = new Set();
    let matchedServiceKeys = new Set();
    let matchedLayerIds = {};  // { serviceKey: Set of layer ids }

    // Helper: given a flat layer list and a matched layer id, find all ancestor layer ids
    function getAncestorIds(flatLayers, layerId) {
        const layerMap = {};
        flatLayers.forEach(l => { layerMap[l.id] = l; });
        const ancestors = [];
        let current = layerMap[layerId];
        while (current) {
            const pid = current.parentLayer ? current.parentLayer.id : (current.parentLayerId !== undefined ? current.parentLayerId : -1);
            if (pid === -1 || pid === null || pid === undefined || !layerMap[pid]) break;
            ancestors.push(pid);
            current = layerMap[pid];
        }
        return ancestors;
    }

    services.forEach(service => {
        const folder = service.folder || 'Root';
        const layers = serviceLayers[service.key] || [];

        let folderMatch = matches(folder);
        let serviceMatch = matches(service.label);

        // Find layers matching the keyword (by name)
        const layersMatchingKeyword = layers.filter(layer => matches(layer.name));

        let showService = false;
        if (searchType === 'folder') {
            if (folderMatch) {
                showService = true;
                expandedFolders.add(folder);
                matchedFolderNames.add(folder);
                expandedServices.add(service.key);
            }
        }
        if (searchType === 'service') {
            if (serviceMatch) {
                showService = true;
                expandedFolders.add(folder);
                expandedServices.add(service.key);
                matchedServiceKeys.add(service.key);
            }
        }
        if (searchType === 'layer') {
            if (layersMatchingKeyword.length > 0) {
                showService = true;
                expandedFolders.add(folder);
                expandedServices.add(service.key);
                matchedLayerIds[service.key] = new Set(layersMatchingKeyword.map(l => l.id));
                // Expand ancestor group layers for each matched layer
                layersMatchingKeyword.forEach(l => {
                    getAncestorIds(layers, l.id).forEach(aid => {
                        expandedLayerKeys.add(`${service.key}-${aid}`);
                    });
                });
            }
        }
        if (searchType === 'any') {
            if (folderMatch) matchedFolderNames.add(folder);
            if (serviceMatch) matchedServiceKeys.add(service.key);
            if (layersMatchingKeyword.length > 0) {
                matchedLayerIds[service.key] = new Set(layersMatchingKeyword.map(l => l.id));
            }
            if (folderMatch || serviceMatch || layersMatchingKeyword.length > 0) {
                showService = true;
                expandedFolders.add(folder);
                expandedServices.add(service.key);
                // Expand ancestor group layers for matched layers
                layersMatchingKeyword.forEach(l => {
                    getAncestorIds(layers, l.id).forEach(aid => {
                        expandedLayerKeys.add(`${service.key}-${aid}`);
                    });
                });
            }
        }

        if (showService) {
            filteredFolders[folder] = filteredFolders[folder] || [];
            filteredFolders[folder].push({
                ...service,
                layers: searchType === 'layer' ? layersMatchingKeyword : layers
            });
        }
    });

    return { filteredFolders, expandedFolders, expandedServices, expandedLayerKeys, matchedFolderNames, matchedServiceKeys, matchedLayerIds, keyword: lowerKeyword };
}
