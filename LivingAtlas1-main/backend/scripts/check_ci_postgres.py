"""Exercise real API/database contracts against a disposable, empty local database.

Run with the environment in .github/workflows/ci.yml. This refuses a populated
database, DATABASE_URL, remote hosts and databases other than livingatlas_test.
It never sends email or uploads to Azure. Synthetic fixtures remain until the
disposable database is removed; do not run against a developer's populated DB.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import httpx
import psycopg2


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def initialize_empty_database():
    if os.environ.get("CI_POSTGRES_TEST") != "1" or os.environ.get("LOCAL_TEST_MODE") != "1":
        raise RuntimeError("Set CI_POSTGRES_TEST=1 and LOCAL_TEST_MODE=1 for a disposable database")

    from local_config import load_local_config

    load_local_config()  # Rejects remote hosts, DATABASE_URL and non-test DB names.
    connection = psycopg2.connect(
        host=os.environ["DB_HOST"], port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ["DB_NAME"], user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"], sslmode="disable", connect_timeout=10,
    )
    try:
        with connection, connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
            if cursor.fetchone()[0]:
                raise RuntimeError("Refusing to initialize a populated database; use a fresh disposable instance")
            project = BACKEND.parent
            for path in (
                project / "database/database_schema/livingAtlasTables.sql",
                BACKEND / "scripts/local_test_schema.sql",
                project / "database/migrations/001_create_card_images_table.sql",
                project / "database/migrations/002_create_user_layer_selections.sql",
                BACKEND / "create_arcgis_services_table.sql",
            ):
                cursor.execute(path.read_text(encoding="utf-8"))
    finally:
        connection.close()


class PostgreSQLContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Fail unexpected outbound email/HTTP calls; API requests stay in-process.
        cls.external_http = patch("requests.sessions.Session.request", side_effect=AssertionError("External HTTP is forbidden in CI"))
        cls.external_http.start()
        cls.addClassCleanup(cls.external_http.stop)

        import database
        from main import app

        cls.database = database
        cls.app = app
        cls.addClassCleanup(cls.close_database)
        if database.conn is None:
            raise RuntimeError("Application did not connect to the isolated PostgreSQL service")
        with database.conn, database.conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO Users (UserID, Username, Email, HashedPassword, Salt)
                VALUES (1, 'ci_owner', 'ci_owner@example.invalid', 'fixture', %s)
            """, (b"fixture",))
            cursor.execute("INSERT INTO Categories (CategoryID, CategoryLabel) VALUES (1, 'CI fixture')")
            cursor.execute("""
                INSERT INTO Cards (CardID, UserID, Title, Latitude, Longitude, CategoryID, is_public)
                VALUES (1, 1, 'Public CI fixture', 46, -117, 1, TRUE),
                       (2, 1, 'Private CI fixture', 46, -117, 1, FALSE)
            """)

    @classmethod
    def close_database(cls):
        if cls.database._request_pool is not None:
            cls.database._request_pool.closeall()
        if cls.database.cur is not None:
            cls.database.cur.close()
        if cls.database.conn is not None:
            cls.database.conn.close()

    def request(self, method, path, **kwargs):
        async def send():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://testserver") as client:
                return await client.request(method, path, **kwargs)
        return asyncio.run(send())

    def signup(self, email):
        response = self.request("POST", "/uploadSignup", data={
            "username": "CI signup", "email": email, "password": "synthetic-ci-password",
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_database_reads_apply_visibility_and_include_migrated_fields(self):
        response = self.request("GET", "/allCards")
        self.assertEqual(response.status_code, 200, response.text)
        cards = response.json()["data"]
        self.assertEqual([card["title"] for card in cards], ["Public CI fixture"])
        self.assertEqual(cards[0]["gallery_layout"], "featured")
        self.assertEqual(cards[0]["polygon_vertices"], [])
        self.assertEqual(cards[0]["images"], [])

        response = self.request("GET", "/allCards", params={"viewer_email": "ci_owner@example.invalid"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()["data"]), 2)

    def test_parallel_signups_allocate_unique_ids_and_reject_duplicate_email(self):
        emails = [f"signup-{index}@example.invalid" for index in range(8)]
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(self.signup, emails))
        self.assertTrue(all(result["success"] for result in results), results)

        with ThreadPoolExecutor(max_workers=4) as executor:
            duplicates = list(executor.map(self.signup, ["duplicate@example.invalid"] * 4))
        self.assertEqual(sum(result["success"] for result in duplicates), 1, duplicates)
        self.assertTrue(all(result["message"] == "Email must be unique" for result in duplicates if not result["success"]))

        with self.database.conn, self.database.conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*), COUNT(DISTINCT SignupID), COUNT(DISTINCT Email) FROM SignupData")
            self.assertEqual(cursor.fetchone(), (9, 9, 9))

    def test_startup_schema_can_be_applied_again_without_losing_data(self):
        self.database._ensure_schema()
        response = self.request("GET", "/allCards")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()["data"]), 1)


if __name__ == "__main__":
    initialize_empty_database()
    unittest.main(verbosity=2)
