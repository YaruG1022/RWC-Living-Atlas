# Compact custom-layer actions

2026-10-11; baseline `bd0695a`, branch `codex/compact-card-list`.

Scope: shorten the four custom-layer toolbar labels and spacing to occupy one
row at the existing panel width. Labels are Folder, Upload, Added and Clear;
full-purpose tooltips and accessible names remain available. The shared clear
button's default label remains Clear All in other panels. No backend, database,
upload handler or dependency changes.

Local browser at `http://localhost:3000` confirmed all four button tops equal
147.2px and their containing row height 28px. The Added toggle's pressed state
changed false → true → false, retaining the same single-row geometry. Original
filter state was restored; no files or layers were created, uploaded or removed.
Screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/custom-layer-compact-actions.png`.

`node node_modules/react-scripts/bin/react-scripts.js build` passed with existing
lint, Browserslist, bundle-size and CSS minimizer warnings. `git diff --check`
passed. No new unit tests for this label/spacing change; verification used the
rendered browser layout and existing toggle behavior. Mapbox was live but outside
assertions. Hosted and narrow-screen validation were not performed; wrapping
remains available when the panel cannot accommodate a full row.

## Shared panel controls follow-up

2026-10-11; baseline `d0cf30b`. `PanelControls.css`, imported by Home, extends
28px height, 12px text, 6px horizontal padding, 4px gaps and 6px corner radii to
card, GIS, custom-layer, watershed and removed-service action controls. Panel
search icons use 28px squares; search inputs align with them. Long card and GIS
labels are shortened with full titles/accessibility names retained. Watershed
result actions share a wrapping row. Existing drawing/coordinate icon buttons
were already compact at 27px and retain their sizing.

Existing suites `Content2.width.test.js`, `Content2.preview.test.js`,
`WatershedPanel.test.js` and `BasemapSwitcher.test.js`: 28 passed. No new tests
were added for the styling/label changes. Browser DOM measurements confirmed all
six card controls at 28px on the same row, GIS refresh/Added/Clear at 28px on the
same row, both basemap search icons at 28×28px and watershed Select point at 28px.
Panels were opened only for inspection; no services were refreshed, uploaded,
cleared or saved. Final frontend build and diff check passed with the previously
recorded build warnings. Removed-service and legacy filter controls received the
shared styles but were not separately exercised in the browser. No narrow-screen
or hosted validation. Wrapping remains available where a row cannot fit.

Screenshots: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/compact-gis-card-panels.png`
and `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/compact-all-panel-controls.png`.
