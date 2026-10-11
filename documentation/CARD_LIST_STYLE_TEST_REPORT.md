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
