# PR #4 merge review

Date: 2026-10-11. PR: https://github.com/YaruG1022/RWC-Living-Atlas/pull/4

Base: `7e3315498f08c9aa1ae842b7d3413af31ef3039d` (`main`).

## Standards

Review found one actionable defect in the new attachment download route: failed connection acquisition returned `None`, but the route attempted to use and release it. Return HTTP 503 before entering the cursor/release block. An offline regression executes the actual route in isolation and verifies that failed acquisition never releases an unowned connection slot.

Two trailing blank lines found by the whole-branch whitespace check were removed.

## Spec

No actionable requirements mismatches found. Review covered list previews, pin chronology, gallery overlays, attachments and description insertion, public basemaps, geographic previews, compact controls, attached editors, and help/release notes.

## Validation and limits

- Complete frontend suite: 14 suites, 92 tests passed (39.482 seconds). Console output includes intentional upload-failure fixtures and existing React `act` warnings.
- Initial offline backend suite: 14 tests passed. The new unavailable-connection regression failed before the fix with `AttributeError: 'NoneType' object has no attribute 'cursor'` (one test, 0.132 seconds). After the fix, all 15 offline backend tests passed (0.383 seconds), including HTTP 503 and no unowned-slot release.
- Frontend production build succeeded with existing lint, outdated Browserslist, CSS `cqw` calculation and bundle-size warnings.
- Netlify deploy-preview status passed; no pull-request-triggered GitHub Actions workflow runs were returned. No submitted external reviews or unresolved review threads were present.
- Hosted API fallback remains `https://cereo-backend.onrender.com`; no schema migration, environment change, new dependency, production load test or production database mutation is part of this PR.
- Hosted Azure download networking and production capacity were not validated. Public tiles have variable coverage/availability; not every onboarding step has a browser walkthrough.
- Rollback: revert the merge commit. Existing stored attachment metadata is preserved.
