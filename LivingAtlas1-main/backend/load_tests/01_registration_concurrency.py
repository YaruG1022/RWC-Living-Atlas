"""Concurrent registration correctness: unique emails, IDs, and write counts."""

import argparse
import uuid
from concurrent.futures import ThreadPoolExecutor

from common import cleanup_signups, report, require_local_target, signup_rows, summary, timed_request


def register(email, index):
    return timed_request(
        "POST", "/uploadSignup",
        data={
            "username": f"load_user_{index}",
            "email": email,
            "password": "LocalTestOnly123!",
            "desired_access_level": "regular",
        },
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--distinct", type=int, default=20)
    parser.add_argument("--duplicates", type=int, default=10)
    args = parser.parse_args()
    if args.distinct < 2 or args.duplicates < 2:
        parser.error("Both request counts must be at least 2")
    require_local_target()
    prefix = f"load01_{uuid.uuid4().hex[:10]}"
    try:
        with ThreadPoolExecutor(max_workers=max(args.distinct, args.duplicates)) as pool:
            distinct = list(pool.map(lambda i: register(f"{prefix}_{i}@example.invalid", i), range(args.distinct)))
        rows_after_distinct = signup_rows(prefix)

        duplicate_email = f"{prefix}_duplicate@example.invalid"
        with ThreadPoolExecutor(max_workers=args.duplicates) as pool:
            duplicates = list(pool.map(lambda i: register(duplicate_email, i + args.distinct), range(args.duplicates)))
        rows = signup_rows(prefix)
        distinct_ids = len({row[0] for row in rows}) == len(rows)
        duplicate_rows = sum(row[1] == duplicate_email for row in rows)
        distinct_ok = sum(item["ok"] for item in distinct)
        duplicate_ok = sum(item["ok"] for item in duplicates)
        rejected_expected = sum(
            item["status"] == 200
            and item.get("body") == {"success": False, "message": "Email must be unique"}
            for item in duplicates
        )
        unexpected = [item for item in duplicates if not item["ok"] and not (
            item["status"] == 200
            and item.get("body") == {"success": False, "message": "Email must be unique"}
        )]
        passed = (distinct_ok == args.distinct and len(rows_after_distinct) == args.distinct
                  and duplicate_ok == 1 and rejected_expected == args.duplicates - 1
                  and duplicate_rows == 1 and distinct_ids)
        report("registration_concurrency", {
            "passed": passed,
            "distinct": summary(distinct),
            "rows_after_distinct": len(rows_after_distinct),
            "duplicate_attempts": args.duplicates,
            "duplicate_accepted": duplicate_ok,
            "duplicate_rejected_expected": rejected_expected,
            "duplicate_unexpected_failures": len(unexpected),
            "duplicate_p95_ms": summary(duplicates)["p95_ms"],
            "duplicate_rows": duplicate_rows,
            "unique_ids": distinct_ids,
            "sample_unexpected_errors": [item.get("body") or item.get("error") for item in distinct if not item["ok"]][:2]
            + [item.get("body") or item.get("error") for item in unexpected][:2],
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
