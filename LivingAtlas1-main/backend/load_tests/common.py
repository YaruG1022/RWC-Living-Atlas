"""Safety checks and measurements shared by local integration/load tests."""

import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import psycopg2
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from local_config import load_local_config


API_BASE = os.getenv("TEST_API_BASE", "http://127.0.0.1:8000").rstrip("/")


def require_local_target():
    load_local_config()
    parsed = urlparse(API_BASE)
    if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("Load tests may target only a local HTTP backend")
    if os.getenv("LOCAL_TEST_MODE") != "1":
        raise RuntimeError("LOCAL_TEST_MODE=1 is required")
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database()")
            if cur.fetchone()[0] != "livingatlas_test":
                raise RuntimeError("Refusing to run outside livingatlas_test")
    response = requests.get(f"{API_BASE}/allCards", timeout=10)
    response.raise_for_status()
    if not isinstance(response.json().get("data"), list):
        raise RuntimeError("The local backend /allCards contract did not match")


def db_connect():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ.get("DB_PORT", "5433"),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode="disable",
        connect_timeout=5,
    )


def timed_request(method, path, **kwargs):
    started = time.perf_counter()
    try:
        response = requests.request(method, f"{API_BASE}{path}", timeout=15, **kwargs)
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else None
        return {
            "seconds": time.perf_counter() - started,
            "status": response.status_code,
            "ok": response.ok and (not isinstance(body, dict) or body.get("success") is not False),
            "body": body,
        }
    except (requests.RequestException, ValueError) as exc:
        return {"seconds": time.perf_counter() - started, "status": 0, "ok": False, "error": str(exc)}


def summary(results):
    durations = sorted(item["seconds"] for item in results)
    def percentile(p):
        return round(durations[min(len(durations) - 1, int((len(durations) - 1) * p))] * 1000, 1) if durations else 0
    return {
        "requests": len(results),
        "successes": sum(item["ok"] for item in results),
        "errors": sum(not item["ok"] for item in results),
        "p50_ms": percentile(0.50),
        "p95_ms": percentile(0.95),
        "p99_ms": percentile(0.99),
        "max_ms": round(max(durations) * 1000, 1) if durations else 0,
    }


def report(stage, payload):
    print(json.dumps({"stage": stage, **payload}, ensure_ascii=False, indent=2))


def cleanup_signups(prefix):
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM SignupData WHERE Email LIKE %s", (f"{prefix}%",))
            return cur.rowcount


def signup_rows(prefix):
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT SignupID, Email FROM SignupData WHERE Email LIKE %s ORDER BY SignupID",
                (f"{prefix}%",),
            )
            return cur.fetchall()
