import React from 'react';
import { PanelOnboarding } from './OnboardingBasemapPanel';

const STEPS = [
    {
        selector: '.watershed-panel',
        title: 'Watershed Delineation',
        description: 'Use USGS StreamStats to display rivers and delineate an upstream basin. After a basin appears, save it as a custom layer or edit it for a polygon project. This tour does not run requests or save data.',
    },
    {
        selector: '[data-onboarding-target="watershed-help"]',
        title: 'Help and Tutorial',
        description: 'Help opens the Watershed Panel chapter in the User Manual. The play button restarts this tour. Use Next and Previous, or the arrow keys; Escape closes the tour.',
    },
    {
        selector: '[data-onboarding-target="watershed-state"]',
        title: 'Choose a State',
        description: 'Select Washington (WA), Idaho (ID), or Oregon (OR) for your pour point. Changing the state switches the river overlay; it does not recompute a basin already on the map.',
    },
    {
        selector: '[data-onboarding-target="watershed-rivers"]',
        title: 'Show or Hide Rivers',
        description: 'Rivers are hidden by default. Check Show StreamStats rivers to display the selected state’s channels; uncheck to hide. Zoom to 12 or closer for WA/OR, or 13 for ID. Visibility is retained when closing the panel or switching basemaps.',
    },
    {
        selector: '[data-onboarding-target="watershed-select"]',
        title: 'Delineate a Basin',
        description: 'Zoom to at least 12, choose Select point on map, then click a stream. A temporary point and coordinate popup appear immediately while StreamStats finds the basin. Cancel point selection stops picking; Cancel stops the request and keeps the point. Retry closer to a channel if it fails.',
    },
    {
        selector: '[data-onboarding-target="watershed-results"]',
        title: 'Review the Result',
        description: 'Success draws the basin, moves the point to the returned StreamStats location, and zooms to the basin. View coordinates in the point popup on the map. The Save menu appears with the result; log in before choosing either option.',
    },
    {
        selector: '[data-onboarding-target="watershed-save"]',
        title: 'Save as Custom Layer',
        description: 'After delineation, edit Basin name, open Save, then choose Save as custom layer. The complete GeoJSON is saved to Custom Layers / Root and the list refreshes. Open Custom Layers and enable it there. A failed save leaves the basin available to retry.',
    },
    {
        selector: '[data-onboarding-target="watershed-save"]',
        title: 'Save as Polygon',
        description: 'Open Save and choose Save as polygon to load the basin into Edit Polygon. Edit and save, then complete the project form to create its polygon representation. Cancel creates no project. For basins with interior holes, use a custom layer: the editor cannot preserve holes.',
    },
    {
        selector: '[data-onboarding-target="watershed-clear"]',
        title: 'Clear the Temporary Result',
        description: 'Clear result from map cancels any pending request and removes the temporary basin, point and popup. It does not hide rivers or delete saved layers or projects. Manage those through the river checkbox, Custom Layers or project controls.',
    },
].map(step => ({ ...step, placement: 'right', fallbackSelector: '.watershed-panel-body' }));

export default function WatershedPanelOnboarding(props) {
    return <PanelOnboarding {...props} steps={STEPS} />;
}
