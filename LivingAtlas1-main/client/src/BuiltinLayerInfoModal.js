import React, { useCallback, useEffect, useId, useRef } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

export default function BuiltinLayerInfoModal({ layer, anchorRef, onClose, dialogId }) {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const observerRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    const reposition = useCallback(() => {
        const anchor = anchorRef.current?.getBoundingClientRect();
        const dialog = dialogRef.current;
        if (!anchor || !dialog) return;
        const { width, height } = dialog.getBoundingClientRect();
        const edge = 8;
        const gap = 8;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let left;
        let top;
        if (anchor.right + gap + width <= viewportWidth - edge) {
            left = anchor.right + gap;
            top = anchor.top - 10;
        } else if (anchor.left - gap - width >= edge) {
            left = anchor.left - gap - width;
            top = anchor.top - 10;
        } else {
            left = anchor.right - width;
            top = anchor.bottom + gap + height <= viewportHeight - edge
                ? anchor.bottom + gap : anchor.top - gap - height;
        }
        Object.assign(dialog.style, {
            left: `${Math.max(edge, Math.min(left, viewportWidth - width - edge))}px`,
            top: `${Math.max(edge, Math.min(top, viewportHeight - height - edge))}px`,
            visibility: 'visible',
        });
    }, [anchorRef]);

    useEffect(() => {
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reposition) : null;
        observerRef.current = observer;
        if (anchorRef.current) observer?.observe(anchorRef.current);
        if (dialogRef.current) observer?.observe(dialogRef.current);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
            observer?.disconnect();
        };
    }, [anchorRef, reposition]);

    return (
        <Modal isOpen id={dialogId} onRequestClose={onClose}
            appElement={document.getElementById('root') || undefined}
            ariaHideApp={!!document.getElementById('root')}
            aria={{ labelledby: titleId, describedby: descriptionId, modal: true }}
            className="builtin-layer-dialog" overlayClassName="builtin-layer-dialog-overlay"
            contentRef={node => { dialogRef.current = node; if (node) reposition(); }}
            onAfterOpen={() => {
                if (dialogRef.current) observerRef.current?.observe(dialogRef.current);
                reposition();
                closeRef.current?.focus({ preventScroll: true });
            }}>
            <div className="builtin-layer-dialog-header">
                <h3 id={titleId}>{layer.label}</h3>
                <button ref={closeRef} type="button" className="builtin-layer-help-button" aria-label="Close layer information" onClick={onClose}>
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>
            <div className="builtin-layer-dialog-body">
                <p id={descriptionId}>{layer.description}</p>
                <p>Source: <a href={layer.sourceUrl} target="_blank" rel="noopener noreferrer">{layer.sourceLabel}</a></p>
                <button type="button" className="builtin-layer-link" onClick={() => {
                    window.atlasMapInstance?.fitBounds(layer.bounds, { padding: 40, duration: 800 });
                    onClose();
                }}>Zoom to region</button>
            </div>
        </Modal>
    );
}
