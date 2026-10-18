import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
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
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const closeMenu = () => {
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const anchor = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const edge = 8;
    const gap = 6;
    const availableHeight = Math.max(0, viewportHeight - edge * 2);
    const width = Math.min(menuRect.width, Math.max(0, viewportWidth - edge * 2));
    const height = Math.max(menu.scrollHeight + menu.offsetHeight - menu.clientHeight, menuRect.height);
    const below = Math.min(availableHeight, Math.max(0, viewportHeight - edge - anchor.bottom - gap));
    const above = Math.min(availableHeight, Math.max(0, anchor.top - gap - edge));
    const openBelow = height <= below || below >= above;
    const maxHeight = openBelow ? below : above;
    const visibleHeight = Math.min(height, maxHeight);
    const left = Math.max(edge, Math.min(anchor.right - width, viewportWidth - edge - width));
    const top = Math.max(edge, Math.min(
      openBelow ? anchor.bottom + gap : anchor.top - gap - visibleHeight,
      viewportHeight - edge - visibleHeight,
    ));

    // A collapsed panel can move the still-mounted trigger outside the viewport.
    if (anchor.width > 0 && anchor.height > 0 && (
      anchor.right <= 0 || anchor.left >= viewportWidth || anchor.bottom <= 0 || anchor.top >= viewportHeight
    )) {
      setIsOpen(false);
      return;
    }

    Object.assign(menu.style, {
      left: `${left}px`,
      top: `${top}px`,
      maxHeight: `${maxHeight}px`,
      visibility: 'visible',
    });
  }, []);

  // Remeasure on parent renders too, including panel side/view-mode changes.
  useLayoutEffect(() => {
    if (isOpen) updateMenuPosition();
  });

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    menuRef.current?.querySelector('input:not([disabled]), button:not([disabled])')?.focus({ preventScroll: true });
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMenuPosition) : null;
    [triggerRef.current, menuRef.current, dropdownRef.current?.closest('#content-2')].forEach(element => {
      if (element) observer?.observe(element);
    });
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      observer?.disconnect();
    };
  }, [isOpen, updateMenuPosition]);

  // Sync pending state when props change while closed
  useEffect(() => {
    if (!isOpen) {
      setPendingCategory(categoryValue || '');
      setPendingTags(activeTagFilters || []);
      setPendingFavorites(favoritesOnly);
    }
  }, [categoryValue, activeTagFilters, favoritesOnly, isOpen]);

  // The menu lives outside the panel, so both surfaces count as inside.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
    closeMenu();
  };

  const handleClear = () => {
    setPendingCategory('');
    setPendingTags([]);
    setPendingFavorites(false);
    setTagInput('');
    onCategoryChange('');
    onTagFiltersChange([]);
    onFavoritesChange?.(false);
    closeMenu();
  };

  const activeCount =
    (categoryValue ? 1 : 0) + (activeTagFilters ? activeTagFilters.length : 0) + (favoritesOnly ? 1 : 0);

  return (
    <div className="filter-dropdown" ref={dropdownRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-haspopup="dialog"
        className={`filter-dropdown-trigger${activeCount > 0 ? ' active' : ''}`}
        onClick={() => setIsOpen(v => !v)}
        title="Filter projects"
        aria-label="Filter projects"
      >
        <FontAwesomeIcon icon={faFilter} />
        <span>Filter</span>
        {activeCount > 0 && <span className="filter-dropdown-badge">{activeCount}</span>}
      </button>

      {isOpen && createPortal(
        <div className="filter-dropdown-menu" ref={menuRef} id={menuId}
          role="dialog" aria-label="Filter projects">
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
              <span className="filter-dropdown-label">Show only favorited projects</span>
            </label>
            {!canUseFavorites && <p className="filter-dropdown-note">Log in to use favorites filter.</p>}
          </div>

          {/* Footer */}
          <div className="filter-dropdown-footer">
            <button className="filter-dropdown-btn clear" onClick={handleClear}>Clear</button>
            <button className="filter-dropdown-btn apply" onClick={handleApply}>Apply</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default FilterDropdown;
