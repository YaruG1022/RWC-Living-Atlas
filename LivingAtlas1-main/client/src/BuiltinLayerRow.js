import React from 'react';
import { retryBuiltinLayer } from './builtinLayerController';
import './BuiltinLayerRow.css';

export default function BuiltinLayerRow({ layer, visible, status, onToggle, searchMatchId, activeMatch }) {
    return (
        <div className={`tree-node builtin-layer-row${activeMatch ? ' search-nav-current' : ''}`} data-search-match-id={searchMatchId}>
            <label className="upload-item builtin-layer-label">
                <input type="checkbox" checked={!!visible} onChange={() => onToggle?.(layer.id)} />
                {layer.color && <span className={`builtin-layer-swatch${layer.geometry === 'line' ? ' builtin-layer-swatch--line' : ''}`} style={{ '--builtin-color': layer.color }} aria-hidden="true" />}
                <span>{layer.label}</span>
            </label>
            {layer.file && (
                <div className="builtin-layer-info">
                    <details>
                        <summary>About this layer</summary>
                        <p>{layer.description}</p>
                        <p>Source: <a href={layer.sourceUrl} target="_blank" rel="noopener noreferrer">{layer.sourceLabel}</a></p>
                        <button type="button" className="builtin-layer-link" onClick={() => window.atlasMapInstance?.fitBounds(layer.bounds, { padding: 40, duration: 800 })}>Zoom to region</button>
                    </details>
                    {visible && status?.state === 'loading' && <p role="status">Loading {layer.label}…</p>}
                    {visible && status?.state === 'error' && (
                        <div role="alert" className="builtin-layer-error">
                            {status.message}{' '}
                            <button type="button" className="builtin-layer-link" onClick={() => retryBuiltinLayer(window.atlasMapInstance, layer.id)}>Retry {layer.label}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
