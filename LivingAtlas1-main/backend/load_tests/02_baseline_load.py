"""Stepped local mixed API workload with response and database checks."""

import argparse
import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from common import cleanup_signups, report, require_local_target, signup_rows, summary, timed_request


READ_PATHS = (
    "/allCards",
    "/getMarkers",
    "/searchBar?titleSearch=loadtest_missing",
    "/arcgis/services?state=WA",
)


def virtual_user(level, user_id, operations, prefix):
    samples = []
    for index in range(operations):
        if index % 10 == 0:
            email = f"{prefix}_{level}_{user_id}_{index}@example.invalid"
            result = timed_request("POST", "/uploadSignup", data={
                "username": f"load_{level}_{user_id}_{index}",
                "email": email,
                "password": "LocalTestOnly123!",
                "desired_access_level": "regular",
            })
            result["ok"] = result["ok"] and result.get("body", {}).get("success") is True
            name = "signup"
        else:
            path = READ_PATHS[(index - 1) % len(READ_PATHS)]
            result = timed_request("GET", path)
            body = result.get("body")
            result["ok"] = result["ok"] and (
                isinstance(body, list) if path.startswith("/arcgis/")
                else isinstance(body, dict) and isinstance(body.get("data"), list)
            )
            name = path.split("?")[0]
        result["endpoint"] = name
        samples.append(result)
    return samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", default="5,10,20", help="Comma-separated concurrent user levels")
    parser.add_argument("--operations", type=int, default=20, help="Requests per virtual user at each level")
    args = parser.parse_args()
    levels = [int(value) for value in args.users.split(",")]
    if not levels or any(value < 1 or value > 100 for value in levels) or not 1 <= args.operations <= 100:
        parser.error("Use 1-100 users per level and 1-100 operations per user")
    require_local_target()
    prefix = f"load02_{uuid.uuid4().hex[:10]}"
    expected_signups = 0
    results = []
    try:
        for level in levels:
            started = time.perf_counter()
            with ThreadPoolExecutor(max_workers=level) as pool:
                groups = list(pool.map(lambda user: virtual_user(level, user, args.operations, prefix), range(level)))
            elapsed = time.perf_counter() - started
            samples = [item for group in groups for item in group]
            expected_signups += level * len(range(0, args.operations, 10))
            counts = signup_rows(prefix)
            by_endpoint = defaultdict(list)
            for item in samples:
                by_endpoint[item["endpoint"]].append(item)
            result = {
                "users": level,
                "elapsed_s": round(elapsed, 2),
                "requests_per_s": round(len(samples) / elapsed, 1),
                "overall": summary(samples),
                "endpoints": {name: summary(items) for name, items in by_endpoint.items()},
                "expected_signup_rows": expected_signups,
                "actual_signup_rows": len(counts),
                "sample_errors": [item.get("body") or item.get("error") for item in samples if not item["ok"]][:3],
            }
            result["passed"] = result["overall"]["errors"] == 0 and len(counts) == expected_signups
            results.append(result)
            report("baseline_load", result)
            if not result["passed"]:
                break
        if not all(item["passed"] for item in results):
            raise SystemExit(1)
    finally:
        removed = cleanup_signups(prefix)
        remaining = signup_rows(prefix)
        print(f"Cleaned {removed} test signup rows; remaining={len(remaining)}")
        if remaining:
            raise RuntimeError("Test signups remain after cleanup")


if __name__ == "__main__":
    main()
