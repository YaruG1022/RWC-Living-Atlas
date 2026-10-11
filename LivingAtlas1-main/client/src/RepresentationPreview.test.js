import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RepresentationPreview from './RepresentationPreview';
import { imageCornerTransform, projectRepresentation } from './representationGeometry';

test('projection keeps north above south, fits narrow geometries, and ignores invalid coordinates', () => {
    const points = projectRepresentation([{ lat: 48, lng: -117 }, { lat: 46, lng: -117 }, { lat: '', lng: 0 }, { lat: 91, lng: 0 }]);
    expect(points).toHaveLength(2);
    expect(points[0].y).toBeCloseTo(28);
    expect(points[1].y).toBeCloseTo(152);
    expect(points.every(point => point.x === 160)).toBe(true);
    expect(projectRepresentation([{ lat: 0, lng: 0 }])[0]).toMatchObject({ x: 160, y: 90 });
});

test('projection unwraps the date line rather than stretching across the world', () => {
    const points = projectRepresentation([{ lat: 0, lng: 179 }, { lat: 0, lng: -179 }, { lat: 1, lng: 180 }]);
    expect(points[0].x).toBeLessThan(points[1].x);
    expect(points[2].y).toBeLessThan(points[0].y);
    expect(points[1].x - points[0].x).toBeGreaterThan(200);
});

test('image transform maps every source corner to a skewed geographic quadrilateral', () => {
    const corners = [{ x: 20, y: 30 }, { x: 290, y: 40 }, { x: 260, y: 150 }, { x: 50, y: 130 }];
    const matrix = imageCornerTransform(corners);
    [[0, 0], [100, 0], [100, 100], [0, 100]].forEach(([x, y], index) => {
        const divisor = matrix[3] * x + matrix[7] * y + matrix[15];
        expect((matrix[0] * x + matrix[4] * y + matrix[12]) / divisor).toBeCloseTo(corners[index].x);
        expect((matrix[1] * x + matrix[5] * y + matrix[13]) / divisor).toBeCloseTo(corners[index].y);
    });
    expect(imageCornerTransform(Array(4).fill({ x: 160, y: 90 }))).toBeNull();
});

test('polygon preview preserves each ring style, including zero opacity', () => {
    const { container } = render(<RepresentationPreview data={{ location_type: 'polygon', polygon_vertices: [
        { lat: 48, lng: -117, ring: 0, fillColor: '#ff0000', fillOpacity: 0, lineStyle: 'dashed' },
        { lat: 46, lng: -118, ring: 0 }, { lat: 46, lng: -116, ring: 0 },
        { lat: 47, lng: -115, ring: 1, fillColor: '#00ff00', fillOpacity: 0.7, lineStyle: 'dotted' },
        { lat: 46, lng: -115, ring: 1 }, { lat: 46, lng: -114, ring: 1 }
    ] }} />);
    const polygons = container.querySelectorAll('polygon');
    expect(polygons).toHaveLength(2);
    expect(polygons[0].getAttribute('fill')).toBe('#ff0000');
    expect(polygons[0].getAttribute('fill-opacity')).toBe('0');
    expect(polygons[0].getAttribute('stroke-dasharray')).toBe('8 6');
    expect(polygons[1].getAttribute('fill-opacity')).toBe('0.7');
});

test('single coordinate uses category imagery and multipoints retain individual styles', () => {
    const { container, rerender } = render(<RepresentationPreview data={{ latitude: 47, longitude: -117, category: 'River' }} />);
    expect(container.querySelector('.representation-category-marker img').src).toContain('blue_marker.png');
    rerender(<RepresentationPreview data={{ location_type: 'multipoint', polygon_vertices: [{ lat: 47, lng: -117, icon: 'location-dot', markerColor: '#ff0000', markerOpacity: 0 }, { lat: 46, lng: -118 }] }} />);
    const markers = container.querySelectorAll('.representation-marker');
    expect(markers).toHaveLength(2);
    expect(markers[0].style.color).toBe('rgb(255, 0, 0)');
    expect(markers[0].style.opacity).toBe('0');
});

test('image preview uses the actual asset and shows a fallback on load failure', () => {
    const data = { location_type: 'image', polygon_vertices: [{ lat: 48, lng: -118 }, { lat: 48, lng: -116 }, { lat: 46, lng: -116 }, { lat: 46, lng: -118 }] };
    const { container, rerender } = render(<RepresentationPreview data={data} imageSrc="/actual.png" />);
    const image = container.querySelector('.representation-image');
    expect(image.src).toContain('/actual.png');
    expect(image.style.transform).toContain('matrix3d(');
    fireEvent.error(image);
    expect(screen.getByText('Image unavailable')).toBeTruthy();
    rerender(<RepresentationPreview data={data} imageSrc="/replacement.png" />);
    expect(container.querySelector('.representation-image')).toBeTruthy();
});

test('missing or degenerate geometry does not invent a shape', () => {
    render(<RepresentationPreview data={{ location_type: 'polygon', polygon_vertices: [] }} />);
    expect(screen.getByText('No valid geometry')).toBeTruthy();
});
