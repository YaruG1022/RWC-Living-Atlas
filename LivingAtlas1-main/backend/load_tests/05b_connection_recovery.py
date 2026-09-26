"""Terminate only tagged local backend DB sessions and verify recovery."""

import time
import uuid

from common import cleanup_signups, db_connect, report, require_local_target, signup_rows, timed_request


def backend_pids():
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pid FROM pg_stat_activity "
                "WHERE datname = 'livingatlas_test' AND application_name = 'livingatlas_backend' "
                "AND pid <> pg_backend_pid()"
            )
            return [row[0] for row in cur.fetchall()]


def terminate_backend_sessions(pids):
    with db_connect() as conn:
        with conn.cursor() as cur:
            for pid in pids:
                cur.execute("SELECT pg_terminate_backend(%s)", (pid,))
                if not cur.fetchone()[0]:
                    raise RuntimeError(f"Could not terminate tagged backend DB session {pid}")


def main():
    require_local_target()
    pids = backend_pids()
    if not pids:
        raise RuntimeError("No tagged local backend connections found; restart local backend with current database.py")
    terminate_backend_sessions(pids)
    report("connection_drop", {"terminated_backend_sessions": len(pids)})

    reads = []
    for attempt in range(12):
        result = timed_request("GET", "/allCards")
        body = result.get("body")
        reads.append({"attempt": attempt + 1, "status": result["status"],
                      "ok": result["ok"] and isinstance(body, dict) and isinstance(body.get("data"), list)})
        time.sleep(0.2)

    endpoint_checks = []
    for path in ("/allCards", "/getMarkers", "/searchBar?titleSearch=loadtest_missing", "/arcgis/services?state=WA"):
        result = timed_request("GET", path)
        body = result.get("body")
        valid = isinstance(body, list) if path.startswith("/arcgis/") else isinstance(body, dict) and isinstance(body.get("data"), list)
        endpoint_checks.append({"path": path.split("?")[0], "status": result["status"], "ok": result["ok"] and valid})

    prefix = f"load05_recovery_{uuid.uuid4().hex[:10]}"
    try:
        signups = []
        for attempt in range(4):
            result = timed_request("POST", "/uploadSignup", data={
                "username": f"recovery_{attempt}",
                "email": f"{prefix}_{attempt}@example.invalid",
                "password": "LocalTestOnly123!",
                "desired_access_level": "regular",
            })
            signups.append({"status": result["status"], "ok": result["ok"] and result.get("body", {}).get("success") is True,
                            "detail": str(result.get("body") or result.get("error"))[:160]})
            time.sleep(0.2)

        stored = len(signup_rows(prefix))
        passed = (all(item["ok"] for item in reads)
                  and all(item["ok"] for item in endpoint_checks)
                  and all(item["ok"] for item in signups) and stored == 4)
        report("connection_recovery", {"passed": passed, "read_attempts": reads,
                                       "endpoint_checks": endpoint_checks,
                                       "signup_attempts": signups, "stored_signup_rows": stored,
                                       "restored_backend_sessions": len(backend_pids())})
        if not passed:
            raise SystemExit(1)
    finally:
        removed = cleanup_signups(prefix)
        remaining = signup_rows(prefix)
        print(f"Cleaned {removed} recovery signup rows; remaining={len(remaining)}")
        if remaining:
            raise RuntimeError("Recovery test signups remain after cleanup")


if __name__ == "__main__":
    main()
