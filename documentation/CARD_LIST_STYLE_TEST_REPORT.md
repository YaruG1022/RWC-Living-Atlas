# Card list and gallery toolbar style verification

Date: 2026-10-10 (America/Los_Angeles). Baseline: `7e3315498f08c9aa1ae842b7d3413af31ef3039d`.
Branch: `codex/compact-card-list`. Runtime: Node.js 24.19.0, installed frontend dependencies.

Scope: compact list rows, horizontal space usage, hover styling, and gallery toolbar icon alignment. No backend, database, external map services, deployment, or load tests were exercised. Browser checks used 22 synthetic rows and the source CSS in a temporary local HTML fixture at `127.0.0.1:3011`; this was not a full application end-to-end test. No persisted test data was created.

Changes: list container margins/padding were reduced, row gap removed, row separators retained, and nonshrinking rows slide right by 3px on hover with a 200ms transition and elevated shadow. Reduced-motion preferences disable the transition and displacement. Gallery buttons and the grip wrapper share flex centering.

Validation:

- `node node_modules/react-scripts/bin/react-scripts.js build`: exit 0. Existing JavaScript lint warnings, outdated Browserslist data, bundle-size advisory, and a `Card.css` container-unit minimizer warning remain; this change edits CSS only.
- With `CI=true`: `node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/LearnMoreGallery.test.js src/Content2.width.test.js`: 2 suites, 21 tests passed.
- Initial test startup failed with sandbox `EPERM` on temporary-directory `realpath`; retry with a workspace temporary directory failed similarly. Running the same tests outside the sandbox succeeded.
- The first browser preview could not access the sandbox-hosted server. Restarting the loopback-only fixture outside the sandbox resolved this.
- Browser viewport widths 1280px and 480px: adjacent row gap within 0.001px of zero; no horizontal overflow. Row width approximately 288.6px within a 292px client width, reserving only the 3px hover allowance plus fractional layout rounding. Long titles ellipsize and menu controls remain visible.
- Desktop: all four gallery SVG icon vertical centers match exactly. At 480px, the grip is intentionally hidden by the existing mobile rule; all three visible icon centers match exactly.
- Hover transition and reduced-motion override were reviewed in CSS; pointer animation was not measured. Menu behavior and real application data were not browser-tested.
- `git diff --check`: passed. Temporary fixture server was stopped and fixture files removed; no database cleanup was needed.

Acceptance: frontend build and related component regressions pass; fixture measurements confirm compact spacing, width usage, and icon alignment. Production appearance remains unverified until deployment.

## Follow-up: list surfaces and panel-aware hover

Date: 2026-10-10. Baseline: `3cc1c3a`. This refinement supersedes the original list styles above: the list has a pale blue-gray background, white rounded rows with subtle full borders, and menu buttons using the toolbar's blue border/text palette. Adjacent borders overlap by 1px to keep rows touching. Padding and always-reserved scrollbar space are removed; a scrollbar occupies width only when needed. Hover moves toward the map: -3px in the right panel and +3px in the left panel. The reduced-motion override remains in place.

Verification used the actual running application at `localhost:3000`, local backend at `127.0.0.1:8000`, and the existing `livingatlas_test` database at `127.0.0.1:5433` with `LOCAL_TEST_MODE=1`. Three existing cards were read; no cards were created, modified, or deleted. Mapbox was live; no external data writes or load tests were performed. Panel placement was restored to the right after verification.

- Actual list width: client width 308px; rendered row width 308.4px (fractional browser rounding), with zero container padding and zero reserved gutter. No horizontal overflow at desktop or 480px viewport width.
- List background `rgb(238, 242, 247)` differs from white rows. Full row borders use `rgb(216, 225, 234)`. Adjacent rows overlap their borders by 1px without an open gap.
- Real pointer hover was observed through menu-button clicks: computed transforms were `matrix(1, 0, 0, 1, -3, 0)` on the right and `matrix(1, 0, 0, 1, 3, 0)` on the left. The more-options menu opened correctly in both placements.
- Existing `Content2.width.test.js`: 3 tests passed using the command recorded above with that test path only.
- Development server compiled successfully; `git diff --check` passed. The production build result is recorded below.
- Production build: exit 0, with the same pre-existing warnings described in the original verification. This follow-up changes only `Content2.css` and this report; hosted endpoint configuration and database migrations are unchanged. No deployment was performed.

## Follow-up: visible hover edges and list-region boundary

Date: 2026-10-10. Baseline: `c1812ba`. The first implementation clipped the hovered edge in both the scroll container and the outer panel. The list scroll viewport now extends 4px toward the map, with matching internal space on that side. Only an open list panel permits outer overflow; a collapsed panel and grid mode keep their original clipping behavior. The list region has a subtle `#bfd0e2` border, rounded upper corners and a 4px top separation from the toolbar. Rows remain compact and fill the available width.

Actual local-browser checks used the same three existing cards and environment as the preceding follow-up. No data writes occurred. Right-side hover: row left 930.2px, panel left 931.6px, scroll viewport left 928.4px. Left-side hover: row right 367.26px, panel right 365.86px, viewport right 369.06px. Both hovered rows extended visibly past the panel boundary while remaining entirely within the scroll viewport. No horizontal overflow was detected. The menu opened correctly; closing the panel restored `overflow: hidden`. Panel placement and open state were restored to the user's right-side list afterward.

Existing `Content2.width.test.js`: 3 tests passed. Development compilation and `git diff --check` passed. No new production build or deployment was run for this CSS-only refinement; long-list scrolling and production appearance were not separately exercised.

## Follow-up: keep the entire list inside the card panel

Date: 2026-10-10. Baseline: `21e8485`. The expanded viewport from the preceding refinement visibly extended beyond the outer card panel. Per the updated requirement, the list width is now exactly 100% of the panel content width, negative margins are removed, and the panel uses its original hidden overflow. The 4px movement allowance remains inside the list on the map side; the border and toolbar separation remain intact.

Actual local-browser checks in both panel placements confirmed that the whole list rectangle lies within the panel and the hovered row lies within the list. Right-side hover remained -3px; left-side hover remained +3px, with no horizontal overflow. The existing three cards were unchanged, menus were opened without selecting any data action, and right-side placement was restored. The local environment and live Mapbox scope are the same as above. `Content2.width.test.js` passed all 3 tests, development compilation succeeded, and `git diff --check` passed. No production build or deployment was run for this refinement.

## Follow-up: flush toolbar boundary and square list corners

Date: 2026-10-10. Baseline: `cffa62e`. Removed the list's 4px top margin and set its region border radius to zero. Actual browser measurements confirmed zero toolbar/list gap (within 0.001px browser rounding), `margin: 0px`, and `border-radius: 0px`. Development compilation and `git diff --check` passed. This two-property CSS adjustment required no additional tests, database writes, production build, or deployment; existing row styling and internal hover allowance remain intact.

## Delayed grid-card hover preview

Date: 2026-10-10. Baseline: `e6e7169`. After 500ms over a list row, the existing Card instance appears as a noninteractive preview on the map side: left of a right-side panel, right of a left-side panel. Its images, title, tags, favorite and pin appearance reuse the grid presentation. A body portal prevents clipping without extending the list region. Width is capped at 240px and reduced to available map space; no preview opens when less than 140px is available. Height is bounded by the viewport. Leaving, clicking, scrolling, resizing, window blur, changing panel placement/view/visibility/menu, or changing visible card order clears the preview and pending timer. Unmount clears the timer. Existing learn-more instances are retained rather than creating extra Card instances on every hover.

Tests: `Content2.preview.test.js` plus `Content2.width.test.js`, using the existing recorded Jest command with these two paths, passed 2 suites / 8 tests. Preview cases cover the 500ms threshold, immediate dismissal, early leave, rapid row changes, placement, scroll/resize cancellation, view switching and unmount. Initial run had 4 preview failures because Jest reset the API mock implementation; initialization moved to `beforeEach`. The next run passed 6/7 tests: the left-panel fixture incorrectly placed the panel near the right viewport edge, where previews intentionally cannot fit. Correcting its bounds produced 7/7 passes; adding rapid-switch coverage produced the final 8/8 pass.

Actual local browser: the existing `test 3` card showed its image, title and tags in a 240px preview at x=683.6px for the right panel, and x=373.86px for the left panel. Moving away cleared the preview. Right-side placement was restored. No cards or database rows were created or changed. Environment and live Mapbox scope remain as recorded above. Production build exited 0 with the existing project warnings; `git diff --check` passed. No deployment or long-list load test was performed.
Clicking the list title still opened the existing learn-more modal; closing it restored the list successfully.
