"""Bounded local mixed-traffic soak test with database row reconciliation."""

import argparse
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from common import cleanup_signups, db_connect, report, require_local_target, signup_rows, summary, timed_request


READ_PATHS = (
    "/allCards",
    "/getMarkers",
    "/searchBar?titleSearch=loadtest_missing",
    "/arcgis/services?state=WA",
)


def backend_connections():
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM pg_stat_activity "
                "WHERE datname = 'livingatlas_test' AND application_name = 'livingatlas_backend'"
            )
            return cur.fetchone()[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=300, help="Seconds, 30-600")
    parser.add_argument("--users", type=int, default=5)
    parser.add_argument("--interval", type=float, default=0.5, help="Seconds between each user's requests")
    args = parser.parse_args()
    if not 30 <= args.duration <= 600 or not 1 <= args.users <= 20 or not 0.1 <= args.interval <= 5:
        parser.error("Use 30-600 seconds, 1-20 users and a 0.1-5 second interval")

    require_local_target()
    prefix = f"load05_{uuid.uuid4().hex[:10]}"
    deadline = time.monotonic() + args.duration
    lock = threading.Lock()
    samples = []
    errors = []

    def virtual_user(user):
        index = 0
        while time.monotonic() < deadline:
            if index % 20 == 0:
                result = timed_request("POST", "/uploadSignup", data={
                    "username": f"soak_{user}_{index}",
                    "email": f"{prefix}_{user}_{index}@example.invalid",
                    "password": "LocalTestOnly123!",
                    "desired_access_level": "regular",
                })
                result["ok"] = result["ok"] and result.get("body", {}).get("success") is True
                result["endpoint"] = "signup"
            else:
                path = READ_PATHS[(index - 1) % len(READ_PATHS)]
                result = timed_request("GET", path)
                body = result.get("body")
                result["ok"] = result["ok"] and (
                    isinstance(body, list) if path.startswith("/arcgis/")
                    else isinstance(body, dict) and isinstance(body.get("data"), list)
                )
                result["endpoint"] = path.split("?")[0]
            detail = result.pop("body", None) or result.get("error")
            with lock:
                samples.append(result)
                if not result["ok"] and len(errors) < 10:
                    errors.append({"endpoint": result["endpoint"], "detail": str(detail)[:200]})
            index += 1
            time.sleep(args.interval)

    try:
        with ThreadPoolExecutor(max_workers=args.users) as pool:
            futures = [pool.submit(virtual_user, user) for user in range(args.users)]
            while time.monotonic() < deadline:
                time.sleep(min(60, max(0.1, deadline - time.monotonic())))
                with lock:
                    progress = {"elapsed_s": args.duration - max(0, round(deadline - time.monotonic())),
                                "requests": len(samples), "errors": sum(not item["ok"] for item in samples)}
                progress["backend_db_connections"] = backend_connections()
                report("soak_progress", progress)
            for future in futures:
                future.result()

        expected_rows = sum(item["endpoint"] == "signup" and item["ok"] for item in samples)
        actual_rows = len(signup_rows(prefix))
        passed = all(item["ok"] for item in samples) and actual_rows == expected_rows
        report("soak_verdict", {
            "passed": passed,
            "duration_s": args.duration,
            "users": args.users,
            "metrics": summary(samples),
            "expected_signup_rows": expected_rows,
            "actual_signup_rows": actual_rows,
            "sample_errors": errors,
        })
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
