import React from 'react';
import { PanelOnboarding } from './OnboardingBasemapPanel';

const STEPS = [
    {
        selector: '.watershed-panel',
        title: 'Watershed Delineation',
        description: 'Use USGS StreamStats to display rivers and delineate an upstream basin. After a basin appears, save it as a custom layer or edit it for a polygon card. This tour does not run requests or save data.',
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
        description: 'Zoom to at least 12, choose Select point on map, then click a stream in the selected state. StreamStats snaps the point and returns the upstream basin. Cancel point selection stops picking; Cancel stops a pending request. If it fails, try again closer to a channel.',
    },
    {
        selector: '[data-onboarding-target="watershed-results"]',
        title: 'Review the Result',
        description: 'A successful request draws a yellow basin and the returned pour point, then zooms to the basin. The save buttons appear after a result is available. Log in before using either save option.',
    },
    {
        selector: '[data-onboarding-target="watershed-save-layer"]',
        title: 'Save as Custom Layer',
        description: 'After delineation, edit Basin name and choose Save as custom layer. The complete GeoJSON is saved to Custom Layers / Root and the list refreshes. Open Custom Layers and enable it there. A failed save leaves the basin available to retry.',
    },
    {
        selector: '[data-onboarding-target="watershed-save-polygon"]',
        title: 'Save as Polygon',
        description: 'Save as polygon opens Edit Polygon with the basin loaded. Edit and save, then complete the existing card form to create its polygon representation. Cancel creates no card. For basins with interior holes, use a custom layer: the editor cannot preserve holes.',
    },
    {
        selector: '[data-onboarding-target="watershed-clear"]',
        title: 'Clear the Temporary Result',
        description: 'Clear result from map removes the temporary basin and pour point. It does not hide rivers or delete a saved custom layer or card. Use the river checkbox, Custom Layers, or the card controls to manage those separately.',
    },
].map(step => ({ ...step, placement: 'right', fallbackSelector: '.watershed-panel-body' }));

export default function WatershedPanelOnboarding(props) {
    return <PanelOnboarding {...props} steps={STEPS} />;
}
