"""Display-history API tests, with optional isolated PostgreSQL integration tests.

Set DISPLAY_TEST_DATABASE_URL to a local PostgreSQL URL to run the integration
cases. They create and remove their own randomly named schema.
"""
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

with patch.dict(os.environ, {
    "DATABASE_URL": "postgresql+psycopg://test:test@localhost/test",
    "FRONTEND_URL": "http://testserver",
    "INTERNAL_API_SECRET": "display-test-secret",
}):
    import api_server_pg
    from database import Base
    from helpers import get_recent_displays
    from models import LatestFeedback, Media, MediaDisplay, User, UserMediaFeedback


class DisplayValidationTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.db.get.return_value = SimpleNamespace(id=1)
        self.overrides = dict(api_server_pg.api.dependency_overrides)
        api_server_pg.api.dependency_overrides[api_server_pg.get_db] = lambda: self.db
        self.secret_patch = patch.object(
            api_server_pg, "INTERNAL_API_SECRET", "display-test-secret",
        )
        self.secret_patch.start()
        self.client = TestClient(api_server_pg.api)
        self.headers = {"backend-internal-secret": "display-test-secret"}
        self.payload = {"media_id": 10, "event_id": str(uuid4())}

    def tearDown(self):
        self.client.close()
        self.secret_patch.stop()
        api_server_pg.api.dependency_overrides = self.overrides

    def test_recording_and_history_require_the_internal_secret(self):
        for headers in ({}, {"backend-internal-secret": "wrong"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.client.post(
                    "/api/displays/1", json=self.payload, headers=headers,
                ).status_code, 401)
                self.assertEqual(self.client.get(
                    "/api/displays/1", headers=headers,
                ).status_code, 401)
        self.db.scalar.assert_not_called()

    def test_invalid_display_payloads_are_rejected(self):
        for payload in (
            {"media_id": 0, "event_id": str(uuid4())},
            {"media_id": -1, "event_id": str(uuid4())},
            {"media_id": 10, "event_id": "not-a-uuid"},
            {"media_id": 10},
        ):
            with self.subTest(payload=payload):
                response = self.client.post(
                    "/api/displays/1", json=payload, headers=self.headers,
                )
                self.assertEqual(response.status_code, 422)
        self.db.commit.assert_not_called()

    def test_history_limit_is_bounded(self):
        for limit in (0, 101):
            response = self.client.get(
                f"/api/displays/1?limit={limit}", headers=self.headers,
            )
            self.assertEqual(response.status_code, 422)

    def test_deleted_or_unknown_user_is_rejected(self):
        self.db.get.return_value = None
        self.assertEqual(self.client.post(
            "/api/displays/1", json=self.payload, headers=self.headers,
        ).status_code, 404)
        self.assertEqual(self.client.get(
            "/api/displays/1", headers=self.headers,
        ).status_code, 404)
        self.db.commit.assert_not_called()

    def test_unknown_media_is_rejected(self):
        self.db.get.side_effect = [SimpleNamespace(id=1), None]
        response = self.client.post(
            "/api/displays/1", json=self.payload, headers=self.headers,
        )
        self.assertEqual(response.status_code, 404)
        self.db.commit.assert_not_called()


@unittest.skipUnless(
    os.getenv("DISPLAY_TEST_DATABASE_URL"),
    "Set DISPLAY_TEST_DATABASE_URL to run isolated PostgreSQL tests",
)
class DisplayPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ["DISPLAY_TEST_DATABASE_URL"]
        cls.schema = f"display_history_test_{uuid4().hex}"
        cls.admin_engine = create_engine(url)
        with cls.admin_engine.begin() as connection:
            connection.execute(CreateSchema(cls.schema))

        cls.addClassCleanup(cls.clean_schema)
        cls.engine = create_engine(
            url,
            connect_args={"options": f"-csearch_path={cls.schema}"},
        )
        Base.metadata.create_all(cls.engine)

    @classmethod
    def clean_schema(cls):
        if hasattr(cls, "engine"):
            cls.engine.dispose()
        with cls.admin_engine.begin() as connection:
            connection.execute(DropSchema(cls.schema, cascade=True))
        cls.admin_engine.dispose()

    def setUp(self):
        with Session(self.engine) as db:
            db.execute(delete(User))
            db.execute(delete(Media))
            db.add_all([
                User(id=1, email="one@example.invalid", name="One", picture=""),
                User(id=2, email="two@example.invalid", name="Two", picture=""),
            ])
            for media_id in (10, 11):
                db.add(Media(
                    id=media_id,
                    tmdb_id=media_id,
                    media_type="movie",
                    is_anime=False,
                    title=f"Test movie {media_id}",
                    overview="A display-history test movie.",
                    genre_ids=[28],
                    genres=["Action"],
                    keywords=[],
                    thumbnail_url="https://example.invalid/poster.jpg",
                    release_date=date(2020, 1, 1),
                    vote_average=8.0,
                    vote_count=100,
                    adult=False,
                ))
            db.commit()

        def test_db():
            with Session(self.engine) as db:
                yield db

        self.overrides = dict(api_server_pg.api.dependency_overrides)
        api_server_pg.api.dependency_overrides[api_server_pg.get_db] = test_db
        self.secret_patch = patch.object(
            api_server_pg, "INTERNAL_API_SECRET", "display-test-secret",
        )
        self.secret_patch.start()
        self.client = TestClient(api_server_pg.api)
        self.headers = {"backend-internal-secret": "display-test-secret"}

    def tearDown(self):
        self.client.close()
        self.secret_patch.stop()
        api_server_pg.api.dependency_overrides = self.overrides

    def record(self, media_id=10, event_id=None, user_id=1):
        return self.client.post(
            f"/api/displays/{user_id}",
            json={"media_id": media_id, "event_id": str(event_id or uuid4())},
            headers=self.headers,
        )

    def history(self, user_id=1, limit=20):
        response = self.client.get(
            f"/api/displays/{user_id}?limit={limit}", headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_record_is_saved_with_a_server_timestamp(self):
        event_id = uuid4()
        response = self.record(event_id=event_id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        rows = self.history()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["media_id"], 10)
        self.assertEqual(rows[0]["event_id"], str(event_id))
        self.assertIsNotNone(datetime.fromisoformat(
            rows[0]["displayed_at"].replace("Z", "+00:00"),
        ).tzinfo)

    def test_retry_does_not_duplicate_or_refresh_the_event(self):
        event_id = uuid4()
        self.assertEqual(self.record(event_id=event_id).status_code, 200)
        before = self.history()
        for _ in range(3):
            self.assertEqual(self.record(event_id=event_id).status_code, 200)
        self.assertEqual(self.history(), before)

    def test_redisplaying_the_same_title_records_a_new_event(self):
        self.assertEqual(self.record().status_code, 200)
        self.assertEqual(self.record().status_code, 200)
        rows = self.history()
        self.assertEqual([row["media_id"] for row in rows], [10, 10])
        self.assertNotEqual(rows[0]["event_id"], rows[1]["event_id"])

    def test_event_id_cannot_be_reassigned_to_a_different_title(self):
        event_id = uuid4()
        self.record(event_id=event_id)
        response = self.record(media_id=11, event_id=event_id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual([row["media_id"] for row in self.history()], [10])

    def test_history_and_event_ids_are_scoped_to_the_user(self):
        event_id = uuid4()
        self.assertEqual(self.record(event_id=event_id).status_code, 200)
        self.assertEqual(self.record(
            media_id=11, event_id=event_id, user_id=2,
        ).status_code, 200)
        self.assertEqual([row["media_id"] for row in self.history(1)], [10])
        self.assertEqual([row["media_id"] for row in self.history(2)], [11])

    def test_latest_twenty_are_ordered_with_a_stable_tie_breaker(self):
        origin = datetime(2026, 1, 1, tzinfo=timezone.utc)
        event_ids = [uuid4() for _ in range(25)]
        with Session(self.engine) as db:
            for position, event_id in enumerate(event_ids):
                db.add(MediaDisplay(
                    user_id=1,
                    media_id=10,
                    event_id=event_id,
                    displayed_at=origin + timedelta(minutes=position // 2),
                ))
            db.commit()
            recent = get_recent_displays(1, db)
            self.assertEqual(
                [row.event_id for row in recent], list(reversed(event_ids[-20:])),
            )

        self.assertEqual(
            [row["event_id"] for row in self.history()],
            [str(event_id) for event_id in reversed(event_ids[-20:])],
        )
        self.assertEqual(len(self.history(limit=5)), 5)
        self.assertEqual(self.history(user_id=2), [])
        # The read limit does not prune historical records.
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(MediaDisplay)), 25)

    def test_empty_history_is_an_empty_list(self):
        self.assertEqual(self.history(), [])

    def test_account_deletion_cascades_only_its_own_history(self):
        self.record()
        self.record(user_id=2)
        with Session(self.engine) as db:
            db.delete(db.get(User, 1))
            db.commit()
            rows = db.scalars(select(MediaDisplay)).all()
            self.assertEqual([row.user_id for row in rows], [2])

    def test_media_deletion_removes_its_display_history(self):
        self.record()
        self.record(media_id=11)
        with Session(self.engine) as db:
            db.delete(db.get(Media, 10))
            db.commit()
        self.assertEqual([row["media_id"] for row in self.history()], [11])

    def test_simultaneous_retries_create_exactly_one_event(self):
        event_id = uuid4()
        with ThreadPoolExecutor(max_workers=6) as pool:
            responses = list(pool.map(
                lambda _: self.record(event_id=event_id), range(6),
            ))
        self.assertEqual([response.status_code for response in responses], [200] * 6)
        self.assertEqual(len(self.history()), 1)

    def test_display_tracking_does_not_change_feedback(self):
        self.record()
        with Session(self.engine) as db:
            for model in (UserMediaFeedback, LatestFeedback):
                self.assertEqual(db.scalar(select(func.count()).select_from(model)), 0)


if __name__ == "__main__":
    unittest.main()
