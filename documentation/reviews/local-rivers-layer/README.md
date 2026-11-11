# Rivers built-in layer

Validated 2026-11-11. Added an independently selectable Rivers line overlay
alongside Hydrological Boundaries. It uses the existing local-data controller,
blue line swatch, About this layer disclosure, feature popup, opacity, Clear and
basemap restoration. The existing `River` visibility ID remains assigned to
hydrological polygons; the new line layer uses `Rivers` and `builtin-rivers-line`.

## Data

23 Natural Earth 1:10 million river/lake-centerline features intersecting the
WA/OR/ID regional extent: 16 river and 7 lake centerline features, 97,423 bytes.
Includes Columbia, Snake and Willamette. This is a generalized regional overview;
small rivers/tributaries may be absent and selected features can cross the
extent. Pinned upstream revision, public-domain license, checksum and refresh
command are documented in the [snapshot provenance](../../../LivingAtlas1-main/client/public/data/builtin-layers/README.md).

Data is committed with the app and fetched only from the site when selected.
No new hosting service, API key, runtime dependency or backend migration.

## Verification

- Full frontend regression: 37 suites / 246 tests passed, including independent
  Rivers selection/search/Clear and all six lazy-loaded overlays.
- Shipped data: 9 checks passed, including river line geometry, source hash,
  license and known regional river names. Manual export contract passed.
- Production build passed with existing lint warnings; 146 manual screenshots
  generated. Manual, onboarding, release notes and refresh script updated.
- Real Chromium/WebGL rendered all six overlays, including 33 river tile/feature
  fragments from 23 source features. Six color swatches and disclosures, no
  Included with site badges. River feature popup displayed the clicked name.
- Two raster-basemap style changes preserved all six overlays without refetch;
  opacity, Clear, narrow layout and same-origin requests verified. No page errors
  or legacy Mapbox overlay requests. External basemaps/API responses were mocked;
  the GeoJSON snapshots and WebGL renderer were real.

Evidence: [river popup](rivers-popup.png), [desktop](desktop.png),
[narrow panel](narrow-panel.png), [collapsed panel](collapsed-panel.png).
