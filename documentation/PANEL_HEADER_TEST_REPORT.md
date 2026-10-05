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
