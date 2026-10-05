import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faPlus } from '@fortawesome/free-solid-svg-icons';
import './FilterDropdown.css';

const CATEGORIES = [
  { value: 'River', label: 'River' },
  { value: 'Watershed', label: 'Watershed' },
  { value: 'Places', label: 'Places' },
  { value: 'Other', label: 'Other' }
];

function FilterDropdown({
  categoryValue,
  onCategoryChange,
  activeTagFilters,
  onTagFiltersChange,
  favoritesOnly = false,
  onFavoritesChange,
  canUseFavorites = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState(categoryValue || '');
  const [pendingTags, setPendingTags] = useState(activeTagFilters || []);
  const [pendingFavorites, setPendingFavorites] = useState(favoritesOnly);
  const [tagInput, setTagInput] = useState('');
  const dropdownRef = useRef(null);

  // Sync pending state when props change while closed
  useEffect(() => {
    if (!isOpen) {
      setPendingCategory(categoryValue || '');
      setPendingTags(activeTagFilters || []);
      setPendingFavorites(favoritesOnly);
    }
  }, [categoryValue, activeTagFilters, favoritesOnly, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggleCategory = (val) => {
    setPendingCategory(prev => prev === val ? '' : val);
  };

  const addTag = () => {
    const v = tagInput.trim();
    if (!v || pendingTags.includes(v)) return;
    setPendingTags(prev => [...prev, v]);
    setTagInput('');
  };

  const removeTag = (tag) => {
    setPendingTags(prev => prev.filter(t => t !== tag));
  };

  const handleApply = () => {
    onCategoryChange(pendingCategory);
    onTagFiltersChange(pendingTags);
    onFavoritesChange?.(canUseFavorites && pendingFavorites);
    setIsOpen(false);
  };

  const handleClear = () => {
    setPendingCategory('');
    setPendingTags([]);
    setPendingFavorites(false);
    setTagInput('');
    onCategoryChange('');
    onTagFiltersChange([]);
    onFavoritesChange?.(false);
    setIsOpen(false);
  };

  const activeCount =
    (categoryValue ? 1 : 0) + (activeTagFilters ? activeTagFilters.length : 0) + (favoritesOnly ? 1 : 0);

  return (
    <div className="filter-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${activeCount > 0 ? ' active' : ''}`}
        onClick={() => setIsOpen(v => !v)}
        title="Filter cards"
      >
        <FontAwesomeIcon icon={faFilter} />
        <span>Filter By</span>
        {activeCount > 0 && <span className="filter-dropdown-badge">{activeCount}</span>}
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu">
          {/* Category section */}
          <div className="filter-dropdown-section">
            <div className="filter-dropdown-section-title">Category</div>
            <div className="filter-dropdown-options">
              {CATEGORIES.map((cat) => (
                <label key={cat.value} className="filter-dropdown-option">
                  <input
                    type="radio"
                    name="filter-category"
                    checked={pendingCategory === cat.value}
                    onChange={() => handleToggleCategory(cat.value)}
                    className="filter-dropdown-radio"
                  />
                  <span className="filter-dropdown-label">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tag section */}
          <div className="filter-dropdown-section">
            <div className="filter-dropdown-section-title">Tags</div>
            <div className="filter-dropdown-tag-input">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Enter tag..."
                onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
              />
              <button onClick={addTag} className="filter-dropdown-tag-add" title="Add Tag">
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
            {pendingTags.length > 0 && (
              <div className="filter-dropdown-tags">
                {pendingTags.map(tag => (
                  <span key={tag} className="filter-dropdown-tag">
                    {tag}
                    <button onClick={() => removeTag(tag)}>&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="filter-dropdown-section">
            <div className="filter-dropdown-section-title">Favorites</div>
            <label className="filter-dropdown-option">
              <input type="checkbox" className="filter-dropdown-checkbox"
                checked={pendingFavorites} disabled={!canUseFavorites}
                onChange={event => setPendingFavorites(event.target.checked)} />
              <span className="filter-dropdown-label">Show only favorited cards</span>
            </label>
            {!canUseFavorites && <p className="filter-dropdown-note">Log in to use favorites filter.</p>}
          </div>

          {/* Footer */}
          <div className="filter-dropdown-footer">
            <button className="filter-dropdown-btn clear" onClick={handleClear}>Clear</button>
            <button className="filter-dropdown-btn apply" onClick={handleApply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterDropdown;
