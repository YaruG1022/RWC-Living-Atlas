# Release date and historical guide audit

Audit date: 2026-11-16 (America/Los_Angeles). Base: `8e7104c0f73cb9432041e2bc0b5c91ee454a55d0`.
The requested editorial release date is **11/14/2026**; it is independent of the audit date.

## Requirements and result

The user asks to include this session's changes under November 14 in both What's New and Update History, and check the October 14–November 6 releases against the User Manual and onboarding, correcting any missing or outdated guidance.

Both update surfaces read `latestGuiUpdates.js`. Its newest entry now uses November 14, including the layer/dialog improvements and this guide audit. Earlier releases, including November 6, retain their dates and content. Browser checks confirmed the same November 14 entry on both surfaces, with no November 16 release heading.

## Audit matrix

Each decision compares the release notes, the current user-facing guide and the owning implementation. Existing accurate instructions remain intact; no functionality or deployment configuration is changed.

| Release/topic | Evidence inspected | Decision |
| --- | --- | --- |
| 10/14: manual gallery and helper | `manual/sections/chatbot.json`, `detail-view.json`, `ManualGalleryDemo.js`, `OnboardingGeneral.js`; helper repository `chat_tools.py`, `question_intent.py` at `940c1ee` | Existing gallery controls, verified manual references, visual fallback, text-question behavior and live-data distinction are already covered. No new provider requests or model evaluation. |
| 10/18: page/panel consistency and filters | `toolbar.json`, `OnboardingCardPanel.js`, `FilterDropdown.js` | Existing floating-filter, Apply/Clear, narrow-panel and hover-preview guidance is current. Typography-only changes need no new user steps. |
| 10/18: watershed and detail controls | `watershed-panel.json`, `OnboardingWatershedPanel.js`, `WatershedPanel.js`, `detail-view.json`, `Card.js` | Pour-point preview, cancellation, clearing, both save options, interior-hole restriction and unsaved edits are already covered. |
| 10/24: contact email | `Card.js` Contact Email view/edit fields, `add-card.json`, `detail-view.json`, `UserManual.js`, `OnboardingLearnMore.js` | Creation guidance was correct. Fix two detail examples still labeled Email, add the contact field to the edit example, and clarify that changing the contact never changes the creator/owner. Examples use a non-account contact address. |
| 10/24: images and retry/framing | `imageUploads.js`, backend `endpoint_files/image_processing.py`, creation/detail chapters and both corresponding tours | Manual already covers originals, framing, retries and preserving completed uploads. The backend applies its 40 MP limit to every BMP, not only compressed BMPs. Correct that qualification in both manual chapters and add the BMP limit to both upload tours; other supported formats retain the 50 MiB/160 MP limits. |
| 10/24: location conversion, drafts, linked display and library recovery | `Card.js`, `CustomLayersPanel.js`, detail/custom chapters, `OnboardingLearnMore.js`, `OnboardingCustomLayersPanel.js` | Existing Point/Polygon/Image conversion, Cancel/Save, Close/outside/Escape guards, per-viewer linked layers and Retry instructions are current. Add uploaded GIS/StreamStats formats and library Retry to the brief welcome overview as well. |
| 10/26: Azure and automatic deployment | `.github/workflows/main_rwc-atlas-api.yml`, navigation and helper chapters | Hosting/workflow changes introduce no new end-user operation. Keep deployment internals out of user flows; service configuration is outside this documentation correction. |
| 11/6: administration | `App.js` saved-auth restoration, `Administration.js`, `profile-admin.json`, `accounts.json`, `OnboardingGeneral.js` | Role confirmation, last-admin protection and deletion restrictions are already documented. Add refresh/restored-sign-in behavior to the account chapter, app tour and welcome overview. Registration overview now says request access, matching the existing approval workflow. |
| 11/6: built-ins and uploads | `builtinLayers.js`, `builtinLayerController.js` style restoration, `ArcgisUploadPanel.js`, relevant manual chapters/tours | Six layers, source/coverage dialogs, file formats and saving are covered. Explicitly include built-ins in opacity instructions and state that selected built-ins return after a basemap change. Brief tour/welcome descriptions now mention regional site-hosted snapshots and all six built-ins. |

Manual chapter data lives in `LivingAtlas1-main/client/src/manual/sections`; React examples are in `UserManual.js`. Both the rendered manual and its exported helper knowledge use this chapter content. No chapter/block identifiers or tour selectors/step order were changed.

## Verification

- Local component run: **4 suites / 20 tests passed** (`Changelog`, `UserManual`, `ManualText`, `AppDialogHost`). The date regression checks November 14 and absence of November 16 in both update surfaces.
- `node --test scripts/export-manual.test.cjs`: **1 passed**. `node scripts/export-manual.cjs`: **21 chapters / 347 blocks** validated/exported.
- Browser, `http://localhost:3000`: opened What's New and Updates, then the detail manual chapter. Confirmed the new date and Contact Email example. [Update dialog](changelog-11-14.jpg), [history](history-11-14.jpg), [manual example](manual-contact-email.jpg).
- `git diff --check`: passed. Complete frontend/build/manual screenshot checks run on the PR before merge.

Commands from `LivingAtlas1-main/client`:

```powershell
$env:CI='true'
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --silent --transformIgnorePatterns 'node_modules/(?!axios)/' --runTestsByPath src/Changelog.test.js src/UserManual.test.js src/manual/ManualText.test.js src/AppDialogHost.test.js
node --test scripts/export-manual.test.cjs
node scripts/export-manual.cjs
```

Raw fixture-only results: ignored `LivingAtlas1-main/backend/.local-postgres/release-guides-tests.json`. Tests and screenshots use manual examples; no project or user records are created or changed. No database, storage, provider, load or production-capacity testing is implied. The local frontend remains connected to its isolated local backend; this change only adjusts guide content and release grouping. Reverting these commits requires no data migration.
