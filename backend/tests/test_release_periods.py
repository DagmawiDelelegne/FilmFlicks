import os
from datetime import date
from pathlib import Path
import random
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Importing the models creates an engine but these tests do not connect to it.
with patch.dict(os.environ, {
    "DATABASE_URL": "postgresql+psycopg://test:test@localhost/test",
}):
    import recommender


def make_index(release_dates):
    matrix, periods = recommender.build_release_period_matrix(release_dates)
    return {
        "media_ids": list(range(len(release_dates))),
        "row_by_id": {i: i for i in range(len(release_dates))},
        "release_period_matrix": matrix,
        "release_periods": periods,
    }


class ReleasePeriodMatrixTests(unittest.TestCase):
    def test_usable_dates_contribute_one_unit_each(self):
        index = make_index([
            date(1980, 1, 1), date(2009, 12, 31), date(2021, 1, 1),
            None, date.max,
        ])
        matrix = index["release_period_matrix"]
        np.testing.assert_allclose(matrix.sum(axis=1), [1, 1, 1, 0, 0])
        self.assertTrue(np.all(matrix >= 0))

    def test_crossing_a_decade_boundary_is_a_small_change(self):
        matrix = make_index([
            date(2009, 12, 31), date(2010, 1, 1), date(2020, 1, 1),
        ])["release_period_matrix"]
        near_distance = np.abs(matrix[0] - matrix[1]).sum()
        far_distance = np.abs(matrix[1] - matrix[2]).sum()
        self.assertLess(near_distance, 0.21)
        self.assertLess(near_distance, far_distance)

    def test_no_dates_produce_an_empty_feature_matrix(self):
        for dates in ([], [None, date.max]):
            with self.subTest(dates=dates):
                matrix, periods = recommender.build_release_period_matrix(dates)
                self.assertEqual(matrix.shape, (len(dates), 0))
                self.assertEqual(len(periods), 0)


class ReleasePreferenceTests(unittest.TestCase):
    def setUp(self):
        self.index = make_index([
            date(1980, 1, 1), date(1981, 1, 1), date(2000, 1, 1),
            date(2020, 1, 1), date(2021, 1, 1), None, date.max,
        ])

    def scores(self, likes, dislikes, index=None):
        return recommender.get_release_period_scores(
            set(likes), set(dislikes), self.index if index is None else index,
        )

    def test_recent_preferences_favor_recent_candidates(self):
        scores = self.scores({3, 4}, {0, 1})
        self.assertGreater(scores[3], 0)
        self.assertLess(scores[0], 0)

    def test_older_preferences_favor_older_candidates(self):
        scores = self.scores({0, 1}, {3, 4})
        self.assertGreater(scores[0], 0)
        self.assertLess(scores[3], 0)

    def test_reversing_feedback_reverses_the_date_adjustment(self):
        np.testing.assert_allclose(
            self.scores({0, 1}, {3, 4}),
            -self.scores({3, 4}, {0, 1}),
        )

    def test_two_preferred_eras_are_not_averaged_into_the_middle(self):
        scores = self.scores({0, 4}, {2})
        self.assertGreater(scores[0], 0)
        self.assertGreater(scores[4], 0)
        self.assertLess(scores[2], 0)

    def test_feedback_without_a_relative_preference_stays_neutral(self):
        for likes, dislikes in ((set(), set()), ({0, 3}, set()), (set(), {0, 3})):
            with self.subTest(likes=likes, dislikes=dislikes):
                np.testing.assert_allclose(self.scores(likes, dislikes), 0)

    def test_equal_acceptance_rates_stay_neutral_despite_unequal_exposure(self):
        # 8/10 older films liked and 4/5 newer films liked: both are 80%.
        index = make_index([date(1980, 1, 1)] * 10 + [date(2020, 1, 1)] * 5)
        scores = self.scores(
            set(range(8)) | set(range(10, 14)), {8, 9, 14}, index,
        )
        np.testing.assert_allclose(scores, 0, atol=1e-6)

    def test_unrated_periods_are_neutral(self):
        self.assertEqual(self.scores({3, 4}, {0, 1})[2], 0)

    def test_missing_and_future_dates_are_neutral_and_do_not_bias_the_baseline(self):
        expected = self.scores({3, 4}, {0, 1})
        actual = self.scores({3, 4, 5}, {0, 1, 6})
        np.testing.assert_allclose(actual, expected)
        np.testing.assert_allclose(actual[5:], 0)

    def test_unknown_catalog_ids_are_ignored(self):
        np.testing.assert_allclose(
            self.scores({3, 4, 999}, {0, 1, 998}),
            self.scores({3, 4}, {0, 1}),
        )

    def test_one_observed_period_cannot_establish_a_relative_preference(self):
        index = make_index([date(2000, 1, 1)] * 4)
        np.testing.assert_allclose(self.scores({0, 1}, {2, 3}, index), 0)

    def test_no_usable_dates_are_neutral(self):
        index = make_index([None, date.max])
        np.testing.assert_allclose(self.scores({0}, {1}, index), 0)

    def test_sparse_preferences_are_weaker_and_the_adjustment_is_bounded(self):
        sparse = make_index([date(1980, 1, 1), date(2020, 1, 1)])
        many = make_index([date(1980, 1, 1)] * 20 + [date(2020, 1, 1)] * 20)
        sparse_scores = self.scores({0}, {1}, sparse)
        many_scores = self.scores(set(range(20)), set(range(20, 40)), many)
        self.assertGreater(many_scores[0], sparse_scores[0])
        adjustment = recommender.RELEASE_PERIOD_WEIGHT * many_scores
        self.assertLessEqual(np.abs(adjustment).max(), recommender.RELEASE_PERIOD_WEIGHT)


class RecommendationReleaseIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = []
        for media_id, year, genre in (
            (10, 1980, "Action"), (20, 2020, "Action"),
            (30, 1980, "Action"), (40, 2020, "Action"),
            (50, 1980, "Romance"),
        ):
            cls.rows.append(SimpleNamespace(
                id=media_id,
                genres=[genre],
                keywords=["rescue"] if genre == "Action" else ["wedding"],
                overview=("A hero rescues a friend." if genre == "Action"
                          else "A couple celebrates their wedding."),
                is_anime=False,
                vote_average=8.0,
                vote_count=100,
                release_date=date(year, 1, 1),
            ))
        db = MagicMock()
        db.execute.return_value.all.return_value = cls.rows
        cls.index = recommender.build_recommender_index(db)

    def recommendations(self, liked_id, disliked_id, excluded=None, limit=1):
        db = MagicMock()
        db.get.return_value = SimpleNamespace(preferred_genres=["Action"])
        db.execute.return_value.all.return_value = [
            SimpleNamespace(media_id=liked_id, feedback="like"),
            SimpleNamespace(media_id=disliked_id, feedback="dislike"),
        ]
        db.scalars.return_value.all.return_value = self.rows
        with patch.object(recommender, "random", random.Random(0)):
            return recommender.get_recommendations(
                user_id=1, db=db, index=self.index, limit=limit,
                exclude_ids=excluded,
            )

    def test_older_preferring_user_selects_the_older_relevant_candidate(self):
        result = self.recommendations(liked_id=10, disliked_id=20)
        self.assertEqual([media.id for media in result], [30])

    def test_recent_preferring_user_selects_the_newer_relevant_candidate(self):
        # Content, quality and diversity are identical for the two candidates.
        # With date scoring disabled, their stable tie selects ID 30.
        with patch.object(recommender, "RELEASE_PERIOD_WEIGHT", 0):
            baseline = self.recommendations(liked_id=20, disliked_id=10)
        result = self.recommendations(liked_id=20, disliked_id=10)
        self.assertEqual([media.id for media in baseline], [30])
        self.assertEqual([media.id for media in result], [40])

    def test_seen_and_queued_media_are_still_excluded(self):
        result = self.recommendations(
            liked_id=20, disliked_id=10, excluded=[40], limit=3,
        )
        self.assertEqual([media.id for media in result], [30])

    def test_date_preference_does_not_promote_unrelated_content(self):
        result = self.recommendations(liked_id=10, disliked_id=20, limit=3)
        self.assertEqual({media.id for media in result}, {30, 40})
        self.assertNotIn(50, [media.id for media in result])


if __name__ == "__main__":
    unittest.main()
