# Built-in boundary layers

Validated 2026-11-11. Hydrological Boundaries and City Limits now share the
same local-data controller, color swatches, About this layer disclosures,
translucent polygon styling and compact feature popups as the other built-ins.
Removed the Included with site badges and legacy Mapbox tileset loading.
Basemaps retain their existing providers; built-in overlay data uses only
same-origin GeoJSON, including when a raster basemap is selected.

## Data and coverage

- 226 USGS WBD HUC8 subbasins associated with WA/OR/ID, intersecting the
  regional extent. These are drainage polygons, replacing the old NHD-stream
  tileset; full subbasins can cross state borders.
- 721 Census TIGERweb incorporated cities/towns in WA/OR/ID, January 1, 2026
  vintage. This excludes census-designated places and urban growth areas.
- Official source queries, download date, geometry tolerances, public-domain
  credits, feature counts and SHA-256 hashes are committed with the snapshots.
  See [data provenance](../../../LivingAtlas1-main/client/public/data/builtin-layers/README.md).
- Initial generalized responses contained 76 invalid city and 2 invalid subbasin
  geometries. GDAL MakeValid repaired these while preserving every feature ID.
  The final 947 polygon geometries are nonempty and GEOS-valid. The refresh
  script includes this repair and verifies complete object-ID batches.
- Boundary data preparation requires GDAL/GEOS; application builds and viewing
  the committed snapshots do not require new dependencies or hosted services.

## Verification

- Full frontend regression: 37 suites, 245 tests passed.
- Final focused regression after compact popup/label styling: 3 suites, 16
  tests passed (controller, built-in panel, synchronized release notes).
- Committed data checks: 7 passed, including geometry rings, HUC8/GEOID IDs,
  three-state coverage, reference cities, licenses, sizes and hashes.
- Production build passed with existing lint warnings. Full npm build also
  exported/captured 146 versioned manual examples. Manual, onboarding and both
  release-note surfaces were updated.
- Real Chromium/Mapbox GL WebGL browser check passed: all five local snapshots
  loaded only after selection; rendered feature counts were 277 subbasin,
  708 city, 46 forest, 14 lake and 385 road features (rendered/tile fragments,
  not source feature counts). Five swatches and disclosures, no badges.
- Switched twice to a raster-tile test style: all five overlays restored,
  remained visible and reused the five cached data downloads. Checked opacity,
  both boundary feature-name/ID popups, Clear and narrow 760-pixel layout.
  No page errors or legacy Mapbox tileset requests.

The browser check used actual committed GeoJSON and real WebGL. A neutral
basemap/raster tile and empty API responses isolate rendering from external
providers and accounts; live external basemap availability was not assessed.
No production data or local account records were changed.

Evidence: [desktop](desktop.png), [narrow panel](narrow-panel.png),
[HUC8 popup](watershed-popup.png), [city popup](city-popup.png).
