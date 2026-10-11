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
