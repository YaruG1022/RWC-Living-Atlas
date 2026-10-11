# Manual and onboarding synchronization — 2026-10-11

Baseline: `689d322`, branch `codex/compact-card-list`.

## Scope

Synchronize help with this conversation's completed UI changes:

- Project Cards heading; compact panel actions; joined square list results; delayed grid-card hover previews toward the map; chronological pin ordering.
- Gallery controls inside the image area, edit-only layout selector, and hover/focus opacity.
- Multiple attachment selection, accumulating batches, review/removal, 5 MB per-file limit, saved downloads including text files, and Description Link/File insertion.
- Actual Map location previews and click-to-close-and-locate behavior, including unsaved-edit confirmation.
- OpenStreetMap and three USGS basemaps, coverage and best-effort availability.
- Compact map controls, updated reset icon, coordinate readout, toolbar-adjacent menus/editors, Add Points flow, neutral marker defaults, and shared Polygon/Image panel styling.

Added an attachments tour step and its DOM target. Existing edit-mode transition index remains unchanged because the new step follows that transition.

## Validation

Local frontend only. No backend/data mutations, load tests, deployment or external-service availability checks were required for help content. External maps and storage were excluded.

Command (client directory):

```
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --runTestsByPath src/UserManual.test.js src/RepresentationPreview.test.js src/LearnMoreGallery.test.js
node node_modules/react-scripts/bin/react-scripts.js build
git diff --check
```

The initial three-suite run passed all 26 tests. After extending manual navigation coverage to the map editor guides, the manual test failed because a navigation button and a body cross-link shared the same label. The query was scoped to the navigation landmark. The final run passed all 26 tests in three suites (4.555 seconds), including the expanded guide navigation and existing gallery callbacks.

Build succeeded with warnings: existing lint warnings, outdated Browserslist data, the existing `cqw` CSS calculation warning, and bundle-size advice. Diff whitespace check passed. No browser tour walkthrough or production validation was performed; tour targets were checked against the component markup.
