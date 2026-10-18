"""Offline integration checks against a stateful JSON-speaking gh CLI stub."""

import contextlib
import copy
import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import configure_repository as setup


class FakeCLI:
    def __init__(self):
        self.repo = {
            "node_id": "R_repo", "has_issues": False, "has_projects": True,
            "delete_branch_on_merge": False,
            "owner": {"node_id": "U_owner", "type": "User"},
        }
        self.labels = [{"name": "bug", "color": "123456", "description": "My existing label"}]
        self.milestones, self.issues, self.rulesets = [], [], []
        self.project = None
        self.options = [
            {"id": "todo", "name": "Todo", "color": "GRAY", "description": "Existing default"},
            {"id": "progress", "name": "In Progress", "color": "YELLOW", "description": "Existing progress"},
            {"id": "done", "name": "Done", "color": "GREEN", "description": "Existing done"},
        ]
        self.views, self.items, self.writes = [], [], []
        self.repositories = []
        self.main_sha = "a" * 40
        self.main_reads = 0
        self.move_main = False
        self.deny_projects = False
        self.checks = [
            {"name": name, "app": {"id": 15368}, "status": "completed", "conclusion": "success"}
            for name in setup.REQUIRED_CHECKS
        ]

    def __call__(self, command, *, input, text, capture_output, check):
        assert command[:2] == ["gh", "api"]
        payload = json.loads(input) if input else None
        args = command[2:]
        if args[0] == "graphql":
            if self.deny_projects:
                return SimpleNamespace(returncode=1, stdout="", stderr="permission denied")
            data = self.graphql(payload)
        else:
            method = args[args.index("--method") + 1]
            endpoint = args[args.index("--method") + 2]
            if method != "GET":
                self.writes.append((method, endpoint, copy.deepcopy(payload)))
            data = self.rest(method, endpoint, payload)
            if "--slurp" in args:
                data = [data]
        return SimpleNamespace(returncode=0, stdout=json.dumps(data), stderr="")

    def rest(self, method, endpoint, payload):
        base = f"repos/{setup.REPOSITORY}"
        path = endpoint.split("?")[0]
        if path == base:
            if method == "PATCH":
                self.repo.update(payload)
            return self.repo
        if path == f"{base}/labels":
            if method == "POST":
                self.labels.append(copy.deepcopy(payload))
                return self.labels[-1]
            return self.labels
        if path == f"{base}/milestones":
            if method == "POST":
                self.milestones.append({**payload, "number": len(self.milestones) + 1})
                return self.milestones[-1]
            return self.milestones
        if path == f"{base}/issues":
            if method == "POST":
                number = len(self.issues) + 1
                self.issues.append({**payload, "number": number, "node_id": f"I_{number}", "state": "open"})
                return self.issues[-1]
            return self.issues
        if path == f"{base}/rulesets":
            if method == "POST":
                self.rulesets.append({**copy.deepcopy(payload), "id": 1})
                return self.rulesets[-1]
            return self.rulesets
        if path == f"{base}/rulesets/1":
            if method == "PUT":
                self.rulesets[0] = {**copy.deepcopy(payload), "id": 1}
            return self.rulesets[0]
        if path == f"{base}/branches/main":
            self.main_reads += 1
            sha = "b" * 40 if self.move_main and self.main_reads > 1 else self.main_sha
            return {"commit": {"sha": sha}}
        if path == f"{base}/commits/{self.main_sha}/check-runs":
            return {"check_runs": self.checks}
        raise AssertionError((method, endpoint, payload))

    @staticmethod
    def connection(nodes):
        return {"nodes": nodes, "pageInfo": {"hasNextPage": False, "endCursor": None}}

    def graphql(self, payload):
        query, variables = payload["query"], payload["variables"]
        if query.startswith("mutation"):
            operation = query.split("!){", 1)[1].split("(", 1)[0]
            values = variables["input"]
            self.writes.append(("GRAPHQL", operation, copy.deepcopy(values)))
            if operation == "createProjectV2":
                self.project = {"id": "P_1", "url": "https://github.com/users/YaruG1022/projects/1", "title": values["title"], "closed": False}
                self.repositories = [{"id": values["repositoryId"]}]
                result = {"projectV2": self.project}
            elif operation == "linkProjectV2ToRepository":
                self.repositories.append({"id": values["repositoryId"]})
                result = {"repository": {"id": values["repositoryId"]}}
            elif operation == "updateProjectV2Field":
                self.options = [dict(option, id=option.get("id", f"option-{i}")) for i, option in enumerate(values["singleSelectOptions"])]
                result = {"projectV2Field": {"options": self.options}}
            elif operation == "createProjectV2View":
                self.views.append({"id": "V_board", "name": values["name"], "layout": values["layout"]})
                result = {"projectV2View": self.views[-1]}
            elif operation == "addProjectV2ItemById":
                item = {"id": f"PI_{len(self.items)}", "content": {"id": values["contentId"]}, "fieldValueByName": None}
                self.items.append(item)
                result = {"item": item}
            elif operation == "updateProjectV2ItemFieldValue":
                item = next(item for item in self.items if item["id"] == values["itemId"])
                item["fieldValueByName"] = {"optionId": values["value"]["singleSelectOptionId"]}
                result = {"projectV2Item": item}
            else:
                raise AssertionError(operation)
            return {"data": {operation: result}}
        if "projectsV2(" in query:
            return {"data": {"user": {"projectsV2": self.connection([self.project] if self.project else [])}}}
        for name, nodes in [
            ("repositories", self.repositories),
            ("fields", [{"id": "F_status", "name": "Status", "options": self.options}]),
            ("views", self.views), ("items", self.items),
        ]:
            if f"{name}(first:" in query:
                return {"data": {"node": {name: self.connection(nodes)}}}
        raise AssertionError(query)


class SetupTests(unittest.TestCase):
    def configure(self, cli):
        output = []
        config = setup.RepositorySetup(setup.GitHub(runner=cli), emit=output.append)
        return config, output

    def test_dry_run_is_offline_and_does_not_instantiate_client(self):
        with patch.object(setup, "GitHub", side_effect=AssertionError("No gh client in dry run")), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(setup.main([]), 0)
        self.assertIn("DRY RUN", output.getvalue())
        self.assertIn("zero mandatory approvals", output.getvalue())

    def test_full_setup_is_idempotent_and_preserves_existing_labels(self):
        cli = FakeCLI()
        config, output = self.configure(cli)
        self.assertEqual(config.run(), 0)
        self.assertTrue(cli.repo["has_issues"])
        self.assertTrue(cli.repo["delete_branch_on_merge"])
        self.assertEqual(len(cli.issues), 5)
        self.assertEqual(len(cli.milestones), 1)
        self.assertEqual(cli.labels[0]["color"], "123456")
        self.assertEqual([option["name"] for option in cli.options], [s[0] for s in setup.STATUSES])
        self.assertEqual(cli.views[0]["layout"], "BOARD_LAYOUT")
        self.assertEqual(len(cli.items), 5)
        for issue in cli.issues:
            self.assertEqual(issue["assignees"], ["YaruG1022"])
            self.assertEqual(issue["milestone"], 1)
        rules = {rule["type"]: rule for rule in cli.rulesets[0]["rules"]}
        self.assertEqual(rules["pull_request"]["parameters"]["required_approving_review_count"], 0)
        self.assertIn("deletion", rules)
        self.assertIn("non_fast_forward", rules)
        writes = copy.deepcopy(cli.writes)
        config, _ = self.configure(cli)
        self.assertEqual(config.run(), 0)
        self.assertEqual(cli.writes, writes, "Second apply must not issue redundant mutations")
        self.assertTrue(any("Project with Board view" in line for line in output))

    def test_existing_project_customizations_and_item_status_survive(self):
        cli = FakeCLI()
        self.assertEqual(self.configure(cli)[0].run(), 0)
        cli.options.append({"id": "blocked", "name": "Blocked", "color": "RED", "description": "Waiting on external team"})
        cli.options = [option for option in cli.options if option["name"] != "Ready"]
        cli.options[0]["description"] = "Our triage policy"
        cli.items[0]["fieldValueByName"] = {"optionId": "blocked"}
        cli.issues[0]["body"] = "Maintainer-edited acceptance criteria"
        cli.issues[0]["assignees"] = ["another-contributor"]
        cli.views = [{"id": "V_custom", "name": "Team board", "layout": "BOARD_LAYOUT"}]
        previous = copy.deepcopy(cli.options)
        config, _ = self.configure(cli)
        self.assertEqual(config.run(), 0)
        self.assertEqual(cli.options[:len(previous)], previous)
        self.assertIn("Ready", [option["name"] for option in cli.options])
        self.assertEqual(cli.items[0]["fieldValueByName"]["optionId"], "blocked")
        self.assertEqual(cli.issues[0]["body"], "Maintainer-edited acceptance criteria")
        self.assertEqual(cli.issues[0]["assignees"], ["another-contributor"])
        self.assertEqual(cli.views, [{"id": "V_custom", "name": "Team board", "layout": "BOARD_LAYOUT"}])

    def test_partial_item_setup_recovers_without_duplicate_item(self):
        cli = FakeCLI()
        self.assertEqual(self.configure(cli)[0].run(), 0)
        cli.items[0]["fieldValueByName"] = None
        cli.issues[0]["state"] = "closed"
        self.assertEqual(self.configure(cli)[0].run(), 0)
        self.assertEqual(len(cli.items), 5)
        done = next(option["id"] for option in cli.options if option["name"] == "Done")
        self.assertEqual(cli.items[0]["fieldValueByName"]["optionId"], done)

    def test_unready_checks_defer_rules_but_allow_independent_setup(self):
        for reason in ("missing", "pending", "failed", "wrong_app"):
            with self.subTest(reason=reason):
                cli = FakeCLI()
                if reason == "missing":
                    cli.checks.pop()
                elif reason == "pending":
                    cli.checks[0].update(status="in_progress", conclusion=None)
                elif reason == "failed":
                    cli.checks[0]["conclusion"] = "failure"
                else:
                    cli.checks[0]["app"]["id"] = 42
                config, output = self.configure(cli)
                self.assertEqual(config.run(), 1)
                self.assertEqual(cli.rulesets, [])
                self.assertEqual(len(cli.issues), 5)
                self.assertIsNotNone(cli.project)
                self.assertTrue(any("required checks were not activated" in line for line in output))

    def test_main_head_change_never_activates_rules_from_stale_evidence(self):
        cli = FakeCLI()
        cli.move_main = True
        config, output = self.configure(cli)
        self.assertEqual(config.run(), 1)
        self.assertEqual(cli.rulesets, [])
        self.assertTrue(any("main moved" in line for line in output))

    def test_projects_permission_failure_is_reported_and_other_phases_finish(self):
        cli = FakeCLI()
        cli.deny_projects = True
        config, output = self.configure(cli)
        self.assertEqual(config.run(), 1)
        self.assertEqual(len(cli.issues), 5)
        self.assertEqual(len(cli.rulesets), 1)
        self.assertIn("Project and Kanban Board view", config.incomplete)
        self.assertFalse(any(line.startswith("Project with Board view:") for line in output))

    def test_exact_title_lookup_ignores_pr_and_does_not_duplicate_existing_issue(self):
        cli = FakeCLI()
        cli.issues = [{"number": 1, "title": setup.ISSUES[0]["title"], "pull_request": {"url": "some PR"}}]
        config, _ = self.configure(cli)
        self.assertEqual(config.run(), 0)
        self.assertEqual(len(cli.issues), 6)
        config, _ = self.configure(cli)
        writes = len(cli.writes)
        self.assertEqual(config.run(), 0)
        self.assertEqual(len(cli.writes), writes)

    def test_ambiguous_issue_titles_do_not_create_third_copy(self):
        cli = FakeCLI()
        cli.issues = [{"number": n, "node_id": f"I_{n}", "title": setup.ISSUES[0]["title"]} for n in (1, 2)]
        config, output = self.configure(cli)
        self.assertEqual(config.run(), 1)
        self.assertEqual(len(cli.issues), 2)
        self.assertTrue(any("Multiple issue title matches" in line for line in output))

    def test_cli_errors_do_not_echo_stderr_or_credentials(self):
        def failed(*args, **kwargs):
            return SimpleNamespace(returncode=1, stdout="", stderr="Authorization: token SECRET")
        with self.assertRaises(setup.SetupError) as failure:
            setup.GitHub(runner=failed).rest("GET", "repos/owner/repo")
        self.assertNotIn("SECRET", str(failure.exception))

    def test_graphql_errors_are_failures_even_with_zero_cli_exit(self):
        def graphql_error(*args, **kwargs):
            return SimpleNamespace(returncode=0, stdout='{"data":null,"errors":[{"message":"forbidden"}]}', stderr="")
        with self.assertRaisesRegex(setup.SetupError, "GraphQL returned errors"):
            setup.GitHub(runner=graphql_error).graphql("query{viewer{login}}")


if __name__ == "__main__":
    unittest.main()
