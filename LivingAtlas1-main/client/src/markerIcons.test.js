import React from 'react';
import { render } from '@testing-library/react';
import { MarkerIconGlyph, buildMarkerIconElement, MARKER_ICON_COLOR } from './markerIcons';

test('picker and map share an outlined neutral marker with translucent fill', () => {
    const { container } = render(<MarkerIconGlyph optionKey="location-dot" />);
    const picker = container.querySelector('svg');
    const map = buildMarkerIconElement('location-dot').querySelector('svg');
    [picker, map].forEach(svg => {
        expect(svg.style.color).toBe('rgb(168, 178, 191)');
        expect(svg.style.stroke).toBe('#475569');
        expect(svg.style.fillOpacity).toBe('0.4');
        expect(svg.style.strokeWidth).toBe('24');
    });
    expect(MARKER_ICON_COLOR).not.toBe('#333');
});

test('custom colors and image marker assets remain available', () => {
    const map = buildMarkerIconElement('star', '#ff0000').querySelector('svg');
    expect(map.style.color).toBe('rgb(255, 0, 0)');
    expect(map.style.fillOpacity).toBe('1');
    expect(buildMarkerIconElement('marker-blue').querySelector('img').src).toContain('/blue_marker.png');
    expect(buildMarkerIconElement('unknown').querySelector('svg').getAttribute('data-icon')).toBe('location-dot');
});
