# Public basemap options: verification and service conditions

Date: 2026-10-10 (America/Los_Angeles). Code baseline: `7c82c11`.
Implementation tested: `3a1c7da`, branch `codex/compact-card-list`.

## Scope and exit criteria

Add four public raster basemaps alongside the eight existing Mapbox choices.
Verify search, selection, thumbnail attribution, native tile zoom limits,
preservation of application overlays and camera state, and no accumulation of
previous basemap layers. Component tests use a simulated map; browser checks use
the actual local app and live public tile services. Exit criteria are passing
focused regressions/build, visible imagery and attribution, and preserved markers.
No capacity, offline, international high-resolution coverage or uptime claims.

## Official sources and implementation

| Option | Service | Native maximum zoom configured | Coverage and conditions |
|---|---|---|---|
| OpenStreetMap | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | 19 | Worldwide community street map; visible linked credit; normal browser caching and Referer; no bulk/offline downloads or prefetch feature. Public tiles are best effort. |
| USGS Topographic | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}` | 16 | Detailed U.S. topographic content, coarse context elsewhere; linked USGS credit. |
| USGS Aerial Imagery | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` | 16 | U.S. aerial coverage varies by location; USDA/USGS map credit. Viewing is through the service, without imagery downloads. |
| USGS Shaded Relief | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}` | 7 | Current service metadata's maxScale corresponds to zoom 7; higher zooms reuse these tiles. Coarser than a high-resolution terrain service. |

Sources checked:

- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [USGS basemap service list](https://www.usgs.gov/faqs/what-are-base-map-services-or-urls-used-national-map)
- [The National Map service directory](https://apps.nationalmap.gov/services/)
- [USGS Shaded Relief metadata](https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer?f=pjson)
- [CARTO basemap terms](https://carto.com/legal/basemap-terms/): currently requires an issued access key, so no legacy keyless CARTO endpoint was added.

All four new options require no new access key. Existing Mapbox access remains
necessary for the application's Mapbox styles and other existing features.
Attribution is expanded at all map widths, and public thumbnail credits have
their own links. Clicking a credit does not select its map.

## Environment and data

Windows, React development server `http://localhost:3000`, Mapbox GL JS 2.15.0.
Frontend development API remains `http://localhost:8000`; backend local settings
confirmed `LOCAL_TEST_MODE=1`, `127.0.0.1:5433/livingatlas_test`. Actual `/allCards`
query returned HTTP 200 and three pre-existing local synthetic cards.
No cards/users were created or deleted. Normal UI selection updates only the
local account's map preference. No hosted configuration, migrations or secrets
were changed. No production tests or deployments were performed.

## Execution and results

From `LivingAtlas1-main/client`, focused command:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/BasemapSwitcher.test.js src/Content2.preview.test.js src/Content2.width.test.js
node node_modules/react-scripts/bin/react-scripts.js build
```

- Final component run: 3 suites, 13/13 tests passed. Five map tests cover public
  style definitions, overlay/camera preservation across raster/Mapbox switches,
  search, controlled preferences and credit link behavior. Eight adjacent card
  tests passed.
- Final build exited 0. Existing ESLint warnings, outdated Browserslist data,
  large bundle warning and `Card.css` container-unit minimizer warning remain.
- `git diff --check` passed. Reviewed product and test diffs before commit.
- Browser: all four public thumbnails loaded; selected each new map and saw
  its content/credit. Existing three markers were visible after clean reload and
  raster switching. Search `free` exposes four options; `USGS` exposes three.
  A selected USGS Topographic preference was observed after reload.
- USGS sample probes: Topographic and Imagery `/tile/10/357/163` returned 200
  `image/jpeg`; Shaded Relief `/tile/7/44/20` returned 200 `image/jpeg`.
  OpenStreetMap was checked through normal browser requests only.
- Screenshot: local Codex artifact `free-basemap-options.png` in this chat's
  visualization directory; final view shows four credited choices, topographic
  imagery and the three existing markers.

## First failures, fixes and limitations

1. Initial map tests had two failures because the fixture omitted the controlled
   selection state used by Home. The component reset to its default as designed
   for that incorrect fixture. Updated the fixture to mirror Home's controlled
   state, then all focused tests passed; product selection behavior was unchanged.
2. Shaded Relief thumbnail at zoom 10 returned 404 despite metadata enumerating
   theoretical levels through 23. Current min/max scale is narrower. Limited the
   source to zoom 7 and derived a valid thumbnail within that range; 200 response
   and rendered thumbnail/map confirmed. Higher map zooms use overzoomed tiles.
3. A sandboxed local API probe reported unavailable; an attempted backend start
   then found port 8000 occupied. Normal-permission checks confirmed the existing
   server and real database query healthy. No backend restart was needed.

Browser checks are smoke evidence for one Washington/Oregon viewport, not an
exhaustive geographic test. External services can change availability and coverage.
Map mocks do not prove arbitrary third-party overlay plugins work. Live ArcGIS,
Mapbox and public basemaps were not load tested. Rollback is reverting the frontend
implementation commit; no database/schema rollback is required.
