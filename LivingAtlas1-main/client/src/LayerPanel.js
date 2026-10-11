import React from 'react';
import { useState } from 'react';
import Modal from 'react-modal';
import { curLocationCoordinates, turnOnCurrentLocation, searchLocationCoordinates} from './Content1.js';

function LayerPanel({
    isOpen,
    onClose,
    layerVisibility,
    handleLayerCheckbox,
    filterCondition,
    setFilterCondition,
    sortCondition,
    setSortCondition,
    CategoryCondition,
    setCategoryCondition
}) {
    const [isAddFilterOpen, setAddFilterOpen] = useState(false);
    const [filterInputText, setFilterInputText] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);
    const [activeSort, setActiveSort] = useState('');

    if (!isOpen) return null;

    const openFilterPopup = () => {
        setAddFilterOpen(true);
    };

    const closeFilterPopup = () => {
        setAddFilterOpen(false);
    };

    const handleCustomFilterChange = (event) => {
        setFilterInputText(event.target.value);
    };

    const removeFilter = (filter) => {
        if (filter === "River" || filter === "Watershed" || filter === "Places") {
            setCategoryCondition('');
        } else {
            const newFilters = activeFilters.filter(f => f !== filter);
            setActiveFilters(newFilters);
            setFilterCondition(newFilters.join(','));
        }
    };

    const addCustomFilter = () => {
        let filterValue = filterInputText;
    
        // Convert to lowercase unless the filter is "River", "Watershed", or "Places"
        if (!["River", "Watershed", "Places"].includes(filterValue)) {
            filterValue = filterValue.toLowerCase();
        }
    
        if (filterValue && !activeFilters.includes(filterValue)) {
            const newFilters = [...activeFilters, filterValue];
            setActiveFilters(newFilters);
            setFilterCondition(newFilters.join(','));
            console.log(`${filterValue} applied`);
        }
        closeFilterPopup();
    };

    const handleSortChange = (event) => {
        let sortValue = event.target.value;
        setActiveSort(sortValue);
        if (sortValue === "") {
            console.log(`Sorts removed`);
            setSortCondition(sortValue);
        }
        else {
            console.log(`${sortValue} applied`);
            if (sortValue == "ClosestToMe")
            {
                if (curLocationCoordinates.lat === 0 && curLocationCoordinates.lng === 0)
                {
                    alert("Please turn on your current location to use this feature");
                }
                else
                {
                    console.log(curLocationCoordinates);
                    setSortCondition(sortValue + ',' + curLocationCoordinates.lat + ',' + curLocationCoordinates.lng);
                }
            }
            else if (sortValue == "ClosestToPin")
            {
                if (searchLocationCoordinates.lat === 0 && searchLocationCoordinates.lng === 0)
                {
                    alert("Please search a location using the search bar to use this feature");
                }
                else
                {
                    console.log(searchLocationCoordinates);
                    setSortCondition(sortValue + ',' + searchLocationCoordinates.lat + ',' + searchLocationCoordinates.lng);
                }
            }
            else
            {
                setSortCondition(sortValue);
            }
        }
    }

    return (
        <div className="layer-panel">
            <div className="layer-panel-header">
                <h3 style={{ margin: 0 }}>Toggle Layers</h3>
                <button
                    className="layer-panel-close-btn"
                    onClick={onClose}
                    title="Close"
                >
                    &times;
                </button>
            </div>
            <div style={{ marginTop: 20 }}>
                {/* Card marker checkboxes */}
                <div style={{ marginBottom: 16 }}>
                    <strong>Filter by Card Category</strong>
                    <label style={{ display: "block", marginBottom: 8, marginTop: 8 }}>
                        <input
                            type="checkbox"
                            checked={layerVisibility.River}
                            onChange={() => handleLayerCheckbox("River")}
                        />{" "}
                        River Cards
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                        <input
                            type="checkbox"
                            checked={layerVisibility.Watershed}
                            onChange={() => handleLayerCheckbox("Watershed")}
                        />{" "}
                        Watershed Cards
                    </label>
                    <label style={{ display: "block", marginBottom: 8 }}>
                        <input
                            type="checkbox"
                            checked={layerVisibility.Places}
                            onChange={() => handleLayerCheckbox("Places")}
                        />{" "}
                        Places Cards
                    </label>
                </div>

            </div>
            {/* <button onClick={addCustomFilter} className='custom-filter'>Add Custom filters</button> */}
            {/* New Custom Filter popup */}
            <button onClick={openFilterPopup} className="add-custom-filters-button" title="Add custom filters" aria-label="Add custom filters">Add filter</button>
            
            {/* Modal for Add Customer Filter */}
            <Modal
                isOpen={isAddFilterOpen}
                onRequestClose={closeFilterPopup}
                className="filter-modal">                           
                    {isAddFilterOpen && (                   
                        <div>
                            <input
                                type="text"
                                onChange={handleCustomFilterChange}
                                placeholder="Enter a custom filter..."
                            />
                            <button onClick={closeFilterPopup} style={{background: 'red', padding:'10px' }}>Close</button>
                            <button onClick={addCustomFilter} style={{background: 'green'}}>Add Filter</button>
                        </div>           
                    )}    
            </Modal>

            <select onChange={handleSortChange} className='sort-by'>
                <option value="">Sort By...</option>
                <option value="ClosestToMe">Closest To Me</option>
                <option value="ClosestToPin">Closest To Pin</option>
                <option value="RecentlyAdded">Recently Added</option>
            </select>

            <div>
                {activeFilters.map(filter => (
                    <span key={filter} className="filter-tag">
                        {filter}
                        <button onClick={() => removeFilter(filter)}>x</button>
                    </span>
                ))}
            </div>
        </div>
    );
}

export default LayerPanel;
