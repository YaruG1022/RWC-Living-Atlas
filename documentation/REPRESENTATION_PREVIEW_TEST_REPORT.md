# Geographic representation preview

Date: 2026-10-11. Baseline: `392071d`, branch `codex/compact-card-list`.

## Scope and exit criteria

Replace the generic Representation icon/thumbnail in the card details modal with a north-up, fitted preview of saved coordinates. Single points use the same category imagery as the map; multipoints use their individual icons, colors and opacity. Polygons preserve ring geometry, fill opacity, border color and line style. Image overlays display the actual asset transformed to all four geographic corners.

Exit criteria: correct projection and corner mapping, invalid geometry/image fallback, existing gallery regressions passing, frontend build succeeding, and a real local polygon visibly matching the map. No performance or capacity claim. No new dependencies, backend changes, database writes or external map requests introduced by this preview. Existing browser basemap remains live; remote image assets load normally when present. Production deployment and remote-image availability are outside this local check.

## Cases and results

`RepresentationPreview.test.js`: 7 passing cases covering north-up projection, narrow/point geometry, invalid coordinates, date-line crossing, projective image corner mapping and degenerate image geometry, multiple polygon ring styles including zero opacity, point category imagery and individual multipoint styles, image load failure/replacement, and missing geometry.

Command from `LivingAtlas1-main/client`:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/RepresentationPreview.test.js src/Card.gallery.test.js src/LearnMoreGallery.test.js --silent
```

Result: 3 suites, 47 tests passed in 56.352 seconds. After correcting public image asset paths, the 7 preview cases were rerun successfully in 2.078 seconds.

```powershell
node node_modules/react-scripts/bin/react-scripts.js build
```

Result: exit 0, compiled with existing lint, outdated Browserslist, CSS `cqw` calculation and bundle-size warnings. Initial hot compilation rejected imports outside `src` for category marker PNGs; corrected to the existing `/blue_marker.png`, `/green_marker.png`, `/yellow_marker.png` public assets. Build then succeeded and the browser error overlay disappeared. Removed the two icon imports made unused by this change.

Browser verification: `http://localhost:3000/`, existing local `test 3` polygon. Opened card details without saving/editing records; preview shows the same blue triangle as the map, inside the Representation section. Screenshot retained at `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/representation-polygon-preview.png`. Image overlays and multipoints are covered by component/geometry cases; no real image-overlay card was created. No test data was created, so database reconciliation and cleanup are not applicable.

The preview is a scaled geographic appearance on a lightweight coordinate grid, without a separate basemap. Large geographic extents and polar coordinates follow clamped Web Mercator projection. Remote image failures explicitly show `Image unavailable`. Rollback: revert the feature commit; no migrations required.

## Visual refinement with UI UX Pro Max

Follow-up baseline: `879f854`. Used the installed `ui-ux-pro-max` skill's web text-reflow guidance and quick-reference rules. The initial broad visual-hierarchy query returned unrelated hover/bulk-action guidance; narrowed once to `card spacing consistency`, which returned relevant web text reflow guidance. React layout search returned no match; its retry returned composition guidance not needed here, so responsive styling uses the skill's general web defaults rather than claiming a relevant stack-specific match.

Changes: enlarged the actual preview to a fluid 320px maximum, softened the coordinate grid and frame, added a clear type title and a bordered count badge, and used wrapping layout/content-driven height to retain narrow-width text. Existing modal colors and 8px corner radius remain consistent. Local screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/representation-polished-preview.png`. Browser measurement: preview 320px; region 936.8px wide with scrollWidth 935px, no horizontal overflow. No card changes were saved.

Validation: `RepresentationPreview.test.js` and `Card.gallery.test.js`, same test options as above, 2 suites / 29 tests passed in 63.318 seconds. Production build exit 0 with the same existing warning categories. `git diff --check` passed. Narrow viewport and production verification were not executed; wrapping is implemented without claiming a mobile browser pass.
