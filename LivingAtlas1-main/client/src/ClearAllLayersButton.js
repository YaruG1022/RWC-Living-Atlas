import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons';

/**
 * Shared button for clearing (unchecking) all layers currently shown on the map.
 * Used by both ArcgisUploadPanel and CustomLayersPanel.
 */
export default function ClearAllLayersButton({ onClick, disabled, className = '', label = 'Clear All' }) {
    return (
        <button
            className={`clear-all-layers-btn${className ? ' ' + className : ''}`}
            onClick={onClick}
            disabled={disabled}
            title="Uncheck all layers on map"
            aria-label="Uncheck all layers on map"
        >
            <FontAwesomeIcon icon={faEyeSlash} />
            <span>{label}</span>
        </button>
    );
}
