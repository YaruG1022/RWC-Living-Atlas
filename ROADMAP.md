# RWC Living Atlas roadmap

Use [Issues](https://github.com/YaruG1022/RWC-Living-Atlas/issues), the repository's linked project board, and [Milestones](https://github.com/YaruG1022/RWC-Living-Atlas/milestones) for current ownership, priority, and delivery scope. This roadmap describes direction rather than fixed dates. Release notes record what actually shipped.

## Near term: reproducible maintenance and releases

- Establish a single issue-to-PR workflow, useful issue forms, a Kanban board, and version milestones.
- Run frontend regressions, a production build, backend checks, and isolated database integration checks in CI; use stable check names for main-branch protection.
- Publish a traceable first version with an exact source commit, known issues, and deployment verification recorded separately.
- Document deployment configuration, migration review, backup/restore, rollback, and the published-manual synchronization process.

These are initial maintenance deliverables. Their acceptance evidence belongs in the corresponding issue and pull request; this document does not assert that repository settings or deployments have already been verified.

## Next: critical user journeys and data integrity

The [test strategy](documentation/TEST_STRATEGY.md) identifies these high-risk areas:

- Signup, login, and authorization boundaries, including duplicate or case-variant accounts and unauthorized operations.
- Card/map/filter consistency and an end-to-end browser path through browsing, editing, and upload, using isolated data.
- Upload validation, deletion failures, and external-service faults without orphaned files or rows.
- Startup migrations with historical data, concurrent startup, backup recovery, and a rehearsed rollback path.

Existing local reports provide regression evidence for specific components. Expand automated coverage where it protects a real failure mode, and keep unrun or environment-dependent checks explicit.

## Later: reliability and access

- Define user-facing service indicators and realistic workloads before setting availability, latency, or capacity targets.
- Rerun the full soak regression, investigate intermittent timeouts, and expand database-outage and transaction-recovery tests in staging.
- Evaluate frontend pagination and rendering cost with representative card volumes.
- Improve keyboard access, focus and form feedback, map alternatives, and browser/mobile compatibility with measurable acceptance criteria.
- Review dependency health and operational monitoring, then turn findings into owned issues.

Keep changes small enough for the current maintainer to verify and operate. Adjust sequencing as production defects, user feedback, and collaborators change the priorities.
