# Built-in regional layer snapshots

These committed GeoJSON files are served by the application at
`/data/builtin-layers/`. Checking a new layer never downloads GIS data from
Mapbox, Azure, GitHub, ArcGIS, or another external host. This applies to all six
built-in overlays, including Hydrological Boundaries and City Limits. Basemaps
keep their own sources; these vector overlays also work on raster basemaps.

| Layer | Features | Dataset and scope |
| --- | ---: | --- |
| Hydrological Boundaries | 226 | USGS WBD HUC8 subbasins associated with WA, OR, or ID and intersecting the regional extent. Full subbasins can cross state borders. |
| Rivers | 23 | Natural Earth 1:10 million major river and connecting lake-centerline features intersecting the regional extent. Includes Columbia, Snake and Willamette rivers. |
| City Limits | 721 | Census TIGERweb incorporated places in WA, OR, and ID. Includes cities and towns, excludes census-designated places and urban growth areas. |
| National Forests | 36 | Selected simplified proclaimed USFS national forest boundaries associated with WA, OR, or ID. Full forest units can extend across state borders. |
| Lakes & Reservoirs | 14 | Natural Earth 1:10 million lake/reservoir polygons intersecting the regional extent. |
| Major Roads | 352 | Natural Earth 1:10 million road features intersecting the regional extent; ferries excluded. |

The selection extent is longitude -125 to -110.8, latitude 41.9 to 49.1.
Features are selected by extent intersection and are **not clipped** to state
boundaries. Small water bodies and local streets are not comprehensively
represented. These are generalized regional reference layers, not navigation,
legal-boundary, parcel-ownership, or forest-canopy data.

## Provenance and licenses

`manifest.json` records pinned upstream URLs, feature counts, byte counts,
SHA-256 hashes, coordinate system, and coverage limitations.

- **Lakes/roads/rivers:** Natural Earth vector data, pinned repository revision
  `ca96624a56bd078437bca8184e78163e5039ad19`.
  Original source: https://github.com/nvkelso/natural-earth-vector
  Public domain; complete terms/credits in `NATURAL-EARTH-LICENSE.md`.
  Rivers uses `ne_10m_rivers_lake_centerlines`, including 16 river and 7 lake
  centerline features. Features can extend beyond the extent; small streams and
  tributaries are not comprehensively represented. This is a river-line overlay,
  independently selectable from the HUC8 drainage-area polygons.
- **Forests:** USFS Original Proclaimed National Forests geometry, obtained
  through the Theodore Roosevelt Presidential Library's simplified boundary
  collection at revision `2cfc36874b526e6dfc6fe38ad4aeb9b50da62f02`.
  Mirror and processing provenance:
  https://github.com/Theodore-Roosevelt-Presidential-Library/PresidentialPublicLands
  Original USFS layer:
  https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_ProclaimedForestBoundaries_01/MapServer/0
  The mirror is MIT licensed; its copyright/permission notice is included in
  `FORESTS-LICENSE.txt`. This is a selected proclaimed-boundary collection,
  not a complete inventory of current administrative forests. Names may
  identify component forests that have since been administratively combined.
  Historical acreage, historical protection years and historical-map coloring
  are deliberately not presented as current attributes.
- **Hydrological boundaries:** USGS Watershed Boundary Dataset, HUC8 subbasins,
  downloaded 2026-11-11 from the official National Map service:
  https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4
  These are drainage-area polygons, replacing the previous Mapbox NHD-streams
  tileset. Geometry is generalized at 0.006 degrees for a regional overview.
  Names, HUC8 identifiers and associated states are preserved.
- **City limits:** U.S. Census Bureau TIGERweb Incorporated Places (layer 4),
  downloaded 2026-11-11:
  https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4
  Geometry is generalized at 0.001 degrees; names, Census GEOIDs and states are
  preserved. The service's description/vintage is recorded in the manifest.
  This replaces the previous Washington city/urban-growth-area Mapbox tilesets
  with incorporated place boundaries across all three states.

The two new boundary snapshots are public-domain federal data; see
`BOUNDARIES-LICENSE.md`. The manifest records exact query URLs, download date,
simplification tolerances and hashes. The refresh script first requests all
matching object IDs and checks each geometry batch against those IDs to prevent
silently truncated downloads. Query IDs are source extraction identifiers;
shipped feature IDs use stable HUC8 or Census GEOID values.

Coordinates are WGS84 longitude/latitude, rounded to five decimal places before
boundary repair. Generalized boundary rings are repaired with GDAL MakeValid;
new intersections retain full precision so repaired polygons remain valid.
Rounding does not improve the accuracy of the upstream generalized geometry.

## Refreshing

From the client directory, explicitly run:

```sh
python scripts/builtin-layers/generate.py
python scripts/builtin-layers/generate-boundaries.py --cache-dir /path/to/upstream-cache
node --test scripts/builtin-layers/data.test.cjs
```

The original Python script uses only the standard library. The boundary refresh
also requires `ogr2ogr` (GDAL with GEOS); it is a data preparation dependency,
not a runtime or application build dependency. Review and update pinned
revisions when refreshing the pinned datasets. The boundary script refreshes the
two live official services separately and preserves the other manifest entries;
the original script preserves existing boundary entries. Retain the response
cache to reproduce an extraction from identical inputs. Review all data and
license changes, then commit the regenerated files. Normal application builds
copy the committed snapshots and do not run the download script. There are no
runtime service keys, database migrations, or additional hosting accounts.
