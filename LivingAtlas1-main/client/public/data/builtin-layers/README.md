# Built-in regional layer snapshots

These committed GeoJSON files are served by the application at
`/data/builtin-layers/`. Checking a new layer never downloads GIS data from
Mapbox, Azure, GitHub, ArcGIS, or another external host. The existing basemaps
and two older built-in layers retain their existing sources.

| Layer | Features | Dataset and scope |
| --- | ---: | --- |
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

- **Lakes/roads:** Natural Earth vector data, pinned repository revision
  `ca96624a56bd078437bca8184e78163e5039ad19`.
  Original source: https://github.com/nvkelso/natural-earth-vector
  Public domain; complete terms/credits in `NATURAL-EARTH-LICENSE.md`.
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

Coordinates are WGS84 longitude/latitude, rounded to five decimal places.
Rounding does not improve the accuracy of the upstream generalized geometry.

## Refreshing

From the client directory, explicitly run:

```sh
python scripts/builtin-layers/generate.py
node --test scripts/builtin-layers/data.test.cjs
```

The Python script uses only the standard library. Review and update pinned
revisions when refreshing from a new source version, review all data and
license changes, then commit the regenerated files. Normal application builds
copy the committed snapshots and do not run the download script. There are no
runtime service keys, database migrations, or additional hosting accounts.
