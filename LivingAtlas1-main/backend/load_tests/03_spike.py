"""Abrupt local traffic spike followed by a recovery phase."""

import argparse
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from common import cleanup_signups, report, require_local_target, signup_rows, summary, timed_request


READ_PATHS = (
    "/allCards",
    "/getMarkers",
    "/searchBar?titleSearch=loadtest_missing",
    "/arcgis/services?state=WA",
)


def run_phase(name, users, operations, prefix):
    gate = threading.Barrier(users)

    def virtual_user(user):
        gate.wait(timeout=10)
        samples = []
        for index in range(operations):
            if index == 0:
                path = "/uploadSignup"
                result = timed_request("POST", "/uploadSignup", data={
                    "username": f"spike_{name}_{user}",
                    "email": f"{prefix}_{name}_{user}@example.invalid",
                    "password": "LocalTestOnly123!",
                    "desired_access_level": "regular",
                })
                result["ok"] = result["ok"] and result.get("body", {}).get("success") is True
            else:
                path = READ_PATHS[(index - 1) % len(READ_PATHS)]
                result = timed_request("GET", path)
                body = result.get("body")
                result["ok"] = result["ok"] and (
                    isinstance(body, list) if path.startswith("/arcgis/")
                    else isinstance(body, dict) and isinstance(body.get("data"), list)
                )
            result["path"] = path.split("?")[0]
            samples.append(result)
        return samples

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=users) as pool:
        groups = list(pool.map(virtual_user, range(users)))
    elapsed = time.perf_counter() - started
    samples = [item for group in groups for item in group]
    return {
        "phase": name,
        "users": users,
        "elapsed_s": round(elapsed, 2),
        "requests_per_s": round(len(samples) / elapsed, 1),
        "metrics": summary(samples),
        "sample_errors": [{"path": item["path"], "status": item["status"],
                           "detail": item.get("body") or item.get("error")}
                          for item in samples if not item["ok"]][:3],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-users", type=int, default=5)
    parser.add_argument("--spike-users", type=int, default=50)
    parser.add_argument("--operations", type=int, default=10)
    args = parser.parse_args()
    if not 1 <= args.base_users <= 20 or not 2 <= args.spike_users <= 100 or not 2 <= args.operations <= 50:
        parser.error("Use 1-20 base users, 2-100 spike users, and 2-50 operations")

    require_local_target()
    prefix = f"load03_{uuid.uuid4().hex[:10]}"
    results = []
    try:
        for name, users in (("warmup", args.base_users), ("spike", args.spike_users), ("recovery", args.base_users)):
            result = run_phase(name, users, args.operations, prefix)
            results.append(result)
            report("spike", result)
        expected_rows = args.base_users * 2 + args.spike_users
        actual_rows = len(signup_rows(prefix))
        passed = all(result["metrics"]["errors"] == 0 for result in results) and actual_rows == expected_rows
        report("spike_verdict", {"passed": passed, "expected_signup_rows": expected_rows, "actual_signup_rows": actual_rows})
        if not passed:
            raise SystemExit(1)
    finally:
        removed = cleanup_signups(prefix)
        remaining = signup_rows(prefix)
        print(f"Cleaned {removed} test signup rows; remaining={len(remaining)}")
        if remaining:
            raise RuntimeError("Test signups remain after cleanup")


if __name__ == "__main__":
    main()
