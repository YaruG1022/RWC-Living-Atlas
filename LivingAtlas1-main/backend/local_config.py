"""Load and validate isolated local test database settings."""

import os
from pathlib import Path

from dotenv import load_dotenv


ENV_FILE = Path(__file__).with_name(".env.local")


def load_local_config():
    load_dotenv(ENV_FILE, override=False)
    if os.getenv("LOCAL_TEST_MODE") != "1":
        return

    if os.getenv("DATABASE_URL"):
        raise RuntimeError("Unset DATABASE_URL when using LOCAL_TEST_MODE")

    if os.getenv("DB_HOST") not in {"localhost", "127.0.0.1", "::1"} or os.getenv("DB_NAME") != "livingatlas_test":
        raise RuntimeError(
            "LOCAL_TEST_MODE requires a loopback PostgreSQL host and the livingatlas_test database"
        )

    if not os.getenv("DB_PASSWORD") or os.getenv("DB_PASSWORD") == "replace-with-local-password":
        raise RuntimeError("Set DB_PASSWORD in backend/.env.local")
