"""Measure card read/search behavior as local database volume grows."""

import argparse
import uuid

from psycopg2.extras import execute_values

from common import db_connect, report, require_local_target, summary, timed_request


def count_own_cards(user_id):
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM Cards WHERE UserID = %s", (user_id,))
            return cur.fetchone()[0]


def seed_user(prefix):
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(MAX(UserID), 0) + 1 FROM Users")
            user_id = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt, Is_Admin) "
                "VALUES (%s, %s, %s, %s, %s, FALSE)",
                (user_id, prefix, f"{prefix}@example.invalid", "local-test-only", b"0" * 32),
            )
        return user_id


def seed_cards(user_id, prefix, start, end):
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(MAX(CardID), 0) + 1 FROM Cards")
            next_id = cur.fetchone()[0]
            rows = [
                (next_id + offset, user_id, f"{prefix} card {index}",
                 46 + (index % 100) / 1000, -120 - (index % 100) / 1000,
                 4, f"Local volume test card {index}", prefix, True)
                for offset, index in enumerate(range(start, end))
            ]
            execute_values(cur, """
                INSERT INTO Cards (CardID, UserID, Title, Latitude, Longitude,
                                   CategoryID, Description, Name, is_public)
                VALUES %s
            """, rows, page_size=500)


def cleanup(user_id):
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM Cards WHERE UserID = %s", (user_id,))
            removed_cards = cur.rowcount
            cur.execute("DELETE FROM Users WHERE UserID = %s", (user_id,))
            removed_users = cur.rowcount
    return removed_cards, removed_users


def measured_reads(prefix, expected_all, expected_search, repeats):
    endpoints = (
        ("/allCards", expected_all),
        ("/getMarkers", expected_all),
        ("/searchBar", expected_search),
    )
    results = {}
    for path, expected in endpoints:
        samples = []
        for _ in range(repeats):
            kwargs = {"params": {"titleSearch": prefix}} if path == "/searchBar" else {}
            item = timed_request("GET", path, **kwargs)
            body = item.pop("body", None)
            actual = len(body["data"]) if isinstance(body, dict) and isinstance(body.get("data"), list) else None
            item["ok"] = item["ok"] and actual == expected
            item["actual_rows"] = actual
            samples.append(item)
        results[path] = {"metrics": summary(samples), "expected_rows": expected,
                         "observed_rows": sorted({item["actual_rows"] for item in samples if item["actual_rows"] is not None})}
    return results


def measured_pages(prefix, repeats):
    results = {}
    for path in ("/allCards", "/getMarkers", "/searchBar"):
        samples = []
        for _ in range(repeats):
            pages = []
            for offset in (0, 100):
                params = {"limit": 100, "offset": offset}
                if path == "/searchBar":
                    params["titleSearch"] = prefix
                item = timed_request("GET", path, params=params)
                body = item.pop("body", None)
                cards = body.get("data") if isinstance(body, dict) else None
                item["ok"] = item["ok"] and isinstance(cards, list) and len(cards) == 100
                samples.append(item)
                pages.append(cards or [])
            ids = [card["cardID"] for page in pages for card in page]
            if len(ids) != 200 or len(set(ids)) != 200:
                samples[-1]["ok"] = False
        results[path] = summary(samples)
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--levels", default="100,1000,5000")
    parser.add_argument("--repeats", type=int, default=5)
    args = parser.parse_args()
    levels = [int(value) for value in args.levels.split(",")]
    if not levels or levels != sorted(set(levels)) or any(value < 1 or value > 10000 for value in levels):
        parser.error("Use ascending unique levels from 1 to 10000")
    if not 1 <= args.repeats <= 20:
        parser.error("Use 1 to 20 read repetitions")

    require_local_target()
    prefix = f"load04_{uuid.uuid4().hex[:10]}"
    baseline_response = timed_request("GET", "/allCards")
    baseline = len(baseline_response["body"]["data"])
    user_id = seed_user(prefix)
    previous = 0
    passed = True
    try:
        for level in levels:
            seed_cards(user_id, prefix, previous, level)
            stored = count_own_cards(user_id)
            reads = measured_reads(prefix, baseline + level, level, args.repeats)
            pages = measured_pages(prefix, args.repeats) if level >= 1000 else None
            level_ok = (stored == level and all(item["metrics"]["errors"] == 0 for item in reads.values())
                        and (pages is None or all(item["errors"] == 0 for item in pages.values())))
            report("data_volume", {"cards": level, "stored_cards": stored, "passed": level_ok,
                                   "endpoints": reads, "paged_endpoints": pages})
            passed = passed and level_ok
            previous = level
            if not level_ok:
                break
    finally:
        removed_cards, removed_users = cleanup(user_id)
        remaining = count_own_cards(user_id)
        print(f"Cleaned {removed_cards} test cards and {removed_users} test user; remaining_cards={remaining}")
        if remaining:
            raise RuntimeError("Volume test cards remain after cleanup")
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
