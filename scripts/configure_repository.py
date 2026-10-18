#!/usr/bin/env python3
"""Preview, or explicitly apply, the repository's GitHub maintenance setup.

Uses the authenticated GitHub CLI; never accepts, reads, or prints token values.
Run without --apply for a completely offline, mutation-free plan.
"""

import argparse
import json
import re
import subprocess
import sys
from urllib.parse import quote


REPOSITORY = "YaruG1022/RWC-Living-Atlas"
PROJECT_TITLE = "RWC Living Atlas"
MILESTONE_TITLE = "v0.2.0 reliability"
RULESET_NAME = "Living Atlas main"
REQUIRED_CHECKS = (
    "Frontend regression", "Backend offline regression",
    "PostgreSQL integration", "validate",
)
LABELS = {
    "bug": ("d73a4a", "Unexpected or incorrect behavior"),
    "enhancement": ("a2eeef", "New or improved product behavior"),
    "maintenance": ("ededed", "Reliability and repository upkeep"),
    "documentation": ("0075ca", "Documentation changes"),
    "area:frontend": ("5319e7", "React application and browser behavior"),
    "area:backend": ("1d76db", "FastAPI routes and server behavior"),
    "area:database": ("006b75", "PostgreSQL schema, data, and migrations"),
    "area:ops": ("fbca04", "Deployments, monitoring, and workflows"),
}
STATUSES = (
    ("Backlog", "GRAY", "Captured work awaiting prioritization"),
    ("Ready", "BLUE", "Scoped work with acceptance criteria"),
    ("In Progress", "YELLOW", "Actively being implemented"),
    ("In Review", "PURPLE", "Pull request and validation in progress"),
    ("Done", "GREEN", "Acceptance criteria met and change merged"),
)
ISSUES = (
    {
        "title": "Review and enforce server-side authentication and authorization",
        "labels": ["maintenance", "area:backend"],
        "body": """The application supports accounts and administrative/content operations. The existing test strategy identifies authentication, authorization, and privilege escalation as high-risk areas; a client-side role indicator does not establish server-side enforcement.

Sources: mounted routes in `LivingAtlas1-main/backend/main.py`, `LivingAtlas1-main/backend/account.py`, `LivingAtlas1-main/backend/endpoint_files/card.py`, and `documentation/TEST_STRATEGY.md`.

Acceptance criteria:
- Inventory account, administrative, content-editing, and upload routes and document their authorization requirements.
- Validate the authenticated principal and applicable permissions on the server for each protected route.
- Add positive and negative API tests for anonymous, regular-user, and administrator access, including cross-user edits.
- Record findings through private security reporting when disclosure would expose an exploitable issue; do not publish credentials or sensitive reproduction data here.
""",
    },
    {
        "title": "Validate database migrations, backups, and restore procedures",
        "labels": ["maintenance", "area:database", "area:ops"],
        "body": """The backend applies startup schema changes, and migration 014 can defer uniqueness indexes when historical signup data contains duplicates. Local regression results do not establish production data integrity or recoverability.

Sources: `LivingAtlas1-main/backend/database.py`, `LivingAtlas1-main/database/`, and `LivingAtlas1-main/backend/load_tests/TEST_REPORT.md`.

Acceptance criteria:
- Verify fresh-schema setup and upgrade from a representative previous schema in a disposable database.
- Audit duplicate signup identifiers/emails with an authorized operator, reconcile data, and verify intended constraints.
- Document backup retention, recovery ownership, and a migration rollback/forward-fix procedure.
- Restore a backup into an isolated database and record recovery time and integrity checks without including production records in the repository.
""",
    },
    {
        "title": "Add critical browser end-to-end regression journeys",
        "labels": ["enhancement", "area:frontend", "area:backend"],
        "body": """Component and API checks cover useful regressions, while the test strategy also calls for connected browser journeys. Map integrations, uploads, and account/content flows need validation across the browser/API boundary.

Sources: `documentation/TEST_STRATEGY.md` and existing frontend/backend regression suites.

Acceptance criteria:
- Run a browser suite against an isolated frontend, API, and disposable database with deterministic fixtures.
- Cover signup/login, project discovery and filtering, card detail, and an authorized edit/upload journey.
- Stub external map/storage services for repeatable CI and keep a separate optional live-service smoke check.
- Save traces/screenshots on failure and document how contributors run the suite locally.
""",
    },
    {
        "title": "Establish staging performance targets and investigate intermittent timeouts",
        "labels": ["maintenance", "area:backend", "area:ops"],
        "body": """The local load report records useful baseline, spike, volume, soak, and connection-recovery results, but also unexplained 15-second spike timeouts. It explicitly does not establish a production SLO or sustained capacity; some routes still use module-level database objects.

Source: `LivingAtlas1-main/backend/load_tests/TEST_REPORT.md`.

Acceptance criteria:
- Define documented latency/error-rate targets and representative data volume and concurrency for an isolated staging environment.
- Reproduce or bound the intermittent timeouts with request/database-pool diagnostics.
- Exercise a sustained peak, a longer soak, and database interruption without targeting production.
- Review remaining module-level connection/cursor use and record measured results and residual limits.
""",
    },
    {
        "title": "Resolve the published manual notification failure and verify chatbot sync",
        "labels": ["bug", "area:ops", "documentation"],
        "body": """The audited October 16 workflow completed its validate job but failed in notify while waiting for the exact deployed manual and dispatching sync. This is a deployment/synchronization follow-up, not evidence that the manual regression tests failed.

Sources: `.github/workflows/notify-chatbot-docs.yml` and `scripts/notify-manual-release.py`.

Acceptance criteria:
- Inspect the failing workflow logs and confirm the configured Netlify manual URL and the expected deployed manifest revision/digests.
- Verify the optional chatbot dispatch credential and destination with an authorized operator, without printing secrets.
- Confirm no dispatch occurs for a stale or mismatched release and retain the existing negative regression check.
- Rerun the relevant workflow and record successful deployed-manual verification and, when configured, chatbot synchronization.
""",
    },
)


class SetupError(RuntimeError):
    """An API operation or required setup step could not be completed."""


class GitHub:
    """Small gh JSON adapter; subprocess arguments and stdin avoid shell quoting."""

    def __init__(self, runner=subprocess.run):
        self.runner = runner

    def call(self, args, payload=None):
        command = ["gh", "api", *args]
        if payload is not None:
            command += ["--input", "-"]
        try:
            result = self.runner(
                command, input=None if payload is None else json.dumps(payload),
                text=True, capture_output=True, check=False,
            )
        except FileNotFoundError as exc:
            raise SetupError("Install GitHub CLI (gh) and authenticate before --apply.") from exc
        if result.returncode:
            # gh debug output may contain request headers; never echo it or token data.
            raise SetupError(
                f"gh api failed (exit {result.returncode}); check network access and the "
                "authenticated account's repository administration, Issues, Checks, "
                "and Projects permissions. No authentication output was logged."
            )
        try:
            data = json.loads(result.stdout) if result.stdout.strip() else {}
        except ValueError as exc:
            raise SetupError("gh returned an invalid JSON response.") from exc
        if isinstance(data, dict) and data.get("errors"):
            raise SetupError("GitHub GraphQL returned errors; check Projects permission and API support.")
        return data

    def rest(self, method, path, payload=None):
        return self.call(["--method", method, path], payload)

    def collection(self, path, key=None):
        separator = "&" if "?" in path else "?"
        pages = self.call(["--method", "GET", f"{path}{separator}per_page=100", "--paginate", "--slurp"])
        return [item for page in pages for item in (page[key] if key else page)]

    def graphql(self, query, **variables):
        return self.call(["graphql"], {"query": query, "variables": variables})["data"]

    def mutation(self, name, input_type, result_fields, values):
        query = f"mutation($input:{input_type}!){{{name}(input:$input){{{result_fields}}}}}"
        return self.graphql(query, input=values)[name]


def exactly_one(items, predicate, description):
    matches = [item for item in items if predicate(item)]
    if len(matches) > 1:
        raise SetupError(f"Multiple {description} matches; resolve the ambiguity and rerun.")
    return matches[0] if matches else None


def same_config(actual, expected):
    """Ignore server-added metadata, but compare all managed configuration."""
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(same_config(actual.get(k), v) for k, v in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and len(actual) == len(expected) and all(
            same_config(a, b) for a, b in zip(actual, expected)
        )
    return actual == expected


class RepositorySetup:
    def __init__(self, github, repository=REPOSITORY, emit=print):
        self.github = github
        self.repository = repository
        self.owner = repository.split("/")[0]
        self.base = f"repos/{repository}"
        self.emit = emit
        self.incomplete = []

    def phase(self, name, callback):
        try:
            result = callback()
            self.emit(f"OK: {name}")
            return result
        except SetupError as exc:
            self.incomplete.append(name)
            self.emit(f"INCOMPLETE: {name}: {exc}")
            return None

    def settings(self, repo):
        wanted = {"has_issues": True, "has_projects": True, "delete_branch_on_merge": True}
        changes = {key: value for key, value in wanted.items() if repo.get(key) != value}
        if changes:
            self.github.rest("PATCH", self.base, changes)

    def backlog(self):
        existing = {label["name"] for label in self.github.collection(f"{self.base}/labels")}
        for name, (color, description) in LABELS.items():
            if name not in existing:
                self.github.rest("POST", f"{self.base}/labels", {
                    "name": name, "color": color, "description": description,
                })
        milestones = self.github.collection(f"{self.base}/milestones?state=all")
        milestone = exactly_one(milestones, lambda m: m["title"] == MILESTONE_TITLE, "milestone title")
        if milestone is None:
            milestone = self.github.rest("POST", f"{self.base}/milestones", {
                "title": MILESTONE_TITLE,
                "description": "Reliability follow-ups: access control, recoverability, browser journeys, staging targets, and manual synchronization.",
            })
        existing_issues = self.github.collection(f"{self.base}/issues?state=all")
        issues = []
        for spec in ISSUES:
            issue = exactly_one(existing_issues, lambda i: not i.get("pull_request") and i["title"] == spec["title"], "issue title")
            if issue is None:
                issue = self.github.rest("POST", f"{self.base}/issues", {
                    **spec, "assignees": [self.owner], "milestone": milestone["number"],
                })
            # Preserve existing issue state, edits, assignments, and milestone decisions.
            issues.append(issue)
            self.emit(f"Issue: {issue.get('html_url', '#' + str(issue['number']))}")
        return issues

    def project_nodes(self, owner_type):
        kind = "organization" if owner_type == "Organization" else "user"
        query = f"""query($login:String!,$after:String){{{kind}(login:$login){{
          projectsV2(first:100,after:$after){{nodes{{id title closed url}}
          pageInfo{{hasNextPage endCursor}}}}
        }}}}"""
        nodes, cursor = [], None
        while True:
            connection = self.github.graphql(query, login=self.owner, after=cursor)[kind]["projectsV2"]
            nodes.extend(connection["nodes"])
            if not connection["pageInfo"]["hasNextPage"]:
                return nodes
            cursor = connection["pageInfo"]["endCursor"]

    def project_connection(self, project_id, name, fields):
        query = f"""query($id:ID!,$after:String){{node(id:$id){{... on ProjectV2{{
          {name}(first:100,after:$after){{nodes{{{fields}}} pageInfo{{hasNextPage endCursor}}}}
        }}}}}}"""
        nodes, cursor = [], None
        while True:
            connection = self.github.graphql(query, id=project_id, after=cursor)["node"][name]
            nodes.extend(node for node in connection["nodes"] if node)
            if not connection["pageInfo"]["hasNextPage"]:
                return nodes
            cursor = connection["pageInfo"]["endCursor"]

    def project(self, repo, issues):
        project = exactly_one(self.project_nodes(repo["owner"]["type"]), lambda p: p["title"] == PROJECT_TITLE, "project title")
        created = project is None
        if created:
            project = self.github.mutation("createProjectV2", "CreateProjectV2Input", "projectV2{id url}", {
                "ownerId": repo["owner"]["node_id"], "repositoryId": repo["node_id"], "title": PROJECT_TITLE,
            })["projectV2"]
        elif project["closed"]:
            raise SetupError("The matching project is closed; reopen it or choose a different project explicitly.")
        project_id = project["id"]
        if not created:
            repositories = self.project_connection(project_id, "repositories", "id")
            if not any(r["id"] == repo["node_id"] for r in repositories):
                self.github.mutation("linkProjectV2ToRepository", "LinkProjectV2ToRepositoryInput", "repository{id}", {
                    "projectId": project_id, "repositoryId": repo["node_id"],
                })
        fields = self.project_connection(project_id, "fields", """
          ... on ProjectV2SingleSelectField{id name options{id name color description}}
        """)
        status = exactly_one(fields, lambda field: field.get("name") == "Status", "Status field")
        if status is None:
            raise SetupError("Project has no single-select Status field; restore it in project settings and rerun.")
        options = status["options"]
        missing = [dict(name=name, color=color, description=description) for name, color, description in STATUSES if not any(option["name"] == name for option in options)]
        wanted_options = options + missing
        if created:
            # An empty new project can use exactly the intended five columns.
            by_name = {option["name"]: option for option in wanted_options}
            wanted_options = [by_name[name] for name, _, _ in STATUSES]
        if wanted_options != options:
            # IDs preserve existing item values; extra/custom options remain intact.
            result = self.github.mutation("updateProjectV2Field", "UpdateProjectV2FieldInput", """
              projectV2Field{... on ProjectV2SingleSelectField{options{id name color description}}}
            """, {"fieldId": status["id"], "singleSelectOptions": wanted_options})
            options = result["projectV2Field"]["options"]
        views = self.project_connection(project_id, "views", "id name layout")
        if not any(view["layout"] == "BOARD_LAYOUT" for view in views):
            self.github.mutation("createProjectV2View", "CreateProjectV2ViewInput", "projectV2View{id}", {
                "projectId": project_id, "name": "Kanban", "layout": "BOARD_LAYOUT",
            })
        items = self.project_connection(project_id, "items", """id content{... on Issue{id}}
          fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{optionId}}
        """)
        known = {item["content"]["id"]: item for item in items if item.get("content") and item["content"].get("id")}
        for issue in issues:
            item = known.get(issue["node_id"])
            if item and item.get("fieldValueByName"):
                continue  # Never reset an existing item's status or other fields.
            if item is None:
                item = self.github.mutation("addProjectV2ItemById", "AddProjectV2ItemByIdInput", "item{id}", {
                    "projectId": project_id, "contentId": issue["node_id"],
                })["item"]
            initial_status = "Done" if issue.get("state") == "closed" else "Backlog"
            option_id = next(option["id"] for option in options if option["name"] == initial_status)
            self.github.mutation("updateProjectV2ItemFieldValue", "UpdateProjectV2ItemFieldValueInput", "projectV2Item{id}", {
                "projectId": project_id, "itemId": item["id"], "fieldId": status["id"],
                "value": {"singleSelectOptionId": option_id},
            })
        self.emit(f"Project with Board view: {project['url']}")

    def ruleset(self):
        wanted = {
            "name": RULESET_NAME, "target": "branch", "enforcement": "active",
            "bypass_actors": [],
            "conditions": {"ref_name": {"include": ["refs/heads/main"], "exclude": []}},
            "rules": [
                {"type": "deletion"}, {"type": "non_fast_forward"},
                {"type": "pull_request", "parameters": {
                    "dismiss_stale_reviews_on_push": False, "require_code_owner_review": False,
                    "require_last_push_approval": False, "required_approving_review_count": 0,
                    "required_review_thread_resolution": True,
                }},
                {"type": "required_status_checks", "parameters": {
                    "required_status_checks": [{"context": name, "integration_id": 15368} for name in REQUIRED_CHECKS],
                    "strict_required_status_checks_policy": True,
                }},
            ],
        }
        rulesets = self.github.collection(f"{self.base}/rulesets?includes_parents=false")
        existing = exactly_one(rulesets, lambda r: r["name"] == RULESET_NAME, "managed ruleset name")
        if existing:
            existing = self.github.rest("GET", f"{self.base}/rulesets/{existing['id']}")
            # Rule order is not meaningful and the API may return a different order.
            existing["rules"] = sorted(existing["rules"], key=lambda r: r["type"])
        wanted["rules"] = sorted(wanted["rules"], key=lambda r: r["type"])
        for configuration in (existing, wanted):
            if configuration:
                for rule in configuration["rules"]:
                    if rule["type"] == "required_status_checks":
                        rule["parameters"]["required_status_checks"].sort(key=lambda check: check["context"])
        if existing and same_config(existing, wanted):
            return
        branch = self.github.rest("GET", f"{self.base}/branches/main")
        sha = branch["commit"]["sha"]
        checks = self.github.collection(f"{self.base}/commits/{quote(sha, safe='')}/check-runs?filter=latest", "check_runs")
        unready = []
        for name in REQUIRED_CHECKS:
            matching = [check for check in checks if check["name"] == name and check.get("app", {}).get("id") == 15368]
            # Require every latest matching GitHub Actions check to pass, including reruns.
            if not matching or any(check.get("status") != "completed" or check.get("conclusion") != "success" for check in matching):
                unready.append(name)
        if unready:
            raise SetupError(f"Main {sha[:12]} has missing, pending, or unsuccessful GitHub Actions checks: {', '.join(unready)}. Merge/run the regression workflows, wait for success, then rerun --apply; required checks were not activated.")
        # Recheck head immediately before mutation rather than applying stale evidence.
        if self.github.rest("GET", f"{self.base}/branches/main")["commit"]["sha"] != sha:
            raise SetupError("main moved during setup; rerun after its checks pass. Rules were not changed.")
        endpoint = f"{self.base}/rulesets"
        self.github.rest("PUT" if existing else "POST", f"{endpoint}/{existing['id']}" if existing else endpoint, wanted)

    def run(self):
        repo = self.github.rest("GET", self.base)
        self.phase("repository settings", lambda: self.settings(repo))
        issues = self.phase("labels, milestone, and follow-up issues", self.backlog)
        if issues is not None:
            self.phase("Project and Kanban Board view", lambda: self.project(repo, issues))
        else:
            self.incomplete.append("Project and Kanban Board view")
            self.emit("INCOMPLETE: Project items depend on successful backlog setup; rerun after resolving it.")
        self.phase("main ruleset", self.ruleset)
        if self.incomplete:
            self.emit("Setup incomplete. Existing successful phases are safe to reuse on the next run.")
            return 1
        self.emit("GitHub settings, backlog, Project Board view, and main ruleset configured.")
        return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply the plan with authenticated gh; without this flag no commands or network calls run.")
    parser.add_argument("--repo", default=REPOSITORY, help="Target owner/repository (default: %(default)s)")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repo):
        parser.error("--repo must be owner/repository")
    if not args.apply:
        print(f"DRY RUN for {args.repo}; no commands, network requests, or mutations.")
        print("Enable Issues/Projects; enable deletion of merged branches; preserve existing label customizations.")
        print("Ensure labels: " + ", ".join(LABELS))
        print(f"Ensure milestone {MILESTONE_TITLE!r} and these owner-assigned follow-up issues:")
        for issue in ISSUES:
            print("  - " + issue["title"])
        print(f"Ensure owner Project {PROJECT_TITLE!r}, repository link, and a Board view.")
        print("Preserve existing options and item statuses; add missing Status options: " + ", ".join(s[0] for s in STATUSES))
        print(f"Ensure main PR ruleset {RULESET_NAME!r}: zero mandatory approvals; block deletion/force push.")
        print("Require successful GitHub Actions checks on current main before activating: " + ", ".join(REQUIRED_CHECKS))
        print("Releases are managed separately; this script does not create or publish a release.")
        print("Run again with --apply from an authenticated, admin-capable GitHub CLI to execute.")
        return 0
    try:
        return RepositorySetup(GitHub(), args.repo).run()
    except SetupError as exc:
        print(f"INCOMPLETE: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
