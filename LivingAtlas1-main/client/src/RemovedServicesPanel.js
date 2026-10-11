import React, { useState, useEffect } from 'react';
import './RemovedServicesPanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faUndo, faTimes, faSearch, faSpinner, faSync } from '@fortawesome/free-solid-svg-icons';
import { fetchRemovedArcgisServices, restoreArcgisService, permanentlyDeleteRemovedService, clearAllRemovedServices } from './arcgisServicesDb';
import { filterRemovedServicesData, highlightSearchTerm } from './removedServicesSearchUtils';

function RemovedServicesPanel({ isOpen, onClose, isAdmin = false }) {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchType, setSearchType] = useState('any'); // 'any', 'folder', 'service', 'layer'
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [expandedServices, setExpandedServices] = useState(new Set());
    const [removedServices, setRemovedServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchResult, setSearchResult] = useState(null);
    
    // Fetch removed services from database
    const fetchData = async () => {
        if (!isOpen) return;
        
        setLoading(true);
        setError(null);
        
        try {
            console.log('[RemovedServicesPanel] Starting to fetch removed services...');
            const data = await fetchRemovedArcgisServices(null, { type: 'all' });
            console.log('[RemovedServicesPanel] Fetched removed services:', data);
            console.log('[RemovedServicesPanel] Data type:', typeof data, 'isArray:', Array.isArray(data), 'length:', data?.length);
            
            if (Array.isArray(data)) {
                setRemovedServices(data);
                console.log('[RemovedServicesPanel] Successfully set removed services, count:', data.length);
            } else {
                console.warn('[RemovedServicesPanel] Data is not an array:', data);
                setRemovedServices([]);
            }
        } catch (err) {
            console.error('[RemovedServicesPanel] Error fetching removed services:', err);
            console.error('[RemovedServicesPanel] Error details:', {
                message: err.message,
                status: err.response?.status,
                data: err.response?.data,
                stack: err.stack
            });
            setError(`Failed to load removed services: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
            setRemovedServices([]);
        } finally {
            setLoading(false);
        }
    };
    
    // Fetch data when panel opens
    useEffect(() => {
        fetchData();
    }, [isOpen]);
    
    const mockRemovedServices = [
        {
            key: 'removed-wa-aq-1',
            label: 'Air Quality Monitoring',
            state: 'WA',
            folder: 'Environmental',
            removedDate: '2024-10-12T10:30:00Z',
            layersRemoved: [
                {
                    name: 'PM2.5 Monitoring Stations',
                    sublayers: ['Current Readings', 'Historical Data', 'Alert Zones']
                },
                {
                    name: 'Ozone Levels',
                    sublayers: ['Daily Averages', 'Peak Readings']
                }
            ]
        },
        {
            key: 'removed-id-water-1',
            label: 'Water Resources',
            state: 'ID',
            folder: 'Environmental',
            removedDate: '2024-10-11T14:15:00Z',
            layersRemoved: [
                {
                    name: 'Stream Flow',
                    sublayers: ['Current Flow', 'Seasonal Trends']
                },
                {
                    name: 'Water Quality Points',
                    sublayers: ['pH Levels', 'Temperature', 'Dissolved Oxygen']
                }
            ]
        },
        {
            key: 'removed-or-fire-1',
            label: 'Fire Management',
            state: 'OR',
            folder: 'Safety',
            removedDate: '2024-10-10T09:45:00Z',
            layersRemoved: [
                {
                    name: 'Fire Hazard Zones',
                    sublayers: ['High Risk Areas', 'Moderate Risk Areas']
                },
                {
                    name: 'Emergency Resources',
                    sublayers: ['Fire Stations', 'Evacuation Routes', 'Emergency Shelters']
                }
            ]
        }
    ];

    // Use search results if available, otherwise show all services
    const displayServices = searchResult ? 
        Object.values(searchResult.filteredFolders).flat() : 
        removedServices;

    // Group services by folder
    const servicesByFolder = searchResult ? 
        searchResult.filteredFolders : 
        (() => {
            const folders = {};
            removedServices.forEach(service => {
                const folder = service.folder || 'Root';
                if (!folders[folder]) folders[folder] = [];
                folders[folder].push(service);
            });
            return folders;
        })();
    const folderNames = Object.keys(servicesByFolder).sort();

    // Update expanded folders and services based on search results
    React.useEffect(() => {
        if (searchResult) {
            setExpandedFolders(searchResult.expandedFolders);
            setExpandedServices(searchResult.expandedServices);
        }
    }, [searchResult]);

    // Debounced search effect
    React.useEffect(() => {
        const delayedSearch = setTimeout(() => {
            if (searchKeyword.trim()) {
                performSearch();
            } else {
                setSearchResult(null);
                setExpandedFolders(new Set());
                setExpandedServices(new Set());
            }
        }, 300); // 300ms delay

        return () => clearTimeout(delayedSearch);
    }, [searchKeyword, searchType, removedServices]);

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown date';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid date';
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (err) {
            return 'Invalid date';
        }
    };

    const handleRestore = async (service) => {
        if (!window.confirm(`Are you sure you want to restore "${service.label}" to active services?`)) {
            return;
        }

        try {
            setLoading(true);
            await restoreArcgisService(service.key);
            
            // Remove the service from the local state
            setRemovedServices(prev => prev.filter(s => s.key !== service.key));
            
            // Show success message
            alert(`Service "${service.label}" has been successfully restored to active services.`);
            
        } catch (error) {
            console.error('Error restoring service:', error);
            
            // Show user-friendly error message
            let errorMessage = 'Failed to restore service. ';
            if (error.response?.status === 404) {
                errorMessage += 'The service was not found in removed services.';
            } else if (error.response?.status === 409) {
                // For conflicts, use the detailed message from backend or provide helpful guidance
                if (error.response?.data?.detail) {
                    errorMessage = error.response.data.detail + ' You can also refresh the upload panel to check for new services.';
                } else {
                    errorMessage += 'A service with the same key already exists in the upload panel. Please permanently delete this service from the removed services panel first, then try restoring the new one from the upload panel.';
                }
            } else if (error.response?.data?.detail) {
                errorMessage += error.response.data.detail;
            } else {
                errorMessage += 'Please try again later.';
            }
            
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handlePermanentDelete = async (service) => {
        if (!window.confirm(`Are you sure you want to permanently delete "${service.label}"? This action cannot be undone.`)) {
            return;
        }

        try {
            setLoading(true);
            await permanentlyDeleteRemovedService(service.key);
            
            // Remove the service from the local state
            setRemovedServices(prev => prev.filter(s => s.key !== service.key));
            
            // Show success message
            alert(`Service "${service.label}" has been permanently deleted.`);
            
        } catch (error) {
            console.error('Error permanently deleting service:', error);
            
            // Show user-friendly error message
            let errorMessage = 'Failed to permanently delete service. ';
            if (error.response?.status === 404) {
                errorMessage += 'The service was not found in removed services.';
            } else if (error.response?.data?.detail) {
                errorMessage += error.response.data.detail;
            } else {
                errorMessage += 'Please try again later.';
            }
            
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const clearAllRemoved = async () => {
        if (!window.confirm('Are you sure you want to clear all removed services? This action cannot be undone.')) {
            return;
        }

        try {
            setLoading(true);
            const result = await clearAllRemovedServices();
            
            // Clear the local state
            setRemovedServices([]);
            
            // Show success message with count
            alert(`Successfully cleared ${result.count} removed service(s).`);
            
        } catch (error) {
            console.error('Error clearing all removed services:', error);
            
            // Show user-friendly error message
            let errorMessage = 'Failed to clear all removed services. ';
            if (error.response?.data?.detail) {
                errorMessage += error.response.data.detail;
            } else {
                errorMessage += 'Please try again later.';
            }
            
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Folder click handler
    const handleFolderClick = (folder) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folder)) newSet.delete(folder);
            else newSet.add(folder);
            return newSet;
        });
    };

    // Service click handler
    const handleServiceClick = (serviceKey) => {
        setExpandedServices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(serviceKey)) newSet.delete(serviceKey);
            else newSet.add(serviceKey);
            return newSet;
        });
    };

    // Perform search function
    const performSearch = () => {
        if (!searchKeyword.trim()) {
            setSearchResult(null);
            setExpandedFolders(new Set());
            setExpandedServices(new Set());
            return;
        }
        const result = filterRemovedServicesData({
            services: removedServices,
            searchType,
            keyword: searchKeyword.trim()
        });
        setSearchResult(result);
    };

    // Clear search function
    const clearSearch = () => {
        setSearchKeyword('');
        setSearchType('any');
        setSearchResult(null);
        setExpandedFolders(new Set());
        setExpandedServices(new Set());
    };

    const renderSearchBar = () => (
        <div>
            <div className="removed-services-searchbar">
                <input
                    type="text"
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    placeholder="Search removed services..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            performSearch();
                        }
                    }}
                    disabled={loading}
                />
                <select
                    value={searchType}
                    onChange={e => setSearchType(e.target.value)}
                    className="removed-services-searchbar-dropdown"
                >
                    <option value="any">Any</option>
                    <option value="folder">Folder</option>
                    <option value="service">Service</option>
                    <option value="layer">Layer</option>
                </select>
                <button
                    className="removed-services-search-btn"
                    title="Search"
                    onClick={performSearch}
                    disabled={loading}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
                <button
                    className="removed-services-clear-btn"
                    title="Clear Search"
                    onClick={clearSearch}
                    disabled={loading}
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="removed-services-panel">
            <div className="removed-services-header">
                <div className="removed-services-title">
                    <FontAwesomeIcon icon={faTrash} style={{ marginRight: '8px' }} />
                    Removed Services
                </div>
                <div className="removed-services-header-actions">
                    <button 
                        className="removed-services-refresh" 
                        onClick={fetchData} 
                        title="Refresh"
                        disabled={loading}
                    >
                        <FontAwesomeIcon icon={faSync} spin={loading} />
                    </button>
                    <button className="removed-services-close" onClick={onClose} title="Close">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>

            <div className="removed-services-search">
                {renderSearchBar()}
            </div>

            <div className="removed-services-actions">
                {isAdmin && (
                    <button 
                        className="removed-services-clear-all-btn"
                        title="Clear all removed services"
                        aria-label="Clear all removed services"
                        onClick={clearAllRemoved}
                        disabled={removedServices.length === 0 || loading}
                    >
                        Clear ({removedServices.length})
                    </button>
                )}
            </div>

            <div className="removed-services-content">
                {loading ? (
                    <div className="removed-services-loading">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: '#1976d2', marginBottom: '12px' }} />
                        <p>Loading removed services...</p>
                    </div>
                ) : error ? (
                    <div className="removed-services-error">
                        <p style={{ color: '#d32f2f', marginBottom: '12px' }}>{error}</p>
                        <button 
                            className="removed-services-retry-btn"
                            onClick={fetchData}
                        >
                            Try Again
                        </button>
                    </div>
                ) : displayServices.length === 0 ? (
                    <div className="removed-services-empty">
                        {searchKeyword ? (
                            <div>
                                <p>No removed services match your search.</p>
                                <button 
                                    className="removed-services-clear-search"
                                    onClick={() => setSearchKeyword('')}
                                >
                                    Clear Search
                                </button>
                            </div>
                        ) : (
                            <div>
                                <FontAwesomeIcon icon={faTrash} size="2x" style={{ color: '#ccc', marginBottom: '12px' }} />
                                <p>No services have been removed yet.</p>
                                <p style={{ fontSize: '14px', color: '#666' }}>
                                    Services you remove from the map will appear here.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="removed-services-list">
                        {folderNames.map(folder => (
                            <div key={folder}>
                                <div
                                    className="removed-services-folder"
                                    onClick={() => handleFolderClick(folder)}
                                >
                                    <span>
                                        {expandedFolders.has(folder) ? "▼" : "►"} {folder}
                                    </span>
                                    <span className="removed-services-folder-count">
                                        ({servicesByFolder[folder].length})
                                    </span>
                                </div>
                                {expandedFolders.has(folder) && (
                                    <div style={{ marginLeft: 18 }}>
                                        {servicesByFolder[folder].map(service => (
                                            <div key={service.key} className="removed-service-item">
                                                <div
                                                    className="removed-service-header"
                                                    onClick={() => handleServiceClick(service.key)}
                                                >
                                                    <div className="removed-service-info">
                                                        <div className="removed-service-name">
                                                            <span style={{ marginRight: '8px' }}>
                                                                {expandedServices.has(service.key) ? "▼" : "►"}
                                                            </span>
                                                            <span 
                                                                dangerouslySetInnerHTML={{
                                                                    __html: searchKeyword && searchResult ? 
                                                                        highlightSearchTerm(service.label, searchKeyword) : 
                                                                        service.label
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="removed-service-meta">
                                                            <span className="removed-service-state">{service.state?.toUpperCase()}</span>
                                                            <span className="removed-service-separator">•</span>
                                                            <span className="removed-service-date">
                                                                {formatDate(service.removed_date)}
                                                            </span>
                                                            {service.removed_by && (
                                                                <>
                                                                    <span className="removed-service-separator">•</span>
                                                                    <span className="removed-service-by">by {service.removed_by}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="removed-service-actions">
                                                            <button
                                                                className="removed-service-restore-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRestore(service);
                                                                }}
                                                                title="Restore service"
                                                                disabled={loading}
                                                            >
                                                                <FontAwesomeIcon icon={faUndo} />
                                                            </button>
                                                            <button
                                                                className="removed-service-delete-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handlePermanentDelete(service);
                                                                }}
                                                                title="Delete permanently"
                                                                disabled={loading}
                                                            >
                                                                <FontAwesomeIcon icon={faTimes} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {expandedServices.has(service.key) && (
                                                    <div className="removed-service-details">
                                                        {service.url && (
                                                            <div className="removed-service-url">
                                                                <strong>Service URL:</strong> {service.url}
                                                            </div>
                                                        )}
                                                        {service.layers_removed && service.layers_removed.length > 0 && (
                                                            <div className="removed-service-layers">
                                                                <div className="removed-service-layers-title">
                                                                    Removed layers ({service.layers_removed.length}):
                                                                </div>
                                                                <div style={{ marginLeft: 12 }}>
                                                                    {service.layers_removed.map((layer, layerIndex) => (
                                                                        <div key={layerIndex} className="removed-service-layer">
                                                                            <div className="removed-service-layer-name">
                                                                                {typeof layer === 'string' ? layer : layer.name}
                                                                            </div>
                                                                            {layer.sublayers && layer.sublayers.length > 0 && (
                                                                                <div className="removed-service-sublayers">
                                                                                    {layer.sublayers.map((sublayer, sublayerIndex) => (
                                                                                        <div key={sublayerIndex} className="removed-service-sublayer">
                                                                                            • {sublayer}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="removed-services-footer">
                <div className="removed-services-info">
                    Removed services are kept for 30 days before permanent deletion.
                </div>
            </div>
        </div>
    );
}

export default RemovedServicesPanel;
