# Card description drafting verification

On November 24, 2026, verification used Atlas main at `850004d` as the baseline, Atlas API change `2a80a8d`, Atlas frontend change `daf9a67`, and Helper change `69cb0ca`. The browser used a local frontend build configured for `http://localhost:8000`, with synthetic projects and intercepted API responses. Model calls used test doubles.

| Check | Result |
| --- | --- |
| Create Project and Learn More | Chrome filled a blank description on desktop and previewed the replacement for an existing Learn More description at 375 px. It verified the session header, draft link, card ID, and explicit **Use draft** action. |
| Frontend regression | All 289 tests passed across 44 suites. The focused editor and modal suites covered prepared image uploads, preservation of typed text, and abort on close. |
| Atlas API and source processing | 23 focused tests passed. They covered authorization, selected saved assets, images, files, public link redirects and limits, unreadable sources, and safe provider errors. The simulated route checked that generation did not write card data. |
| Atlas backend regression | In an isolated checkout, 83 passed and 6 skipped. The same 15 gallery tests failed on the baseline and feature branch. |
| Atlas Helper | 56 tests passed, including 13 for the new endpoint. They covered the shared token and configured text and vision request formats. |
| Manual export | The export validated 21 sections and 352 blocks. |
| PostgreSQL | Diagnostic SQL verified `livingatlas_test` on `127.0.0.1:5433`. An existing relation lock blocked the integration smoke test before any fixture insert. |

The first browser attempts timed out because the test initially targeted a collapsed Projects panel and then searched for a list row while the grid was active. The corrected run opened the panel and selected the actual project heading. The first build attempt used a Windows sandbox path containing an exclamation mark. Building into the workspace's ignored local test directory resolved that error. The frontend bundle still reports existing lint and CSS parser warnings.

The initial backend suite loaded the workspace's existing Azure test configuration. Its legacy suite created two synthetic test objects, deleted them, and verified both returned HTTP 404. Two image upload cases rejected the suite's `fake-png` fixture before upload. Both baseline and feature reruns used archive exports without cloud credentials.

The browser script is under `LivingAtlas1-main/backend/.local-postgres/description_browser_smoke.cjs`. To rerun the source tests, use `python -m pytest tests/test_card_description.py tests/test_card_description_links.py` from the Atlas backend and `python -m pytest tests/test_card_description.py` from the Helper. The browser, source, and model checks exercised functionality with synthetic data. Live model quality, hosted storage reads, and throughput remain unmeasured.
