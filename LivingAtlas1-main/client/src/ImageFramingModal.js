import React, { useRef, useState } from 'react';
import Modal from 'react-modal';
import { defaultPresentation, framingStyle, presentationOf } from './imageUploads';
import './ImageFramingModal.css';

export default function ImageFramingModal({ image, aspectRatio = 4 / 3, onSave, onClose }) {
    const [presentation, setPresentation] = useState(() => presentationOf(image));
    const frame = useRef(null);
    const drag = useRef(null);
    const update = (key, value) => setPresentation(prev => ({ ...prev, [key]: value }));
    const position = event => {
        const session = drag.current;
        if (!session || presentation.fit !== 'cover') return;
        const deltaX = event.clientX - session.clientX;
        const deltaY = event.clientY - session.clientY;
        const { width, height } = frame.current.getBoundingClientRect();
        const naturalRatio = session.ratio;
        const scale = Math.max(width / naturalRatio, height) * presentation.zoom;
        const overflowX = Math.max(0, scale * naturalRatio - width);
        const overflowY = Math.max(0, scale - height);
        setPresentation(prev => ({ ...prev,
            x: overflowX ? Math.max(0, Math.min(100, session.x - deltaX / overflowX * 100)) : prev.x,
            y: overflowY ? Math.max(0, Math.min(100, session.y - deltaY / overflowY * 100)) : prev.y,
        }));
    };
    return <Modal isOpen onRequestClose={event => { event?.stopPropagation(); onClose(); }} contentLabel="Adjust image framing" className="image-framing-modal" overlayClassName="image-framing-overlay">
        <div onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose(); }} onPointerDown={event => event.stopPropagation()}>
        <h2>Adjust framing</h2>
        <p>Drag to position your image. The full image stays available when opened.</p>
        <div className="image-framing-modes">
            <button type="button" aria-pressed={presentation.fit === 'cover'} onClick={() => update('fit', 'cover')}>Fill frame</button>
            <button type="button" aria-pressed={presentation.fit === 'contain'} onClick={() => update('fit', 'contain')}>Show full image</button>
        </div>
        <div ref={frame} className={`image-framing-preview ${presentation.fit}`} style={{ aspectRatio, width: `min(100%, ${50 * aspectRatio}vh)`, marginInline: 'auto' }}
            onPointerDown={event => {
                if (presentation.fit !== 'cover') return;
                const img = frame.current.querySelector('img');
                drag.current = { ...presentation, clientX: event.clientX, clientY: event.clientY, ratio: img.naturalWidth / img.naturalHeight || 1 };
                event.currentTarget.setPointerCapture?.(event.pointerId);
            }} onPointerMove={position} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
            <img src={image.url} alt="Framing preview" draggable={false} style={framingStyle({ presentation })} />
        </div>
        {presentation.fit === 'cover' && <div className="image-framing-sliders">
            <label>Zoom<input aria-label="Image zoom" type="range" min="1" max="3" step="0.01" value={presentation.zoom} onChange={event => update('zoom', Number(event.target.value))} /></label>
            <label>Horizontal position<input aria-label="Horizontal position" type="range" min="0" max="100" value={presentation.x} onChange={event => update('x', Number(event.target.value))} /></label>
            <label>Vertical position<input aria-label="Vertical position" type="range" min="0" max="100" value={presentation.y} onChange={event => update('y', Number(event.target.value))} /></label>
        </div>}
        <div className="image-framing-actions">
            <button type="button" onClick={() => setPresentation(defaultPresentation())}>Reset</button>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" onClick={() => onSave(presentation)}>Use framing</button>
        </div>
        </div>
    </Modal>;
}
