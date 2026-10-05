# GUI guide update — 2026-10-05

Baseline: 9fa31a4, branch codex/learn-more-gallery-layouts. Scope: local React onboarding and manual; no production, database writes, load tests, migrations, or deployment.

## Target and oracle
Match current GUI controls and placement: Filter By favorites with staged Apply/Clear, Add Card label, fixed 310px list / adjustable grid, six selected gallery images / 30 total, numbered selection versus bulk deletion, edit-only cover styling, Representation coordinates, and floating chat controls. Preserve existing guide indices and edit-mode transition. Manual sections must render without throwing, including reused gallery callbacks. Non-functional checks are compilation and visual layout; no capacity claim.

## Evidence
- Component regression command (client cwd): `node node_modules/react-scripts/bin/react-scripts.js test --watch=false --runInBand --testPathPattern='(UserManual|LearnMoreGallery|FilterDropdown|Content2.width)'` with CI=true: 4 suites, 25 tests passed. Final manual-only rerun: 1 passed.
- Production build: `node node_modules/react-scripts/bin/react-scripts.js build` succeeded with existing ESLint, outdated Browserslist, bundle-size, and Card.css cqw minimizer warnings.
- Browser localhost: manual toolbar and detail sections render current instructions and gallery; Cards onboarding step 3 displays favorites-in-Filter-By wording. No records created, changed, or deleted.
- Screenshot: C:/Users/yarug/.codex/visualizations/2026/10/05/01a109cf-a51e-71e3-9e03-71304bf43699/manual-current-gui.png.
- `git diff --check` passed. Hosted API fallback and backend configuration unchanged.

## Initial issues and repairs
First manual test command ran at repository root and failed Jest root-directory validation; reran at client cwd. Initial passing test emitted jsdom scrollTo-not-implemented diagnostics; mocked the browser-only scroll API and reran cleanly. Browser screenshot exposed Add Card text constrained by the old icon-only class; removed that class and verified the final layout. A browser tour click attempted while Cards was collapsed; opened Cards and verified the tour. No new dependencies.

Limitations: local guide validation, not a deployed preview or production validation. Other unchanged tours were source-audited, not exhaustively replayed.

## Categorized release notes follow-up

Baseline a2b835c. Added a 10/5/2026 release to both ChangelogModal and ChangelogHistory, with shared content covering gallery management, Cards/filtering, headers/chat, popups/coordinates, and guides. Small style edits are grouped with their larger feature. Earlier dates and Future Works are retained.

`CI=true node node_modules/react-scripts/bin/react-scripts.js test --watch=false --runInBand --testPathPattern='Changelog'` at client cwd: 1 test passed. Oracle: both views render every shared category/item; latest dialog release is open and previous release collapsed; old history remains. Initial test failed because its modal app element was document.body, hiding the dialog from role queries. The harness now uses a dedicated application root, matching real modal isolation; rerun passed. Product modal accessibility was unchanged.

Browser localhost confirmed both updated views. Screenshots: changelog-oct5.png and update-history-oct5.png in the same evidence directory above. No test records created. Static diff checks passed; no backend, configuration, migration, deployment, or production changes.
