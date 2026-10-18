# GitHub repository setup

The repository contains reviewable governance files, workflows, and an idempotent setup script. Committing those files **does not enable GitHub settings, create Issues or a Project, or activate branch rules**. Those changes require an authenticated GitHub account with the permissions below and a successful `--apply` run. A dry run is only a plan.

## Preview and apply

Prerequisites: Python 3.12+, [GitHub CLI](https://cli.github.com/), access to GitHub's API, and an authenticated maintainer account. From the repository root:

```sh
python scripts/configure_repository.py
gh auth status
python scripts/configure_repository.py --apply
```

The first command is completely offline: it does not invoke `gh`, inspect authentication, or send API requests. Only `--apply` can mutate GitHub. The default target is `YaruG1022/RWC-Living-Atlas`; `--repo OWNER/REPOSITORY` explicitly selects another target and assigns new issues to that repository's owner.

Use the normal `gh auth login` flow if needed. For an existing GitHub CLI OAuth login, Projects may require granting the `project` scope with `gh auth refresh -s project`. The authenticated user must also have repository administration access. A token restricted to code read/write is insufficient.

For fine-grained credentials, grant the target repository **Administration: read and write**, **Issues: read and write**, **Checks: read**, **Contents: read** (to read the main branch), and the normal **Metadata: read** permission. GitHub Projects are owned by an account rather than a repository; the credential must separately have read/write access to that owner's Projects. Personal-account Projects support varies by credential type: use a maintainer's GitHub CLI OAuth login with `project` when a repository-scoped token cannot access them. Never put a token in a command argument, commit, issue, or support log. The script delegates authentication to `gh` and does not print credential values or raw CLI debug output.

## What applying changes

| Area | Managed configuration |
| --- | --- |
| Settings | Enable Issues and Projects; automatically delete merged branches. No existing branches are deleted by this script. |
| Labels | Ensure `bug`, `enhancement`, `maintenance`, `documentation`, `area:frontend`, `area:backend`, `area:database`, and `area:ops`; preserve existing labels and their custom descriptions/colors. |
| Milestone | Ensure `v0.2.0 reliability`, without inventing a due date. |
| Backlog | Ensure five concrete follow-up Issues covering server-side access control, migration/backup/restore checks, critical browser journeys, staging performance targets/timeouts, and the manual notification failure. New Issues are assigned to `YaruG1022` and the milestone. |
| Project | Locate or create the owner's `RWC Living Atlas` Project, link this repository, ensure a real Board view, and add the follow-up Issues. |
| Status | Ensure `Backlog`, `Ready`, `In Progress`, `In Review`, and `Done`; preserve existing option IDs, colors, descriptions, extra options, custom views, and populated item statuses. Newly added open Issues start in Backlog; closed Issues start in Done. |
| Main rules | Require a PR, zero mandatory approvals for the current solo-maintainer workflow, resolved review threads, and successful regression checks. Block branch deletion and force pushes. No administrator bypass is added. |

The named main ruleset requires these **GitHub Actions** contexts:

- `Frontend regression`
- `Backend offline regression`
- `PostgreSQL integration`
- `validate` (the existing manual validation job)

To avoid requiring checks that have never run, the script activates or changes its managed ruleset only after all four contexts have succeeded on the exact latest `main` commit. Merge the workflow changes, wait for those checks to complete, and rerun `--apply` if this phase is deferred. An already matching ruleset stays in place when a later main run is pending or failing. Other existing rulesets are left intact.

`notify` is a deployment/manual synchronization job and is not a required PR check. Its audited October 16 failure is tracked as a follow-up Issue; the successful `validate` job is a separate result. Creating a public backlog item must not expose sensitive security findings or production data.

The script manages only its named resources. Exact-title lookups include closed Issues and milestones to avoid recreating completed work. Existing issue bodies, assignments, state, and milestone changes are preserved. It refuses ambiguous duplicate titles and closed matching Projects instead of silently selecting one. This is repeatable sequential setup, not a concurrent provisioning service; run one copy at a time. Renaming a managed resource changes its lookup identity, so update the script or restore its title before rerunning.

## Results and remaining work

The apply command prints `OK` or `INCOMPLETE` for each phase and exits with status **1** when any phase could not finish. Successful earlier phases remain in place and are reused on the next run. A Projects permission error therefore does not falsely report that a board was created, and it does not prevent the independent main-rules phase from running.

If the authenticated GitHub integration lacks administration or Projects access, the script is ready to run but remote configuration is **pending**. Use an authorized maintainer's `gh` session and rerun; do not treat a committed script or a printed dry-run plan as proof of configuration. Verify the repository's Issues, Projects, milestone, and Settings → Rules → Rulesets after a successful apply.

The Board view API is used directly. If the available GitHub schema or credential does not support it, the Project phase reports incomplete; select **Board** in the Project's view menu or use a supported credential/schema, then rerun to verify it. Existing board grouping and filters are preserved. Confirm that the working Board groups by **Status** in the UI. Built-in automation such as moving merged PRs to Done should be enabled in Project settings once the team's desired transitions are settled; the script does not overwrite workflow customizations or claim to configure them.

GitHub Releases and version tags are managed by the separate release workflow/process, not by this setup script. Existing branch history, deployments, secrets, and production data are outside its scope.

## Offline verification

```sh
python -m unittest discover -s scripts -p 'test_configure_repository.py' -v
```

The tests use a stateful fake `gh` process that exchanges JSON, with no GitHub credentials or network access. They exercise repeated application, existing customization preservation, partial setup recovery, issue-title matching, permission failures, and main-check gating, including a moving branch head. Passing them verifies the setup logic, not live GitHub permissions or successful remote configuration.

API references: [GitHub Projects GraphQL schema](https://docs.github.com/en/graphql/reference/projects) (option IDs preserve field values; `createProjectV2View` supports `BOARD_LAYOUT`) and [repository rulesets REST API](https://docs.github.com/en/rest/repos/rules).
