import copy
import os
from datetime import date
from pathlib import Path
import random
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

import numpy as np
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Imports initialize an engine, but every database operation in these tests
# uses a test double. Neither a real database nor the application lifespan runs.
with patch.dict(os.environ, {
    "DATABASE_URL": "postgresql+psycopg://test:test@localhost/test",
    "FRONTEND_URL": "http://testserver",
    "INTERNAL_API_SECRET": "unit-test-secret",
}):
    import api_server_pg
    from helpers import (
        get_preference_categories,
        media_to_api_item,
        normalize_preferred_genres,
    )
    from models import Media
    import recommender


class PreferenceCategoryTests(unittest.TestCase):
    def test_anime_keeps_content_genres_without_other_animation(self):
        genres = ["Animation", "Action", "Fantasy"]
        self.assertEqual(
            get_preference_categories(genres, True),
            ["Action", "Anime", "Fantasy"],
        )
        self.assertEqual(genres, ["Animation", "Action", "Fantasy"])

    def test_other_animation_is_separate_from_anime(self):
        self.assertEqual(
            get_preference_categories(["Animation", "Comedy", "Family"], False),
            ["Comedy", "Family", "Other Animation"],
        )

    def test_live_action_does_not_gain_animation_categories(self):
        self.assertEqual(
            get_preference_categories(["Horror", "Mystery"], False),
            ["Horror", "Mystery"],
        )

    def test_flag_is_the_source_of_truth_for_anime(self):
        self.assertEqual(get_preference_categories([], True), ["Anime"])
        self.assertEqual(get_preference_categories(["Anime", "Drama"], False), ["Drama"])

    def test_categories_are_deduplicated_and_idempotent(self):
        result = get_preference_categories([" Animation ", "Comedy", "Comedy", ""], False)
        self.assertEqual(result, ["Comedy", "Other Animation"])
        self.assertEqual(get_preference_categories(result, False), result)

    def test_legacy_animation_expands_to_both_preferences(self):
        original = ["Animation", "Comedy", "Anime"]
        self.assertEqual(
            normalize_preferred_genres(original),
            ["Anime", "Comedy", "Other Animation"],
        )
        self.assertEqual(original, ["Animation", "Comedy", "Anime"])

    def test_explicit_other_animation_stays_narrow(self):
        self.assertEqual(
            normalize_preferred_genres([" Other Animation ", "Other Animation"]),
            ["Other Animation"],
        )
        self.assertEqual(normalize_preferred_genres([]), [])


class RecommenderCategoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = [
            SimpleNamespace(id=10, genres=["Animation", "Action & Adventure"],
                            keywords=["hero", "rescue"], overview="A brave hero rescues a friend.",
                            is_anime=True, vote_average=8.0, vote_count=100,
                            release_date=date(2020, 1, 1)),
            SimpleNamespace(id=20, genres=["Animation", "Drama"],
                            keywords=["school"], overview="Students face a difficult school year.",
                            is_anime=True, vote_average=8.0, vote_count=100,
                            release_date=date(2020, 1, 1)),
            SimpleNamespace(id=30, genres=["Animation", "Comedy", "Family"],
                            keywords=["family"], overview="A family shares a funny summer holiday.",
                            is_anime=False, vote_average=8.0, vote_count=100,
                            release_date=date(2020, 1, 1)),
            SimpleNamespace(id=40, genres=["Crime", "Mystery"],
                            keywords=["detective"], overview="A detective investigates a mysterious crime.",
                            is_anime=False, vote_average=8.0, vote_count=100,
                            release_date=date(2020, 1, 1)),
        ]
        original = copy.deepcopy([row.genres for row in cls.rows])
        db = MagicMock()
        db.execute.return_value.all.return_value = cls.rows
        cls.index = recommender.build_recommender_index(db)
        assert original == [row.genres for row in cls.rows]

    def test_index_has_distinct_category_columns(self):
        classes = set(self.index["genre_encoder"].classes_)
        self.assertIn("Anime", classes)
        self.assertIn("Other Animation", classes)
        self.assertNotIn("Animation", classes)
        self.assertIn("Action", classes)
        self.assertIn("Adventure", classes)

    def test_original_context_signals_are_preserved(self):
        classes = set(self.index["context_encoder"].classes_)
        self.assertIn("anime:Animation", classes)
        self.assertIn("other:Animation", classes)
        self.assertNotIn("anime:Anime", classes)
        self.assertNotIn("other:Other Animation", classes)

    def test_other_animation_onboarding_matches_only_other_animation(self):
        scores = recommender.get_genre_scores(["Other Animation"], self.index)
        self.assertEqual(scores[0], 0)
        self.assertEqual(scores[1], 0)
        self.assertGreater(scores[2], 0)
        self.assertEqual(scores[3], 0)
        rows = recommender.select_recommendation_rows(
            scores, scores, self.index, set(), set(), set(), 3,
            rng=random.Random(4),
        )
        self.assertEqual([self.index["media_ids"][row] for row in rows], [30])

    def test_anime_onboarding_matches_only_anime(self):
        scores = recommender.get_genre_scores(["Anime"], self.index)
        self.assertGreater(scores[0], 0)
        self.assertGreater(scores[1], 0)
        self.assertEqual(scores[2], 0)
        self.assertEqual(scores[3], 0)

    def test_legacy_animation_matches_explicit_both(self):
        legacy = recommender.get_genre_scores(["Animation"], self.index)
        explicit = recommender.get_genre_scores(["Anime", "Other Animation"], self.index)
        np.testing.assert_allclose(legacy, explicit)
        self.assertTrue(np.all(legacy[:3] > 0))
        self.assertEqual(legacy[3], 0)

    def test_learned_genre_profile_uses_the_new_categories(self):
        scores = recommender.get_content_scores({30}, self.index, {"genre_matrix": 1.0})
        self.assertEqual(scores[0], 0)
        self.assertEqual(scores[1], 0)
        self.assertAlmostEqual(scores[2], 1.0)

    def test_queued_anime_is_excluded_from_selection(self):
        scores = recommender.get_genre_scores(["Anime"], self.index)
        rows = recommender.select_recommendation_rows(
            scores, scores, self.index, {10}, {10}, set(), 3,
            rng=random.Random(4),
        )
        self.assertEqual([self.index["media_ids"][row] for row in rows], [20])


class PreferenceApiTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.user = SimpleNamespace(
            preferred_genres=["Animation", "Comedy"],
            genre_onboarding_completed=True,
        )
        self.db.get.return_value = self.user
        self.previous_overrides = dict(api_server_pg.api.dependency_overrides)
        api_server_pg.api.dependency_overrides[api_server_pg.get_db] = lambda: self.db
        self.secret_patch = patch.object(api_server_pg, "INTERNAL_API_SECRET", "unit-test-secret")
        self.secret_patch.start()
        self.client = TestClient(api_server_pg.api)
        self.headers = {"backend-internal-secret": "unit-test-secret"}

    def tearDown(self):
        self.client.close()
        self.secret_patch.stop()
        api_server_pg.api.dependency_overrides = self.previous_overrides

    def test_get_expands_old_preferences_without_writing(self):
        response = self.client.get("/api/onboarding/1", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "preferred_genres": ["Anime", "Comedy", "Other Animation"],
            "onboarding_completed": True,
        })
        self.assertEqual(self.user.preferred_genres, ["Animation", "Comedy"])
        self.db.commit.assert_not_called()

    def test_post_saves_explicit_preferences(self):
        response = self.client.post("/api/onboarding/1", json=["Other Animation"], headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.preferred_genres, ["Other Animation"])
        self.db.commit.assert_called_once()

    def test_old_clients_can_still_post_animation(self):
        response = self.client.post("/api/onboarding/1", json=["Animation"], headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.preferred_genres, ["Anime", "Other Animation"])

    def test_skip_stays_an_empty_preference_list(self):
        response = self.client.post("/api/onboarding/1", json=[], headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.preferred_genres, [])
        self.assertTrue(self.user.genre_onboarding_completed)

    def test_stats_separates_anime_and_other_animation(self):
        self.db.execute.return_value.all.return_value = [
            SimpleNamespace(genres=["Animation", "Action"], is_anime=True),
            SimpleNamespace(genres=["Animation", "Drama"], is_anime=True),
            SimpleNamespace(genres=["Animation", "Comedy", "Comedy"], is_anime=False),
            SimpleNamespace(genres=["Crime"], is_anime=False),
        ]
        response = self.client.get("/api/stats/genres/1", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "Anime": 2, "Other Animation": 1,
            "Action": 1, "Drama": 1, "Comedy": 1, "Crime": 1,
        })
        statement = self.db.execute.call_args.args[0]
        self.assertEqual([column.name for column in statement.selected_columns], ["genres", "is_anime"])
        parameters = statement.compile().params.values()
        self.assertIn(1, parameters)
        self.assertIn("like", parameters)
        self.db.commit.assert_not_called()

    def test_stats_still_requires_the_internal_secret(self):
        response = self.client.get("/api/stats/genres/1")
        self.assertEqual(response.status_code, 401)

    def test_missing_user_is_not_created_by_onboarding(self):
        self.db.get.return_value = None
        response = self.client.post("/api/onboarding/1", json=["Anime"], headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.db.commit.assert_not_called()


class MediaResponseTests(unittest.TestCase):
    def test_display_labels_preserve_raw_metadata_and_tv_identity(self):
        media = Media(
            id=1, tmdb_id=100, media_type="tv", is_anime=True,
            title="Test anime", overview="A test overview.",
            genres=["Animation", "Drama"], genre_ids=[16, 18],
            thumbnail_url="https://example.com/poster.jpg",
            release_date=date(2020, 1, 1), vote_average=8.0,
            primary_streaming_service="",
        )
        item = media_to_api_item(media)
        self.assertEqual(item.genres, ["Anime", "Drama"])
        self.assertEqual(item.media_type, "tv")
        self.assertTrue(item.is_anime)
        self.assertEqual(media.genres, ["Animation", "Drama"])
        self.assertEqual(media.genre_ids, [16, 18])


if __name__ == "__main__":
    unittest.main()
