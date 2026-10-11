import React, { useEffect, useState } from 'react';
import { MarkerIconGlyph, MARKER_ICON_COLOR } from './markerIcons';
import { projectRepresentation, imageCornerTransform, validCoordinate, LINE_DASHES } from './representationGeometry';
import './RepresentationPreview.css';

const opacity = (value, fallback) => value == null || !Number.isFinite(Number(value)) ? fallback : Math.max(0, Math.min(1, Number(value)));

export default function RepresentationPreview({ data, imageSrc, onLocate }) {
    const [imageFailed, setImageFailed] = useState(false);
    useEffect(() => setImageFailed(false), [imageSrc]);
    const type = data.location_type || 'point';
    const category = (data.category || '').trim().toLowerCase();
    const categoryImage = { river: '/blue_marker.png', watershed: '/green_marker.png', place: '/yellow_marker.png', places: '/yellow_marker.png' }[category];
    const isUncategorized = !category || category === 'none' || category === 'uncategorized';
    const isImage = type === 'image', isPolygon = type === 'polygon';
    const vertices = Array.isArray(data.polygon_vertices) ? data.polygon_vertices : [];
    const coordinates = isImage ? vertices.slice(0, 4) : type === 'point' ? [{ lat: data.latitude, lng: data.longitude }] : vertices;
    const points = projectRepresentation(coordinates);
    const groups = new Map();
    points.forEach(point => {
        const ring = point.ring ?? 0;
        if (!groups.has(ring)) groups.set(ring, []);
        groups.get(ring).push(point);
    });
    const imageMatrix = isImage && coordinates.length === 4 && coordinates.every(validCoordinate) ? imageCornerTransform(points) : null;
    const hasShape = isPolygon ? [...groups.values()].some(ring => ring.length >= 3) : isImage ? !!imageMatrix : !!points.length;
    const Scene = onLocate ? 'button' : 'div';
    return <Scene className="representation-scene" type={onLocate ? 'button' : undefined} onClick={onLocate} title={onLocate ? 'Locate on map' : undefined} role={onLocate ? undefined : 'img'} aria-label={onLocate ? 'Locate this location on map' : `${isImage ? 'Image overlay' : isPolygon ? 'Polygon' : 'Coordinate markers'} appearance preview`}>
        <svg viewBox="0 0 320 180" aria-hidden="true">
            <path className="representation-grid" d="M0 45H320M0 90H320M0 135H320M80 0V180M160 0V180M240 0V180" />
            {isPolygon && [...groups.entries()].map(([ring, ringPoints]) => {
                if (ringPoints.length < 3) return null;
                const style = ringPoints[0];
                const color = style.fillColor || data.polygon_fill_color || '#0077c0';
                return <polygon key={ring} points={ringPoints.map(point => `${point.x},${point.y}`).join(' ')} fill={color} fillOpacity={opacity(style.fillOpacity ?? data.polygon_fill_opacity, 0.2)} stroke={color} strokeWidth="2" strokeDasharray={LINE_DASHES[style.lineStyle || data.polygon_line_style || 'solid']} />;
            })}
            {isImage && imageMatrix && imageSrc && !imageFailed && <foreignObject x="0" y="0" width="320" height="180">
                <img className="representation-image" src={imageSrc} alt="" style={{ transform: `matrix3d(${imageMatrix.join(',')})` }} onError={() => setImageFailed(true)} />
            </foreignObject>}
            {isImage && points.length === 4 && <polygon points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />}
            {type === 'point' && points.map((point, index) => <foreignObject key={index} x={point.x - 20} y={point.y - 20} width="40" height="40">
                <div className="representation-category-marker">{categoryImage ? <img src={categoryImage} alt="" /> : <span className={isUncategorized ? 'representation-category-none' : 'representation-category-other'} />}</div>
            </foreignObject>)}
            {type === 'multipoint' && points.map((point, index) => <foreignObject key={index} x={point.x - 14} y={point.y - 28} width="28" height="32">
                <div className="representation-marker" style={{ color: point.markerColor || point.color || MARKER_ICON_COLOR, opacity: opacity(point.markerOpacity ?? point.opacity, 1) }}><MarkerIconGlyph optionKey={point.icon || 'location-dot'} /></div>
            </foreignObject>)}
            <text x="306" y="17" textAnchor="middle" className="representation-north">↑ N</text>
        </svg>
        {!hasShape && <span className="representation-unavailable">No valid geometry</span>}
        {hasShape && isImage && (!imageSrc || imageFailed) && <span className="representation-unavailable">Image unavailable</span>}
    </Scene>;
}
