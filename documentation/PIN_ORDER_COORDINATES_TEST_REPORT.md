# Pin chronology and compact map coordinates

2026-10-11; baseline `3d399a3`, branch `codex/compact-card-list`.

Scope: frontend ordering and the bottom-left map information panel. No backend,
database, storage or dependency changes. Expected behavior: visible pinned cards
follow pin insertion order independently of dataset sorting; unpin/re-pin appends
to the end; saved order survives reopening; filtered/missing cards do not erase
stored pin positions. Coordinate values remain readable in a shorter panel.

Implementation: consume the insertion-ordered saved Set through a lookup of the
currently displayed cards. Unpinned sorting and selected-map-card priority retain
their existing behavior. Coordinates use 12px text, 14px line height, 3px vertical
padding, tabular numerals and a subtle top border.

Validation:

- `CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/Content2.preview.test.js src/Content2.width.test.js --silent`: 10 passed. New cases verify pin order against reversed dataset order, unpin/re-pin order, persisted list order, and missing stored IDs. Existing preview/width cases also passed.
- First run: 2 new tests failed because the fixture omitted the logged-in state required to pin and used an incorrect title selector. Corrected the fixture and selector; all 10 passed on rerun.
- Browser at `http://localhost:3000`: kept the existing `test 2` pin, pinned `test 1` then `test 3`; observed exactly `test 2`, `test 1`, `test 3`, all pinned. Removed the two temporary pins afterward, restoring the original pin choice. No card data was modified.
- Same browser viewport measured the coordinate region at 56px before and approximately 34.8px after, a reduction of approximately 38%, with both coordinate rows present. Screenshot: `C:/Users/yarug/.codex/visualizations/2026/10/11/01a128ce-0ac2-78e3-b432-6a4cbabbee86/pin-order-compact-coordinates.png`.
- Optimized frontend build passed with existing lint, Browserslist, bundle size and `cqw` minimizer warnings. `git diff --check` passed.

Mapbox was live during local browser checks, outside the test assertions. No
performance/load, hosted preview or production validation was performed.
