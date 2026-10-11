# Coordinate editor and outlined marker styling

Date: 2026-10-11. Baseline `6d4450e`, branch `codex/compact-card-list`.

Scope: improve the coordinate editor rows, number badges, inputs, tools, actions and icon menu. New default vector markers use slate outlines and translucent gray fill rather than solid black. Picker glyphs, editing map markers and card previews share the same rendering policy. Explicit custom colors retain opaque fill and zero outline width; image marker assets remain available. No migration or backend change.

Used UI UX Pro Max's icon-context guidance and existing web quick-reference rules for accessible names and focus. Existing FontAwesome assets are retained without adding an icon library. The first generic icon-consistency query returned no match; the single narrower accessible-label query returned relevant guidance.

Exit criteria: picker/map style parity, preserved custom colors/assets, adjacent card preview regressions, successful build, visible local coordinate editor and no horizontal menu overflow. No capacity or production claim.

From `LivingAtlas1-main/client`, ran:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/markerIcons.test.js src/RepresentationPreview.test.js src/Card.gallery.test.js --silent
node node_modules/react-scripts/bin/react-scripts.js build
```

Initial results: 3 suites / 33 tests passed in 26.367 seconds; build succeeded with existing lint/Browserslist/CSS calculation/bundle-size warnings. Visual inspection led to a thicker default outline and 312px editor width, placing tools in one row and giving coordinate inputs more room. Added the neutral default to the color palette. Reran marker and preview tests: 2 suites / 9 tests passed in 1.591 seconds. Final build succeeded with the same warning categories. `git diff --check` passed. No test failures.

Browser `http://localhost:3000/`: opened the coordinate editor, added a temporary unsaved point, opened its icon menu and confirmed the gray outlined glyph on the map. Menu clientWidth and scrollWidth both 216px; no horizontal overflow. Saved screenshot `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/coordinate-outline-icons.png`. Canceled the agent-created editor, removing its temporary point without saving a card. No database records were created, so database cleanup is not applicable. Existing basemap was live; no new external requests or dependencies were added. Production, small viewport and full keyboard-flow verification were not executed.

Rollback: revert the feature commit. Default style affects records lacking an explicit saved color; explicit stored colors and image assets are preserved.

## Coordinate typography and map toolbar consistency

Follow-up baseline `f0741d5`: coordinate inputs now use the existing system sans-serif family at 12px / 1.5 line height with tabular numerals. The four map action buttons and add-card menu share the coordinate panel's slate colors, light borders, rounded controls and visible focus states. Coordinate panel offset provides 8.4px measured clearance from the toolbar. No behavior changes or dependencies; no new unit cases for this CSS-only change.

Browser initially exposed two previously hidden native draw buttons because the new group display rule overrode their hidden state. Restored explicit scoped hidden rules; final DOM shows exactly four visible action buttons. All four have computed color `rgb(82, 101, 123)` and border `rgb(213, 223, 235)`. Input computed family is `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`, size 12px, numeric variant `tabular-nums`. Added one unsaved point for visual inspection, then canceled the agent-created editor; no database records were created. Screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/coordinate-font-map-toolbar.png`.

Initial and final builds succeeded with existing warning categories. `git diff --check` passed. Add-coordinate menu path was exercised; screenshot download, reset, visibility toggling, keyboard-only flow and small viewport were not re-exercised because handlers were unchanged.

## Native map controls and geocoder consistency

2026-10-11; baseline `1c1f847`, feature `2b5c677`. Scoped CSS extends the slate palette to fullscreen, navigation, geolocation, zoom scale, geocoder input and suggestions. Controls remain 29px wide; input height is 36px with 13px system text. All nine visible group buttons have computed color `rgb(82, 101, 123)` and border `rgb(213, 223, 235)`; hidden native drawing buttons remain hidden. No handler or dependency changes.

Local browser checks exercised zoom in/out and entering/exiting fullscreen. The first exit attempt still left the Exit fullscreen label and fullscreen layout visible; a fresh DOM snapshot followed by another exit click restored Enter fullscreen. A native Escape attempt did not resolve that state. A checkbox locator failed because the DOM exposes Find my location as a button; the corrected button locator followed by Tab focused the search input. Computed `:focus-visible` was true with a blue solid outline. Screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/map-controls-consistent.png`.

`node node_modules/react-scripts/bin/react-scripts.js build` succeeded with existing lint, Browserslist, CSS calculation and bundle-size warnings. `git diff --check` passed. No data writes or database cleanup were needed. Live basemap remained in use. Geolocation permission, remote search results, screenshot downloads, production and small viewport behavior were not exercised. The fullscreen exit behavior observed above remains a limitation of this browser check; this CSS change does not alter fullscreen handlers. Rollback: revert `2b5c677`.
## Flush square map toolbars

2026-10-11; baseline `01c2ae7`, feature `e55c4c0`. Removed toolbar padding and button gaps; only outer button corners are rounded. A shared 35px outer width also applies to the zoom axis, whose endpoints now have a slate outline and white fill. Buttons use a square aspect ratio. Browser DOM measurements show all nine visible buttons at approximately 33.4 x 33.4px, all five control containers at 35px, zero toolbar padding and button margins, and adjacent navigation/action edges meeting within floating-point precision. Middle buttons have zero radius; single buttons retain all corners. Hidden drawing controls stay hidden.

Final build command `node node_modules/react-scripts/bin/react-scripts.js build` passed with existing warning categories; `git diff --check` passed. Screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/map-square-controls.png`. Add-menu click attempts did not produce an open menu in this browser session; a coordinate click exposed an inspection overlay instead. Menu interaction is therefore not claimed as verified. Handlers were unchanged. No data writes, external requests added, production tests or database cleanup. Rollback: revert `e55c4c0`.

## Attached placement panels, control shadows and shared editor styling

2026-10-11; starting baseline `31b4f49`. Menu gutter removed; placement panels use the shared control width plus 10px map inset. Browser measured menu gap 0.2px (fractional border rounding), and Coordinate, Polygon and Image panel gaps approximately zero. The initial computed toolbar shadow was still Mapbox's black 2px spread; explicit scoped priority now gives all control groups, geocoder and zoom axis the same `rgba(30,58,85,.14) 0 3px 12px` shadow. Reset button now uses the existing Font Awesome `arrows-to-circle` glyph; its flyTo handler is unchanged. Feature commits: `48b21b5`, `a977d4e`.

Extracted Add Points presentation into the common polygon/image placement stylesheet rather than duplicating per-mode rules. Polygon and Image panels measured 312px wide, border `rgb(213,223,235)`, text `rgb(36,59,83)`, header `rgb(248,250,252)`, matching Add Points. Shared styles cover rows, inputs, tool buttons, disabled and focus states, and footer actions. Polygon tools wrap; image list slots also use the shared palette.

Final builds passed with existing warning categories; `git diff --check` passed. Opened and canceled each empty placement panel; no points, images or database rows created. Reset button was clicked while already at its default view. Hot module replacement briefly removed the page during one cancel/menu sequence; subsequent fresh state restored controls and Image open/cancel passed. Earlier menu-click uncertainty from the prior cycle was resolved: the menu and all three options opened successfully in this cycle. No uploads, save paths, production, small viewport or full keyboard regression exercised. Screenshots: `map-tools-attached.png`, `polygon-panel-consistent.png`, `image-panel-consistent.png` under `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/`. Revert the feature commits to roll back these visual changes.

