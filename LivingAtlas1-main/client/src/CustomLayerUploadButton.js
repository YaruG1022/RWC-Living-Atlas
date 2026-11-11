import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { UPLOAD_FORMATS } from './customLayerUpload';
import './CustomLayerUploadButton.css';

export default function CustomLayerUploadButton({ disabled, busy, onSelect }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const menuId = useId();
    const close = (restore = true) => {
        setOpen(false);
        if (restore) buttonRef.current?.focus();
    };

    useLayoutEffect(() => {
        if (!open) return;
        const reposition = () => {
            const rect = buttonRef.current.getBoundingClientRect();
            const height = menuRef.current.offsetHeight;
            const width = menuRef.current.offsetWidth;
            const below = rect.bottom + 6;
            const top = below + height <= window.innerHeight - 8 ? below : rect.top - height - 6;
            setPosition({ top: Math.max(8, top), left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) });
        };
        const outside = event => {
            if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
        };
        reposition();
        menuRef.current.querySelector('[role="menuitem"]')?.focus();
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        document.addEventListener('mousedown', outside);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
            document.removeEventListener('mousedown', outside);
        };
    }, [open]);

    const onKeyDown = event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key === 'Tab') { close(); return; }
        const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
        const index = items.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length
            : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
        if (next !== null) { event.preventDefault(); items[next].focus(); }
    };
    const option = item => (
        <button key={item.id} type="button" role="menuitem" onClick={() => { close(); onSelect(item.id); }}>
            <span>{item.label}</span>
            {item.description && <small>{item.description}</small>}
        </button>
    );
    return (
        <>
            <button ref={buttonRef} type="button" className="clear-all-layers-btn custom-layers-panel-upload-btn" disabled={disabled}
                aria-label="Upload data" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
                onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
                <FontAwesomeIcon icon={faUpload} /><span>{busy ? 'Uploading…' : 'Upload'}</span>
            </button>
            {open && createPortal(
                <div id={menuId} ref={menuRef} className="custom-layer-upload-menu" role="menu" aria-label="Upload layer data" style={position} onKeyDown={onKeyDown}>
                    <div role="group" aria-label="GIS data">{option(UPLOAD_FORMATS[0])}</div>
                    <div role="group" aria-label="StreamStats data">
                        <div className="custom-layer-upload-group-title">StreamStats data</div>
                        {UPLOAD_FORMATS.slice(1).map(option)}
                    </div>
                </div>, document.body,
            )}
        </>
    );
}
