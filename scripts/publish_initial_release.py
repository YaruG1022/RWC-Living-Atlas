#!/usr/bin/env python3
"""Publish the first source baseline only after its main-branch CI passes."""

import argparse
import json
from pathlib import Path
import re
import subprocess


TAG = "v0.1.0"
WORKFLOW = ".github/workflows/ci.yml"


class GitHubError(RuntimeError):
    def __init__(self, detail):
        super().__init__(detail)
        self.not_found = "HTTP 404" in detail


def github(method, endpoint, payload=None):
    command = ["gh", "api", "--method", method, endpoint]
    if payload is not None:
        command += ["--input", "-"]
    result = subprocess.run(
        command, input=json.dumps(payload) if payload is not None else None,
        capture_output=True, text=True, encoding="utf-8", check=False,
    )
    if result.returncode:
        raise GitHubError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else None


def optional_get(api, endpoint):
    try:
        return api("GET", endpoint)
    except GitHubError as error:
        if error.not_found:
            return None
        raise


def publish(repository, sha, notes, *, apply=False, api=github):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Use an owner/repository name")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Use the full tested commit SHA")
    base = f"repos/{repository}"
    existing = optional_get(api, f"{base}/releases/tags/{TAG}")
    if existing:
        if existing.get("draft"):
            raise RuntimeError("An existing draft must be reviewed and published separately")
        return f"{TAG} already exists: {existing['html_url']}"
    head = api("GET", f"{base}/git/ref/heads/main")["object"]["sha"]
    if head != sha:
        return "Skipped: the tested commit is no longer the head of main"
    runs = api("GET", f"{base}/actions/runs?head_sha={sha}&event=push&per_page=100")
    passed = any(
        run.get("path") == WORKFLOW
        and run.get("head_sha") == sha
        and run.get("head_branch") == "main"
        and run.get("event") == "push"
        and run.get("conclusion") == "success"
        for run in runs["workflow_runs"]
    )
    if not passed:
        raise RuntimeError("Engineering CI has not passed for this exact main commit")
    if optional_get(api, f"{base}/git/ref/tags/{TAG}"):
        raise RuntimeError("The version tag already exists without a release; review it first")
    if not notes.strip():
        raise ValueError("Release notes must not be empty")
    if not apply:
        return f"Ready to publish {TAG} for {sha}; rerun with --apply"
    # Creating a ref is atomic: fail on a conflicting tag rather than allowing
    # the releases endpoint to silently reuse a concurrently created version.
    api("POST", f"{base}/git/refs", {"ref": f"refs/tags/{TAG}", "sha": sha})
    for filename in ("OPERATIONS.md", "TEST_STRATEGY.md"):
        notes = notes.replace(
            f"(../{filename})",
            f"(https://github.com/{repository}/blob/{sha}/documentation/{filename})",
        )
    release = api("POST", f"{base}/releases", {
        "tag_name": TAG, "target_commitish": sha,
        "name": "v0.1.0 — Initial maintained baseline",
        "body": notes.rstrip() + f"\n\nSource commit: `{sha}`.\n",
        "draft": False, "prerelease": False, "make_latest": "true",
    })
    return f"Published: {release['html_url']}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    notes = Path(__file__).resolve().parents[1] / "documentation/releases/v0.1.0.md"
    print(publish(args.repository, args.sha, notes.read_text(encoding="utf-8"), apply=args.apply))


if __name__ == "__main__":
    main()
