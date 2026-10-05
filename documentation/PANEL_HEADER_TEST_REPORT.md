# Compact panel headers — local verification

Date: 2026-10-05. Baseline: 03a7e19, branch `codex/learn-more-gallery-layouts`.

Scope: reduce vertical titlebar whitespace in Cards, ArcGIS Services, Custom Layers, Map Style, Watershed Delineation, and Chatbot. Only CSS spacing changes; title fonts, button dimensions, and application behavior are preserved. Unused legacy LayerPanel and RemovedServicesPanel components are outside the mounted homepage panels.

Acceptance: 2px vertical titlebar padding, reduced spacing below the divider, aligned titles and existing 28px action buttons without clipping. No API/database mutations, uploads, performance workload, or deployment validation were required.

Local browser checks at `http://localhost:3000/`:

- Cards, Custom Layers, ArcGIS Services, Map Style, and Watershed titlebars measured 32.8px high with 2px vertical padding. Cards previously measured 40.8px; the other panels previously specified 16px total vertical padding rather than 4px.
- Each of the four left panels opened successfully; restored Custom Layers after verification. Titles, help/tutorial/close buttons and adjacent controls remain aligned.
- Screenshot reviewed: `compact-panel-headers.png` in the task visualization directory.
- Chatbot uses the same spacing changes and retains its beta notice. Its browser open attempt failed with a stale target while page state was changing; visual verification of the open Chatbot is not claimed.
- `git diff --check` passed. No new tests were added for these reversible CSS-only changes. No full build or backend tests were repeated.

Evidence: `C:/Users/yarug/.codex/visualizations/2026/10/05/01a109cf-a51e-71e3-9e03-71304bf43699/compact-panel-headers.png`.

## Chatbot appearance follow-up

2026-10-05, baseline `8138db0`: removed the beta notice paragraph and its unused CSS; replaced the mode-toggle text with the existing Font Awesome `right-left` icon and an accessible destination label; removed the pill override so it uses the shared 28px circular button style. Floating panel dimensions changed to 400×500px; sidebar dimension overrides are preserved.

Local browser verification: opened the floating panel through its visible handle icon (the parent handle extends beyond the viewport when collapsed). Measured panel width 400px and height 500px; mode button width/height 28px, border radius 50%, empty visible text, and `right-left` SVG icon; notice element count zero. Screenshot `chatbot-400x500.png` in the same evidence directory was visually reviewed. Hot reload rendered the new icon and layout successfully, and `git diff --check` passed. No chat messages were submitted or backend data changed. Existing mode-toggle handler was retained; no new tests or full build were needed for this small appearance change.

## Compact map card popup

2026-10-05, baseline `90b2019`: card popup dimensions changed to 200×250px, image region to 125px, information padding to 8px, and footer vertical padding to 2px with a 28px edit button. Long information can scroll independently, keeping the footer visible. Removed obsolete mobile overrides that enlarged the card popup and narrowed its contents; ArcGIS popups retain their existing dimensions.

First local browser measurement was 200×350px: the shared Mapbox popup rule used `height: 350px !important`, overriding the initial card-specific height. Added the matching card-specific priority and remeasured successfully at 200×250px. Information region measured 89px and footer 32.8px; title, category, tags, image preview, close and Edit controls remained visible. Screenshot `map-card-popup-200x250.png` in the evidence directory was visually reviewed. `git diff --check` passed. CSS-only scope; no API/database writes, new tests, full build, mobile viewport run, or deployment verification.

Follow-up: requested width changed to 275px with height retained at 250px. `git diff --check` passed. Browser verification could not measure an open popup while the map view was changing; this follow-up size is verified in CSS only.

## Toolbar labels and smaller header buttons

2026-10-05, baseline `6132f04`: Add Card now has visible text alongside the plus
icon and uses the standard toolbar button width. Removed the adjacent marker
visibility toggle and its now-unused state/import. Header circles in Cards,
ArcGIS Services, Custom Layers, Map Style, Watershed, and Chatbot are 24px rather
than 28px; icon sizes and handlers remain unchanged.

Local browser confirmed the Add Card label, absence of Hide/Show Markers, and
24×24px dimensions for all six visible Cards/ArcGIS header buttons. Reviewed
`panel-toolbar-compact-buttons.png` in the evidence directory; controls remain
aligned in the narrow Cards panel. Development rendering and `git diff --check`
passed. No card creation, data writes, new tests, or full build were needed.

## Fixed-width card list

2026-10-05, baseline `54f4248`: list-mode Cards panel is exactly 310px wide,
including initial/restored preferences and automatic list mode. Removed its
resize handle while in list mode and guarded the drag handler. Parent width
state stays synchronized for map layout; returning to grid restores the previous
width and retains resizing. List-specific CSS overrides the percentage minimum
and split-panel width.

Local browser measured 310px with zero resize handles in list mode. Switching
to grid restored the previous width (311px in this session) and one resize
handle; switching back measured 310px and zero handles again. Reviewed
`card-list-fixed-310.png` in the evidence directory. Development rendering and
`git diff --check` passed. No data writes, new tests, full build, mobile viewport
or split-panel browser checks were performed.

## Preserve grid width and fix view-switch synchronization

2026-10-05, baseline `2831d5a`: the preceding width synchronization mutated the
shared grid width when entering list mode. Preference loading also reset this
width to 25% of the viewport for list preferences. Removed both writes: Home
retains a separate grid width, while actual list mode reports only the map space
requirement (310px). Grid drag resizing remains unchanged.

Found an additional conflicting-effect bug: automatic split-panel list mode
and initial preference loading could overwrite each other. A component test
reproduced a 560px grid panel where the forced list should be 310px. Replaced
competing mode effects with a derived mode (`bothOnLeft || prefersListView`).

Added `Content2.width.test.js` around the actual Content2 component with external
data/child components mocked. Initial harness failures were an unmocked Axios
ES module and CRA resetting API mocks; repaired the harness before evaluating
product behavior. Product result before the mode fix: 2 tests passed, forced
split-panel test failed (expected 310px, received 560px). After fix: 3/3 width
tests passed, covering five grid/list round trips, initial list preferences, and
forced split-panel entry/exit. The adjacent 18 gallery tests also passed.

Command: `CI=true node node_modules/react-scripts/bin/react-scripts.js test
--watch=false --runInBand --testPathPattern='(Content2.width|LearnMoreGallery)'`.
Local browser: three complete round trips each measured list 310px, grid 569px
(the original grid baseline). Reviewed `grid-width-preserved.png` in the
evidence directory. `git diff --check` passed; no data writes or deployment.

## Favorites inside Filter By

2026-10-05, baseline `83d093d`: removed the toolbar Favorites button and added
Show only favorited cards to Filter By. Its pending value is applied with category
and tags, reset by Clear, discarded on dismissal, and included in the active
filter count. Signed-out visitors see a disabled checkbox and login hint. Existing
bookmark filtering is reused. Homepage feature search now opens Filter By for
favorites, and toolbar onboarding text reflects the moved functionality.

Added three FilterDropdown tests for apply/count/clear, dismissed edits, and
signed-out access. These and three width regression tests passed (6 total).
Browser confirmed checkbox placement and toolbar removal. Apply showed zero
cards for the current account's empty favorites with badge 1; Clear restored all
three cards and removed the badge. Reviewed `favorites-in-filter.png` in the
evidence directory. No bookmark or card data was changed. `git diff --check`
passed; no backend changes or deployment.
