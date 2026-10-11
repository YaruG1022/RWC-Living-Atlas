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
