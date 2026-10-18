import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "publish_initial_release", Path(__file__).with_name("publish_initial_release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
SHA = "a" * 40


class FakeGitHub:
    def __init__(self, *, passed=True, head=SHA, existing=False, tag=False):
        self.calls = []
        self.passed, self.head, self.existing, self.tag = passed, head, existing, tag

    def __call__(self, method, path, payload=None):
        self.calls.append((method, path, payload))
        if method == "POST":
            return {"html_url": "https://github.com/example/atlas/releases/tag/v0.1.0"}
        if "/releases/tags/" in path:
            if self.existing:
                return {"html_url": "https://github.com/example/atlas/releases/tag/v0.1.0"}
            raise release.GitHubError("gh: Not Found (HTTP 404)")
        if path.endswith("/git/ref/heads/main"):
            return {"object": {"sha": self.head}}
        if "/actions/runs?" in path:
            return {"workflow_runs": [{
                "path": release.WORKFLOW, "head_sha": SHA, "head_branch": "main",
                "event": "push", "conclusion": "success" if self.passed else "failure",
            }]}
        if "/git/ref/tags/" in path:
            if self.tag:
                return {"object": {"sha": SHA}}
            raise release.GitHubError("gh: Not Found (HTTP 404)")
        raise AssertionError(path)


class InitialReleaseTests(unittest.TestCase):
    def test_preview_does_not_publish(self):
        api = FakeGitHub()
        self.assertIn("Ready", release.publish("example/atlas", SHA, "Notes", api=api))
        self.assertTrue(all(call[0] == "GET" for call in api.calls))

    def test_requires_successful_exact_main_ci(self):
        api = FakeGitHub(passed=False)
        with self.assertRaisesRegex(RuntimeError, "has not passed"):
            release.publish("example/atlas", SHA, "Notes", apply=True, api=api)
        self.assertTrue(all(call[0] == "GET" for call in api.calls))

    def test_publishes_tested_commit(self):
        api = FakeGitHub()
        release.publish("example/atlas", SHA, "Notes", apply=True, api=api)
        post = [call for call in api.calls if call[0] == "POST"]
        self.assertEqual(len(post), 2)
        self.assertTrue(post[0][1].endswith("/git/refs"))
        self.assertEqual(post[0][2], {"ref": "refs/tags/v0.1.0", "sha": SHA})
        self.assertEqual(post[1][2]["target_commitish"], SHA)
        self.assertEqual(post[1][2]["tag_name"], release.TAG)
        self.assertFalse(post[1][2]["draft"])

    def test_tag_race_cannot_publish_a_release(self):
        api = FakeGitHub()
        def conflicting(method, path, payload=None):
            if method == "POST" and path.endswith("/git/refs"):
                raise release.GitHubError("gh: Reference already exists (HTTP 422)")
            return api(method, path, payload)
        with self.assertRaises(release.GitHubError):
            release.publish("example/atlas", SHA, "Notes", apply=True, api=conflicting)
        self.assertTrue(all(call[0] == "GET" for call in api.calls))

    def test_release_links_are_pinned_to_source_commit(self):
        api = FakeGitHub()
        release.publish("example/atlas", SHA, "[Operations](../OPERATIONS.md)", apply=True, api=api)
        self.assertIn(f"/blob/{SHA}/documentation/OPERATIONS.md", api.calls[-1][2]["body"])

    def test_existing_release_is_not_modified(self):
        api = FakeGitHub(existing=True)
        self.assertIn("already exists", release.publish("example/atlas", SHA, "Notes", apply=True, api=api))
        self.assertEqual(len(api.calls), 1)

    def test_stale_success_cannot_publish_new_main(self):
        api = FakeGitHub(head="b" * 40)
        self.assertIn("Skipped", release.publish("example/atlas", SHA, "Notes", apply=True, api=api))
        self.assertTrue(all(call[0] == "GET" for call in api.calls))

    def test_does_not_reuse_or_overwrite_orphaned_tag(self):
        with self.assertRaisesRegex(RuntimeError, "tag already exists"):
            release.publish("example/atlas", SHA, "Notes", apply=True, api=FakeGitHub(tag=True))

    def test_permission_error_is_not_treated_as_missing_release(self):
        def denied(*args):
            raise release.GitHubError("gh: Resource not accessible (HTTP 403)")
        with self.assertRaises(release.GitHubError):
            release.publish("example/atlas", SHA, "Notes", apply=True, api=denied)


if __name__ == "__main__":
    unittest.main()
