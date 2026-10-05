import React, { useRef, useState } from 'react';
import './LearnMoreGallery.css';
import { MAX_GALLERY_IMAGES } from './gallerySelection';

export const MAX_CARD_IMAGES = 30;
export const GALLERY_LAYOUTS = ['multi', 'slideshow'];

export default function LearnMoreGallery({ images: allImages, totalImageCount = allImages.length, layout = 'multi', editing, busy, coverUrl, onLayoutChange, onReorder, onOpen, onAdd, onDelete }) {
    const images = allImages.slice(0, MAX_GALLERY_IMAGES);
    const [slide, setSlide] = useState(0);
    const [dragOver, setDragOver] = useState(null);
    const draggedIndex = useRef(null);
    const validLayout = layout === 'slideshow' ? 'slideshow' : 'multi';
    // A lone image always uses the whole region, regardless of the saved grid.
    const gridLayout = `grid-${Math.max(1, Math.min(6, images.length))}`;
    const activeSlide = Math.min(slide, Math.max(0, images.length - 1));
    const count = Number(gridLayout.slice(5));
    const canAdd = editing && !busy && totalImageCount < MAX_CARD_IMAGES;
    const slots = Array.from({ length: count }, (_, index) => images[index] || null);
    const reorder = (from, to) => {
        if (!editing || busy || from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
        onReorder(from, to);
    };
    const renderTile = (image, index) => {
        const isCover = image && index === images.findIndex(item => item.url === coverUrl);
        return (
            <div key={image?.id ?? `empty-${index}`} className={`lm-gallery-cell${isCover ? ' is-cover' : ''}${dragOver === index ? ' is-drop-target' : ''}`}
                draggable={Boolean(editing && !busy && image)}
                onDragStart={(event) => {
                    draggedIndex.current = index;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(event) => {
                    if (editing && !busy && image && draggedIndex.current !== null) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDragOver(index);
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (draggedIndex.current !== null) reorder(draggedIndex.current, index);
                    draggedIndex.current = null;
                    setDragOver(null);
                }}
                onDragEnd={() => { draggedIndex.current = null; setDragOver(null); }}>
                <button type="button" data-gallery-control className="lm-gallery-image-button" disabled={!image && !canAdd}
                    onClick={(event) => image ? onOpen(event, index) : onAdd(event, index)}
                    aria-label={image ? `Open image ${index + 1}` : `Add image ${index + 1}`}>
                    {image ? <img src={image.url} alt={image.alt || `Card image ${index + 1}`} draggable={false} />
                        : <span className="lm-gallery-empty">{totalImageCount > 0 ? 'No images selected' : editing && canAdd ? '+ Add image' : 'No image'}</span>}
                </button>
                {isCover && <span className="lm-gallery-cover">Card cover</span>}
                {editing && image && <div className="lm-gallery-tile-tools">
                    <button type="button" data-gallery-control disabled={busy || index === 0} onClick={() => reorder(index, index - 1)} aria-label={`Move image ${index + 1} earlier`}>←</button>
                    <span aria-hidden="true">⠿</span>
                    <button type="button" data-gallery-control disabled={busy || index === images.length - 1} onClick={() => reorder(index, index + 1)} aria-label={`Move image ${index + 1} later`}>→</button>
                    <button type="button" data-gallery-control disabled={busy} onClick={(event) => onDelete(event, image)} aria-label={`Delete image ${index + 1}`}>×</button>
                </div>}
            </div>
        );
    };

    return <section className="lm-gallery-section" aria-label="Card image gallery">
        {editing && <div className="lm-gallery-editor">
            <label className="lm-gallery-layout-label">Image layout
                <select aria-label="Image layout" value={validLayout} disabled={busy} onChange={(event) => onLayoutChange(event.target.value)}>
                    {GALLERY_LAYOUTS.map(option => <option key={option} value={option}>{option === 'slideshow' ? 'Slideshow' : 'Multiple images'}</option>)}
                </select>
            </label>
            <p>Choose up to 6 images in See all images. Drag to reorder; the first image is the card cover. Up to {MAX_CARD_IMAGES} images total.</p>
        </div>}
        {validLayout === 'slideshow' ? <>
            <div className="lm-gallery-slideshow" aria-roledescription="carousel">
                {renderTile(images[activeSlide] || null, activeSlide)}
                {images.length > 1 && <>
                    <button type="button" data-gallery-control className="lm-gallery-nav previous" aria-label="Previous gallery image" onClick={() => setSlide((activeSlide + images.length - 1) % images.length)}>‹</button>
                    <button type="button" data-gallery-control className="lm-gallery-nav next" aria-label="Next gallery image" onClick={() => setSlide((activeSlide + 1) % images.length)}>›</button>
                </>}
                {images.length > 0 && <div className="lm-gallery-pagination" aria-label="Choose gallery image">
                    {images.map((image, index) => <button type="button" data-gallery-control key={image.id ?? index} aria-label={`Show gallery image ${index + 1}`} aria-pressed={activeSlide === index} onClick={() => setSlide(index)}>{index + 1}</button>)}
                    <span aria-live="polite">{activeSlide + 1} / {images.length}</span>
                </div>}
            </div>
        </> : <>
            <div className={`lm-gallery-grid lm-gallery-layout-${gridLayout}`}>
                {slots.map(renderTile)}
            </div>
        </>}
    </section>;
}
