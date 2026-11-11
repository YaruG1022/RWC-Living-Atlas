# Built-in layer information dialogs

Validated 2026-11-11. Replaced the six inline About this layer disclosures with
small circular question-mark buttons at the right of each built-in layer row.
The buttons are outside the checkbox labels, so reading information never
selects or unselects a layer.

Each button opens a compact React Modal portal next to its anchor. The dialog
shows the layer name, coverage description, credited source link and Zoom to
region. Prefer the right or left side when it fits; otherwise place above/below
and clamp inside the viewport. Resize/scroll and size changes remeasure it.
The header stays available when content needs to scroll in a short viewport.

React Modal handles background accessibility hiding, focus containment, Escape,
outside-click dismissal and returning focus to the triggering question mark.
Close and Zoom also dismiss the dialog; Zoom preserves layer selection.

## Verification

- Full frontend regression: 38 suites / 249 tests passed.
- Added three interaction/layout tests: info without selection, Escape/focus
  restoration, outside close, Zoom, and positioning after a small-window resize.
  Existing built-in panel tests now verify all six help buttons and source links.
- Production build passed with existing lint warnings; manual export and 146
  manual screenshot captures passed. Final stylesheet build also passed.
- Real Chromium check passed for all six dialogs. Verified portal placement,
  source links, no checkbox changes or GIS downloads, Escape/outside/X closing,
  keyboard Tab containment, focus restoration, and Zoom without selection.
- Viewport bounds checked at 1440×1000, 760×764, 390×420 and 390×260, including
  resizing an open dialog. No page errors. External basemap/API responses were
  mocked to isolate this UI check; no accounts or database records were changed.

Evidence: [compact list](compact-list.png), [desktop](desktop-dialog.png),
[narrow panel](narrow-dialog.png), [mobile](mobile-dialog.png),
[short viewport](short-dialog.png).
