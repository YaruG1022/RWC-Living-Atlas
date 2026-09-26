import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchServicesByStateMap } from './arcgisServicesDb';
import { fetchArcgisLayers, fetchArcgisLegend } from './arcgisDataUtils';
import { buildLayerTree, getAllLeafLayers, getDescendantLeafLayers } from './LayerTree';
import './LayerTree.css';
import { filterUploadPanelData } from './arcgisUploadSearchUtils';
import { buildMatchList, useSearchNav } from './arcgisSearchNavUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faChevronUp, faChevronDown, faFolder } from '@fortawesome/free-solid-svg-icons';
import './ArcGISPickerModal.css';

const STATE_CODES = ['WA', 'ID', 'OR'];
const STATE_FULL_NAMES = {
    WA: 'Washington State ArcGIS Services',
    ID: 'Idaho ArcGIS Services',
    OR: 'Oregon ArcGIS Services',
};
function ArcGISPickerModal({ onAdd, onClose }) {
    const [servicesFromDb, setServicesFromDb] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [serviceLayers, setServiceLayers] = useState({});
    const [serviceLegends, setServiceLegends] = useState({});
    const [expandedStates, setExpandedStates] = useState(new Set());
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [expandedServices, setExpandedServices] = useState(new Set());
    const [expandedLayers, setExpandedLayers] = useState(new Set());
    // selectedItems: Map<string, object>  key = "service:key" | "layer:serviceKey:layerId"
    const [selectedItems, setSelectedItems] = useState(new Map());
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchType, setSearchType] = useState('any');
    const [searchResult, setSearchResult] = useState(null);
    const [serviceLayersLoading, setServiceLayersLoading] = useState({});
    const [currentPath, setCurrentPath] = useState({ stateCode: null, folder: null });
    const activeSearchRef = useRef(null);

    // Build per-state service lists (memoized to stabilize matchList)
    const allServicesByState = useMemo(() => {
        const result = {};
        STATE_CODES.forEach(code => {
            result[code] = servicesFromDb[code] || [];
        });
        return result;
    }, [servicesFromDb]);
    const allServices = STATE_CODES.flatMap(code => allServicesByState[code]);

    // Search navigation
    const matchList = useMemo(
        () => buildMatchList({ searchResult, allServicesByState, stateCodes: STATE_CODES, serviceLayers }),
        [searchResult, allServicesByState, serviceLayers]
    );
    const { currentIndex, total: matchTotal, currentMatchId, goToNext, goToPrev, initNav, resetNav } = useSearchNav(matchList);

    // Group by state + folder
    const servicesByStateAndFolder = {};
    STATE_CODES.forEach(code => {
        const byFolder = {};
        (allServicesByState[code] || []).forEach(service => {
            const folder = service.folder || 'Root';
            if (!byFolder[folder]) byFolder[folder] = [];
            byFolder[folder].push(service);
        });
        servicesByStateAndFolder[code] = {
            folders: byFolder,
            folderNames: Object.keys(byFolder).sort(),
        };
    });

    // Fetch services from DB on mount
    useEffect(() => {
        let active = true;
        (async () => {
            setIsLoading(true);
            try {
                const stateMap = await fetchServicesByStateMap(STATE_CODES, { type: 'MapServer' });
                if (active) setServicesFromDb(stateMap);
            } catch { }
            if (active) setIsLoading(false);
        })();
        return () => { active = false; };
    }, []);

    // Fetch layers and legends when a service is expanded
    useEffect(() => {
        expandedServices.forEach(serviceKey => {
            const service = allServices.find(s => s.key === serviceKey);
            if (!service || !service.url) return;
            if (serviceLayers[serviceKey] === undefined) {
                fetchArcgisLayers(service.url).then(layers => {
                    setServiceLayers(prev => ({ ...prev, [serviceKey]: layers || [] }));
                }).catch(() => {
                    setServiceLayers(prev => ({ ...prev, [serviceKey]: [] }));
                });
            }
            if (serviceLegends[serviceKey] === undefined) {
                fetchArcgisLegend(service.url).then(legend => {
                    setServiceLegends(prev => ({ ...prev, [serviceKey]: legend || {} }));
                }).catch(() => {
                    setServiceLegends(prev => ({ ...prev, [serviceKey]: {} }));
                });
            }
        });
    }, [expandedServices]); // eslint-disable-line react-hooks/exhaustive-deps

    // Scoped search helpers — mirrors ArcgisUploadPanel
    const getScopedServices = () => {
        if (currentPath.stateCode !== null) {
            const stateServices = allServicesByState[currentPath.stateCode] || [];
            if (currentPath.folder !== null) {
                return stateServices.filter(s => (s.folder || 'Root') === currentPath.folder);
            }
            return stateServices;
        }
        return allServices;
    };
    const getScopedStateCodes = () => {
        if (currentPath.stateCode !== null) return [currentPath.stateCode];
        return STATE_CODES;
    };

    // Trigger layer loading for unloaded services when searching (non-blocking)
    const triggerLayerLoadForSearch = (type, scopedServicesList) => {
        if (type !== 'any' && type !== 'layer') return;
        scopedServicesList.forEach(service => {
            if (!service?.url || !service?.key) return;
            if (serviceLayers[service.key] !== undefined) return;
            if (serviceLayersLoading[service.key]) return;
            setServiceLayersLoading(prev => ({ ...prev, [service.key]: true }));
            fetchArcgisLayers(service.url)
                .then(layers => {
                    setServiceLayers(prev => ({ ...prev, [service.key]: layers || [] }));
                })
                .catch(() => {
                    setServiceLayers(prev => ({ ...prev, [service.key]: [] }));
                })
                .finally(() => {
                    setServiceLayersLoading(prev => {
                        const next = { ...prev };
                        delete next[service.key];
                        return next;
                    });
                });
        });
    };

    const handleSearch = (keyword, type) => {
        if (!keyword.trim()) {
            activeSearchRef.current = null;
            setSearchResult(null);
            setExpandedStates(new Set());
            setExpandedFolders(new Set());
            setExpandedServices(new Set());
            setExpandedLayers(new Set());
            resetNav();
            return;
        }
        const scopedServicesList = getScopedServices();
        const scopedCodes = getScopedStateCodes();
        const result = filterUploadPanelData({ services: scopedServicesList, serviceLayers, searchType: type, keyword });
        setSearchResult(result);
        activeSearchRef.current = { keyword, searchType: type, scopedServices: scopedServicesList, scopedStateCodes: scopedCodes };
        setExpandedStates(new Set(scopedCodes));
        setExpandedFolders(new Set(result.expandedFolders));
        setExpandedServices(new Set(result.expandedServices));
        setExpandedLayers(new Set(result.expandedLayerKeys));
        const mList = buildMatchList({ searchResult: result, allServicesByState, stateCodes: scopedCodes, serviceLayers });
        initNav(mList.length);
        triggerLayerLoadForSearch(type, scopedServicesList);
    };

    const handleClear = () => {
        activeSearchRef.current = null;
        setSearchKeyword('');
        setSearchResult(null);
        setExpandedStates(new Set());
        setExpandedFolders(new Set());
        setExpandedServices(new Set());
        setExpandedLayers(new Set());
        resetNav();
    };

    const toggleSelect = (key, item) => {
        setSelectedItems(prev => {
            const next = new Map(prev);
            if (next.has(key)) next.delete(key);
            else next.set(key, item);
            return next;
        });
    };

    const handleAdd = () => {
        if (selectedItems.size === 0) return;
        onAdd(Array.from(selectedItems.values()));
    };

    // Re-run filter when layers load in during active search (matches upload panel behavior)
    useEffect(() => {
        if (!activeSearchRef.current) return;
        const { keyword, searchType: type, scopedServices, scopedStateCodes } = activeSearchRef.current;
        const result = filterUploadPanelData({ services: scopedServices, serviceLayers, searchType: type, keyword });
        setSearchResult(result);
        setExpandedFolders(new Set(result.expandedFolders));
        setExpandedServices(new Set(result.expandedServices));
        setExpandedLayers(new Set(result.expandedLayerKeys));
        const mList = buildMatchList({ searchResult: result, allServicesByState, stateCodes: scopedStateCodes, serviceLayers });
        initNav(mList.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serviceLayers]);

    const isSearchLoadingLayers = searchResult !== null && Object.keys(serviceLayersLoading).length > 0;

    // Drill-down navigation handlers
    const handleStateNavigate = (code) => {
        activeSearchRef.current = null;
        setSearchResult(null);
        setSearchKeyword('');
        resetNav();
        setCurrentPath({ stateCode: code, folder: null });
    };
    const handleFolderNavigate = (folder) => {
        activeSearchRef.current = null;
        setSearchResult(null);
        setSearchKeyword('');
        resetNav();
        setCurrentPath(prev => ({ stateCode: prev.stateCode, folder }));
    };
    const handleNavBack = () => {
        activeSearchRef.current = null;
        setSearchResult(null);
        setSearchKeyword('');
        resetNav();
        setCurrentPath(prev => {
            if (prev.folder !== null) return { stateCode: prev.stateCode, folder: null };
            return { stateCode: null, folder: null };
        });
    };

    // Render a single layer node (and its children recursively)
    // Uses tree-node/tree-children/upload-layer-group/upload-layer-row for visual consistency with upload panel
    const renderLayerNode = (node, service, depth = 0) => {
        const isGroupLayer = node.type === 'Group Layer';
        const hasChildren = node.children && node.children.length > 0;
        const expandKey = `${service.key}-${node.id}`;
        const isExpanded = expandedLayers.has(expandKey);

        const nodeName = node.name || node.label || `Layer ${node.id}`;
        const isLayerNameBold = searchResult?.matchedLayerIds?.[service.key]?.has(node.id) ||
            (searchResult?.keyword && nodeName && nodeName.toLowerCase().includes(searchResult.keyword));

        if (isGroupLayer || hasChildren) {
            const descendantLeaves = getDescendantLeafLayers(node);
            const checkedCount = descendantLeaves.filter(l =>
                selectedItems.has(`layer:${service.key}:${l.id}`)
            ).length;
            const allChecked = descendantLeaves.length > 0 && checkedCount === descendantLeaves.length;
            const someChecked = checkedCount > 0 && !allChecked;
            const groupMatchId = isLayerNameBold ? `layer-${service.key}-${node.id}` : undefined;
            return (
                <div
                    key={node.id}
                    className={`tree-node${currentMatchId === groupMatchId && groupMatchId ? ' search-nav-current' : ''}`}
                    data-search-match-id={groupMatchId}
                >
                    <div
                        className="upload-layer-group"
                        onClick={() => setExpandedLayers(prev => {
                            const n = new Set(prev);
                            n.has(expandKey) ? n.delete(expandKey) : n.add(expandKey);
                            return n;
                        })}
                    >
                        <input
                            type="checkbox"
                            checked={allChecked}
                            ref={el => { if (el) el.indeterminate = someChecked; }}
                            onChange={(e) => {
                                e.stopPropagation();
                                setSelectedItems(prev => {
                                    const next = new Map(prev);
                                    if (allChecked) {
                                        descendantLeaves.forEach(l => next.delete(`layer:${service.key}:${l.id}`));
                                    } else {
                                        descendantLeaves.forEach(l => next.set(`layer:${service.key}:${l.id}`, {
                                            service_key: service.key,
                                            layer_id: l.id,
                                            sublayer_index: null,
                                            display_name: l.name || l.label || `Layer ${l.id}`,
                                            item_type: 'layer',
                                            state_code: findStateForService(service.key),
                                            folder_name: service.folder || 'Root',
                                        }));
                                    }
                                    return next;
                                });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginRight: 4 }}
                        />
                        <span style={{ color: '#666', userSelect: 'none', marginRight: 4 }}>
                            {isExpanded ? '▼' : '►'}
                        </span>
                        <span className="upload-layer-name" title={nodeName} style={{ flex: 1, fontWeight: isLayerNameBold ? 'bold' : 'normal' }}>
                            {nodeName}
                        </span>
                        {descendantLeaves.length > 0 && (
                            <span style={{ color: '#999', fontSize: '10px', marginLeft: 4 }}>
                                ({checkedCount}/{descendantLeaves.length})
                            </span>
                        )}
                    </div>
                    {isExpanded && hasChildren && (
                        <div className="tree-children">
                            {node.children.map(child => renderLayerNode(child, service, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        // Leaf node — show legend icon(s)
        const layerKey = `layer:${service.key}:${node.id}`;
        const isChecked = selectedItems.has(layerKey);
        const legend = serviceLegends[service.key];
        let legendItems = [];
        if (legend && legend.layers) {
            const legendLayer = legend.layers.find(l => l.layerId === node.id);
            if (legendLayer) legendItems = legendLayer.legend || [];
        }
        const hasMultipleLegends = legendItems.length > 1;
        const isLegendExpanded = expandedLayers.has(expandKey);
        const leafMatchId = isLayerNameBold ? `layer-${service.key}-${node.id}` : undefined;

        return (
            <div
                key={node.id}
                className={`upload-layer-row tree-node${currentMatchId === leafMatchId && leafMatchId ? ' search-nav-current' : ''}`}
                data-search-match-id={leafMatchId}
                style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: 2 }}
            >
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 20, width: '100%', cursor: hasMultipleLegends ? 'pointer' : 'default' }}
                    onClick={hasMultipleLegends ? () => setExpandedLayers(prev => {
                        const n = new Set(prev);
                        n.has(expandKey) ? n.delete(expandKey) : n.add(expandKey);
                        return n;
                    }) : undefined}
                >
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(layerKey, {
                            service_key: service.key,
                            layer_id: node.id,
                            sublayer_index: null,
                            display_name: node.name || node.label || `Layer ${node.id}`,
                            item_type: 'layer',
                            state_code: findStateForService(service.key),
                            folder_name: service.folder || 'Root',
                        })}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: 4 }}
                    />
                    {hasMultipleLegends && (
                        <span style={{ color: '#666', marginRight: 4, userSelect: 'none', fontSize: '0.72rem' }}>
                            {isLegendExpanded ? '▼' : '►'}
                        </span>
                    )}
                    {legendItems.length === 1 && (
                        <img
                            src={`data:${legendItems[0].contentType};base64,${legendItems[0].imageData}`}
                            alt={legendItems[0].label || ''}
                            className="legend-img"
                            style={{ width: 14, height: 14, flexShrink: 0 }}
                        />
                    )}
                    <span className="upload-layer-name" title={nodeName} style={{ flex: 1, fontWeight: isLayerNameBold ? 'bold' : 'normal' }}>
                        {nodeName}
                    </span>
                    {hasMultipleLegends && (
                        <span style={{ color: '#888', fontSize: '10px', marginLeft: 4, flexShrink: 0 }}>
                            ({legendItems.length})
                        </span>
                    )}
                </div>
                {hasMultipleLegends && isLegendExpanded && (
                    <div className="tree-children" style={{ marginTop: 2 }}>
                        {legendItems.map((legendItem, index) => (
                            <div
                                key={index}
                                className="upload-layer-sublayer tree-node"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, color: '#666', minHeight: 18 }}
                            >
                                <img
                                    src={`data:${legendItem.contentType};base64,${legendItem.imageData}`}
                                    alt={legendItem.label || ''}
                                    className="legend-img"
                                    style={{ width: 14, height: 14, flexShrink: 0 }}
                                />
                                <span className="upload-layer-name" title={legendItem.label}>{legendItem.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const findStateForService = (serviceKey) => {
        for (const code of STATE_CODES) {
            if ((allServicesByState[code] || []).some(s => s.key === serviceKey)) return code;
        }
        return 'WA';
    };

    // Shared service block renderer (used by both search mode and navigation mode)
    const renderServiceBlock = (service, stateCode) => {
        const serviceKey = `service:${service.key}`;
        const layers = serviceLayers[service.key];
        const rawLayers = Array.isArray(layers) && layers.length > 0
            ? layers
            : (Array.isArray(service.layers) ? service.layers : []);
        const layerTree = buildLayerTree(rawLayers);
        const allLeafLayers = getAllLeafLayers(layerTree);
        const checkedLeafCount = allLeafLayers.filter(l => selectedItems.has(`layer:${service.key}:${l.id}`)).length;
        const isServiceSelected = selectedItems.has(serviceKey);
        const allLayersChecked = allLeafLayers.length > 0 && checkedLeafCount === allLeafLayers.length;
        const someLayersChecked = checkedLeafCount > 0 && checkedLeafCount < allLeafLayers.length;
        const isServiceExpanded = expandedServices.has(service.key);
        const layersLoading = (isServiceExpanded && layers === undefined) || !!serviceLayersLoading[service.key];

        return (
            <div key={service.key} className="arcgis-picker-service-block">
                <div
                    className={`arcgis-picker-service-row${currentMatchId === `service-${service.key}` ? ' search-nav-current' : ''}`}
                    data-search-match-id={searchResult?.matchedServiceKeys?.has(service.key) ? `service-${service.key}` : undefined}
                    onClick={() => setExpandedServices(prev => {
                        const n = new Set(prev);
                        n.has(service.key) ? n.delete(service.key) : n.add(service.key);
                        return n;
                    })}
                >
                    <input
                        type="checkbox"
                        className="arcgis-picker-checkbox"
                        checked={isServiceSelected || allLayersChecked}
                        ref={el => { if (el) el.indeterminate = !isServiceSelected && someLayersChecked; }}
                        onChange={e => {
                            e.stopPropagation();
                            if (allLeafLayers.length > 0) {
                                setSelectedItems(prev => {
                                    const n = new Map(prev);
                                    if (allLayersChecked) {
                                        allLeafLayers.forEach(l => n.delete(`layer:${service.key}:${l.id}`));
                                    } else {
                                        allLeafLayers.forEach(l => n.set(`layer:${service.key}:${l.id}`, {
                                            service_key: service.key,
                                            layer_id: l.id,
                                            sublayer_index: null,
                                            display_name: l.name || l.label || `Layer ${l.id}`,
                                            item_type: 'layer',
                                            state_code: stateCode,
                                            folder_name: service.folder || 'Root',
                                        }));
                                        n.delete(serviceKey);
                                    }
                                    return n;
                                });
                            } else {
                                toggleSelect(serviceKey, {
                                    service_key: service.key,
                                    layer_id: null,
                                    sublayer_index: null,
                                    display_name: service.label,
                                    item_type: 'service',
                                    state_code: stateCode,
                                    folder_name: service.folder || 'Root',
                                });
                            }
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                    <span className="arcgis-picker-arrow">{isServiceExpanded ? '▼' : '►'}</span>
                    <span className="arcgis-picker-service-label">{service.label}</span>
                    {layersLoading && (
                        <span className="arcgis-picker-fetching"> (loading...)</span>
                    )}
                </div>
                {isServiceExpanded && !layersLoading && (
                    <div className="arcgis-picker-layers-content">
                        {layerTree.length === 0 ? (
                            <p className="arcgis-picker-no-layers">No layers found.</p>
                        ) : (
                            layerTree.map(node => renderLayerNode(node, service))
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderTree = () => {
        if (isLoading) {
            return <p className="arcgis-picker-loading-msg">Loading ArcGIS services...</p>;
        }
        if (allServices.length === 0) {
            return <p className="arcgis-picker-loading-msg">No ArcGIS services available from database.</p>;
        }

        // SEARCH MODE: accordion across all states that have matching items
        if (searchResult) {
            return STATE_CODES.map(stateCode => {
                const stateData = servicesByStateAndFolder[stateCode];
                if (!stateData) return null;

                const foldersToShow = stateData.folderNames.filter(folder => {
                    const searched = searchResult.filteredFolders?.[folder] || [];
                    return searched.length > 0;
                });
                if (foldersToShow.length === 0) return null;

                const isStateExpanded = expandedStates.has(stateCode);
                return (
                    <div key={stateCode}>
                        <div
                            className="arcgis-picker-state-row"
                            onClick={() => setExpandedStates(prev => {
                                const n = new Set(prev);
                                n.has(stateCode) ? n.delete(stateCode) : n.add(stateCode);
                                return n;
                            })}
                        >
                            <span className="arcgis-picker-arrow">{isStateExpanded ? '▼' : '►'}</span>
                            {STATE_FULL_NAMES[stateCode]}
                        </div>
                        {isStateExpanded && (
                            <div className="arcgis-picker-state-content">
                                {foldersToShow.map(folder => {
                                    const searched = searchResult.filteredFolders?.[folder] || [];
                                    const searchedKeys = new Set(searched.map(s => s.key));
                                    const services = (stateData.folders[folder] || []).filter(s => searchedKeys.has(s.key));
                                    if (services.length === 0) return null;
                                    const isFolderExpanded = expandedFolders.has(folder);
                                    const isFolderMatch = searchResult?.matchedFolderNames?.has(folder);
                                    return (
                                        <div key={folder}>
                                            <div
                                                className={`arcgis-picker-folder-row${currentMatchId === `folder-${stateCode}-${folder}` ? ' search-nav-current' : ''}`}
                                                data-search-match-id={isFolderMatch ? `folder-${stateCode}-${folder}` : undefined}
                                                onClick={() => setExpandedFolders(prev => {
                                                    const n = new Set(prev);
                                                    n.has(folder) ? n.delete(folder) : n.add(folder);
                                                    return n;
                                                })}
                                            >
                                                <span className="arcgis-picker-arrow">{isFolderExpanded ? '▼' : '►'}</span>
                                                <span style={{ fontWeight: isFolderMatch ? 'bold' : undefined }}>{folder}</span>
                                            </div>
                                            {isFolderExpanded && (
                                                <div className="arcgis-picker-folder-content">
                                                    {services.map(service => renderServiceBlock(service, stateCode))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            });
        }

        // NAVIGATION MODE: drill-down (mirrors ArcgisUploadPanel)
        return (
            <>
                {/* ROOT: list states */}
                {currentPath.stateCode === null && STATE_CODES.map(stateCode => (
                    <div
                        key={stateCode}
                        className="arcgis-picker-nav-state-row"
                        onClick={() => handleStateNavigate(stateCode)}
                    >
                        <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" />
                        {STATE_FULL_NAMES[stateCode]}
                    </div>
                ))}

                {/* STATE VIEW: folder list */}
                {currentPath.stateCode !== null && currentPath.folder === null && (
                    (servicesByStateAndFolder[currentPath.stateCode]?.folderNames || []).map(folder => (
                        <div
                            key={folder}
                            className="arcgis-picker-nav-folder-row"
                            onClick={() => handleFolderNavigate(folder)}
                        >
                            <FontAwesomeIcon icon={faFolder} className="arcgis-picker-nav-folder-icon" />
                            {folder}
                        </div>
                    ))
                )}

                {/* FOLDER VIEW: service list */}
                {currentPath.stateCode !== null && currentPath.folder !== null && (
                    (servicesByStateAndFolder[currentPath.stateCode]?.folders[currentPath.folder] || []).map(service =>
                        renderServiceBlock(service, currentPath.stateCode)
                    )
                )}
            </>
        );
    };

    return (
        <div className="arcgis-picker-overlay" onClick={onClose}>
            <div className="arcgis-picker-modal" onClick={e => e.stopPropagation()}>
                {/* Header: search bar + close button */}
                <div className="arcgis-picker-header">
                    <div className="arcgis-picker-search-row">
                        <input
                            type="text"
                            className="arcgis-picker-search-input"
                            value={searchKeyword}
                            onChange={e => setSearchKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch(searchKeyword, searchType)}
                            placeholder={
                                currentPath.folder !== null
                                    ? `Search in "${currentPath.folder}"…`
                                    : currentPath.stateCode !== null
                                        ? `Search in ${STATE_FULL_NAMES[currentPath.stateCode] || currentPath.stateCode}…`
                                        : 'Search folders, services, or layers…'
                            }
                        />
                        <select
                            value={searchType}
                            onChange={e => setSearchType(e.target.value)}
                            className="arcgis-picker-search-type-select"
                        >
                            <option value="any">Any</option>
                            <option value="folder">Folder</option>
                            <option value="service">Service</option>
                            <option value="layer">Layer</option>
                        </select>
                        <button
                            type="button"
                            className="arcgis-picker-search-btn"
                            title="Search"
                            onClick={() => handleSearch(searchKeyword, searchType)}
                        >
                            <FontAwesomeIcon icon={faSearch} />
                        </button>
                        <button
                            type="button"
                            className="arcgis-picker-clear-btn"
                            title="Clear search"
                            onClick={handleClear}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                    {isSearchLoadingLayers && (
                        <div className="arcgis-picker-search-loading">
                            <span className="arcgis-picker-search-loading-spinner" />
                            Searching… loading more results ({Object.keys(serviceLayersLoading).length} remaining)
                        </div>
                    )}
                </div>

                {/* Breadcrumb — shown between header and body when drilled into a state/folder */}
                {!searchResult && currentPath.stateCode !== null && (
                    <div className="arcgis-picker-breadcrumb">
                        <button type="button" className="arcgis-picker-back-btn" onClick={handleNavBack} title="Back">←</button>
                        <span className="arcgis-picker-breadcrumb-path">
                            {currentPath.folder !== null
                                ? <>{STATE_FULL_NAMES[currentPath.stateCode]} <span className="arcgis-picker-breadcrumb-sep">/</span> {currentPath.folder}</>
                                : STATE_FULL_NAMES[currentPath.stateCode]
                            }
                        </span>
                    </div>
                )}

                {/* Body: tree */}
                <div className="arcgis-picker-body">
                    {renderTree()}
                </div>

                {/* Search nav mini modal — floats at top-right of the body area */}
                {searchResult && (
                    <div className="arcgis-picker-nav-mini">
                        <span className="arcgis-picker-nav-mini-counter">
                            {matchTotal > 0 ? `${currentIndex + 1} / ${matchTotal}` : '0 results'}
                        </span>
                        <button
                            type="button"
                            className="arcgis-picker-nav-btn"
                            title="Previous match"
                            onClick={goToPrev}
                            disabled={matchTotal === 0}
                        >
                            <FontAwesomeIcon icon={faChevronUp} />
                        </button>
                        <button
                            type="button"
                            className="arcgis-picker-nav-btn"
                            title="Next match"
                            onClick={goToNext}
                            disabled={matchTotal === 0}
                        >
                            <FontAwesomeIcon icon={faChevronDown} />
                        </button>
                    </div>
                )}

                {/* Footer: selected count + add/cancel */}
                <div className="arcgis-picker-footer">
                    <span className="arcgis-picker-count">
                        {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="arcgis-picker-footer-btns">
                        <button type="button" className="arcgis-picker-cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="arcgis-picker-add-btn"
                            onClick={handleAdd}
                            disabled={selectedItems.size === 0}
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ArcGISPickerModal;
