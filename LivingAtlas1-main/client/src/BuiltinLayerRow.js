import React, { useId, useRef, useState } from 'react';
import BuiltinLayerInfoModal from './BuiltinLayerInfoModal';
import { retryBuiltinLayer } from './builtinLayerController';
import './BuiltinLayerRow.css';

export default function BuiltinLayerRow({ layer, visible, status, onToggle, searchMatchId, activeMatch }) {
    const [infoOpen, setInfoOpen] = useState(false);
    const helpRef = useRef(null);
    const dialogId = useId();
    return (
        <div className={`tree-node builtin-layer-row${activeMatch ? ' search-nav-current' : ''}`} data-search-match-id={searchMatchId}>
            <div className="builtin-layer-controls">
                <label className="upload-item builtin-layer-label">
                    <input type="checkbox" checked={!!visible} onChange={() => onToggle?.(layer.id)} />
                    {layer.color && <span className={`builtin-layer-swatch${layer.geometry === 'line' ? ' builtin-layer-swatch--line' : ''}`} style={{ '--builtin-color': layer.color }} aria-hidden="true" />}
                    <span>{layer.label}</span>
                </label>
                <button ref={helpRef} type="button" className="builtin-layer-help-button" aria-label={`About ${layer.label}`}
                    title={`About ${layer.label}`} aria-haspopup="dialog" aria-expanded={infoOpen} aria-controls={infoOpen ? dialogId : undefined}
                    onClick={() => { helpRef.current?.focus(); setInfoOpen(true); }}>?</button>
            </div>
            {infoOpen && <BuiltinLayerInfoModal layer={layer} anchorRef={helpRef} dialogId={dialogId} onClose={() => setInfoOpen(false)} />}
            {visible && ['loading', 'error'].includes(status?.state) && (
                <div className="builtin-layer-info">
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
