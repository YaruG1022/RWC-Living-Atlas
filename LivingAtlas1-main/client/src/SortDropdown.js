import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';
import './SortDropdown.css';

const SORT_OPTIONS = [
  { value: 'NewestFirst', label: 'Newest First' },
  { value: 'OldestFirst', label: 'Oldest First' },
  { value: 'ClosestToMe', label: 'Closest To Me' },
  { value: 'ClosestToPin', label: 'Closest To Pin' }
];

function SortDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingSort, setPendingSort] = useState(value || '');
  const dropdownRef = useRef(null);

  useEffect(() => {
    setPendingSort(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleApply = () => {
    onChange(pendingSort);
    setIsOpen(false);
  };

  const handleClear = () => {
    setPendingSort('');
    onChange('');
    setIsOpen(false);
  };

  const selectedOption = SORT_OPTIONS.find((option) => option.value === pendingSort);
  const displayText = selectedOption ? selectedOption.label : 'Sort By';

  return (
    <div className="sort-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="sort-dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Sort cards"
        aria-label="Sort cards"
      >
        <FontAwesomeIcon icon={faSort} />
        <span title={displayText}>Sort</span>
      </button>

      {isOpen && (
        <div className="sort-dropdown-menu">
          <div className="sort-dropdown-options">
            {SORT_OPTIONS.map((option) => (
              <label key={option.value} className="sort-option">
                <input
                  type="checkbox"
                  checked={pendingSort === option.value}
                  onChange={() => setPendingSort(option.value)}
                  className="sort-checkbox"
                />
                <span className="sort-label">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="sort-dropdown-footer">
            <button
              type="button"
              className="sort-dropdown-btn clear"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="sort-dropdown-btn apply"
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SortDropdown;
