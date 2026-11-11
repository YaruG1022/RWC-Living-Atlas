# Release history reconciliation

Validated 2026-11-11. Editorial release dates follow the requested dates rather
than the execution date. Changelog and Update History now render the same shared
release list, newest first:

- 11/6/2026: this session's administration/session-refresh fixes, GIS ZIP and
  StreamStats uploads, six locally served built-in overlays, Rivers, legends,
  layer information dialogs, opacity, basemap restoration and related guides.
- 10/26/2026: Azure backend/chatbot migration, Netlify service configuration,
  automatic GitHub Actions deployment, OpenAPI and deployed-version fixes.
- 10/24/2026: contact email and image uploads, resizing/progress/retry/framing,
  Custom Layers recovery, location conversion, unsaved drafts and independent
  linked-layer display choices.
- 10/18/2026: consistent pages/project panels, filters, scrollbars, watershed and
  detail controls, release notes, tours, manual and Atlas Helper guidance.

Removed the mixed 11/11 and former 10/25 release grouping. Preserved the prior
10/14, 10/13, 10/11, 10/5 releases and existing September-and-earlier history.
The Changelog opens only the latest 11/6 section by default.

## Verification

- Changelog/manual focused regression: 2 suites / 9 tests passed. The changelog
  test checks the requested date order, identical current release content on
  both surfaces, initial expansion, and absence of the mislabeled dates.
- Production build passed with existing lint warnings and captured all 146
  versioned manual screenshots.
- Real Chromium verified matching dates, ordered list items and topic placement
  on both surfaces, the default expanded section, preserved prior releases,
  desktop/mobile layout and no page errors. External map/API responses were
  mocked; no account records, production data or service settings were changed.

Evidence: [Changelog](changelog-november.png),
[Changelog October](changelog-october.png), [mobile](changelog-mobile.png),
[Update History](history-november.png), [October](history-october.png),
[October 18](history-october18.png).
