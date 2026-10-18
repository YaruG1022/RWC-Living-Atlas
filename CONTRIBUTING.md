# Contributing to RWC Living Atlas

Use [GitHub Issues](https://github.com/YaruG1022/RWC-Living-Atlas/issues) to report a bug, propose a feature, or plan maintenance. For a vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Plan the change

Choose the relevant issue form and describe the problem, expected outcome, and acceptance criteria. Keep each issue small enough to review and verify. A maintainer assigns an owner, priority, and target milestone when the work is ready; a milestone is a delivery plan rather than a guaranteed date. Discuss substantial behavior, schema, or dependency changes before implementing them.

The project board follows this workflow:

| Status | Meaning |
| --- | --- |
| Backlog | Recorded work that has not been scheduled. |
| Ready | Scope, acceptance criteria, and owner are clear. |
| In Progress | Implementation or investigation is underway. |
| In Review | A pull request is open and its checks or review are pending. |
| Done | The agreed acceptance criteria are met and the change is merged, or a non-code task has been verified. |

Use the issue and its linked pull request as the source of truth. Keep active work limited to what can be finished and reviewed. Record blocked work and its dependency in the issue. Merging and deploying are separate events: retain the deployed commit and verification evidence in the release record even after the issue is Done.

## Develop locally

Follow the [README setup instructions](README.md#getting-started) and the [isolated local testing guide](LivingAtlas1-main/backend/LOCAL_TESTING.md). Confirm that the frontend targets your local API and that the backend uses a disposable local database before running write tests. Never run registration, load, cleanup, or fault-injection scripts against production.

Create a branch from current `main` and keep the diff focused. Keep environment files, credentials, database dumps, uploaded user files, and personal data out of commits, screenshots, and logs. Use synthetic fixtures and clean them up after verification.

Run checks appropriate to the affected behavior. The [Engineering CI workflow](.github/workflows/ci.yml) runs `Frontend regression`, `Backend offline regression`, and `PostgreSQL integration`. The [manual workflow](.github/workflows/notify-chatbot-docs.yml) also runs its `validate` check. For frontend work, install the locked dependencies and run affected tests from `LivingAtlas1-main/client`, for example:

```sh
npm ci --ignore-scripts --no-audit --no-fund
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/UserManual.test.js
npm run build
```

Replace the example test path with the tests relevant to your change. The production build also exports the manual and captures its screenshots. Backend tests that use real Azure storage are integration tests and require an explicitly selected test storage account; do not run them against production. See the [test strategy](documentation/TEST_STRATEGY.md) for risk-based coverage, existing evidence, and work still planned.

## Submit and review a pull request

- Link the issue, using `Closes #123` only when the PR completes its acceptance criteria.
- Describe the user-visible change, verification commands and results, and any remaining risk. Include screenshots for visual changes.
- Explain database migrations, configuration changes, external service requirements, and rollback implications when applicable.
- Update relevant documentation and preserve useful failure or regression evidence.
- Wait for required GitHub checks to pass, address review feedback, and resolve conversations before merging. A skipped or canceled check is not evidence of a passing test.

Use a focused title and a clear commit history. During single-maintainer operation, the maintainer may review and merge their own PR after checks pass; an additional approving reviewer is not required. Seek another review for sensitive authorization, data integrity, or deployment changes when a collaborator is available. Do not bypass a failing check without investigating and recording the reason.

## Release and maintain

Use a version milestone to collect the work intended for a release. Once the candidate commit passes its checks, review migrations, configuration, known issues, and the recovery plan. Create a version tag and GitHub Release tied to that exact commit, with links to included issues and PRs. Use `vMAJOR.MINOR.PATCH`; while the project is at `0.x`, record any incompatible changes explicitly in the release notes. Use a prerelease when verification or compatibility work is still pending, and do not move a published tag to a different commit.

A GitHub Release records a source version; it does not prove that the website is deployed or healthy. Record the actual frontend and backend revisions, deployment status, smoke-test results, and any incident or follow-up issue. Follow [Operations and release maintenance](documentation/OPERATIONS.md) for deployment, backup, restore, and rollback procedures.

## License

By submitting a contribution, you agree that your contribution is provided under the repository's [MIT License](LICENSE.txt). Keep existing copyright and license notices, and identify any third-party code or assets and their licenses.
