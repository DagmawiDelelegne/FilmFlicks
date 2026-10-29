import random

import numpy as np
from fastapi import HTTPException
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MultiLabelBinarizer, normalize
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Media, User, UserMediaFeedback


PERSONALIZATION_LIKE_THRESHOLD = 10
EXPLORATION_SHARE = 0.40

DISLIKE_WEIGHT = 0.25
CONTEXT_LIKE_WEIGHT = 0.10
CONTEXT_DISLIKE_WEIGHT = 0.05

CONTENT_WEIGHTS = {
    "genre_matrix": 0.35,
    "keyword_matrix": 0.40,
    "overview_matrix": 0.25,
}

GENRE_ALIASES = {
    "Action & Adventure": ["Action", "Adventure"],
    "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
    "War & Politics": ["War", "Politics"],
}


def normalize_genres(genres: list[str]) -> list[str]:
    normalized = set()

    for genre in genres:
        genre = genre.strip()
        if genre:
            normalized.update(GENRE_ALIASES.get(genre, [genre]))

    return sorted(normalized)


def normalize_keywords(keywords: list[str]) -> list[str]:
    return sorted({
        keyword.strip().casefold()
        for keyword in keywords
        if keyword.strip()
    })


def build_recommender_index(db: Session):
    rows = db.execute(
        select(
            Media.id,
            Media.genres,
            Media.keywords,
            Media.overview,
            Media.is_anime,
            Media.vote_average,
            Media.vote_count,
        )
        .where(Media.adult.is_(False))
        .order_by(Media.id)
    ).all()

    if not rows:
        raise RuntimeError(
            "Cannot build recommendations: catalog is empty"
        )

    media_ids = [row.id for row in rows]
    genre_lists = [
        normalize_genres(row.genres or [])
        for row in rows
    ]

    genre_encoder = MultiLabelBinarizer(sparse_output=True)
    genre_matrix = genre_encoder.fit_transform(genre_lists)

    keyword_lists = [
        normalize_keywords(row.keywords or [])
        for row in rows
    ]

    keyword_vectorizer = None
    keyword_matrix = csr_matrix(
        (len(rows), 0),
        dtype=np.float32,
    )

    if any(keyword_lists):
        keyword_vectorizer = TfidfVectorizer(
            analyzer=normalize_keywords,
            binary=True,
            dtype=np.float32,
        )
        keyword_matrix = keyword_vectorizer.fit_transform(
            keyword_lists
        )

    overview_texts = [
        (row.overview or "").strip()
        for row in rows
    ]

    overview_vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=10000,
        dtype=np.float32,
    )

    analyzer = overview_vectorizer.build_analyzer()

    if any(analyzer(text) for text in overview_texts):
        overview_matrix = overview_vectorizer.fit_transform(
            overview_texts
        )
    else:
        overview_vectorizer = None
        overview_matrix = csr_matrix(
            (len(rows), 0),
            dtype=np.float32,
        )

    # No standalone anime feature: always pair it with content.
    context_lists = [
        [
            f"{'anime' if row.is_anime else 'other'}:{genre}"
            for genre in genres
        ]
        for row, genres in zip(rows, genre_lists)
    ]

    context_encoder = MultiLabelBinarizer(sparse_output=True)
    context_matrix = context_encoder.fit_transform(context_lists)

    index = {
        "media_ids": media_ids,
        "row_by_id": {
            media_id: row
            for row, media_id in enumerate(media_ids)
        },
        "genre_encoder": genre_encoder,
        "genre_matrix": genre_matrix,
        "keyword_vectorizer": keyword_vectorizer,
        "keyword_matrix": keyword_matrix,
        "overview_vectorizer": overview_vectorizer,
        "overview_matrix": overview_matrix,
        "context_encoder": context_encoder,
        "context_matrix": context_matrix,
    }

    ratings = np.clip(
    np.array([row.vote_average or 0 for row in rows], dtype=np.float32),
    0,
    10,
    )
    votes = np.maximum(
        np.array([row.vote_count or 0 for row in rows], dtype=np.float32),
        0,
    )

    catalog_mean = float(ratings[votes > 0].mean()) if np.any(votes > 0) else 5.0
    confidence = votes / (votes + 100.0)

    index["quality_scores"] = (
        confidence * ratings + (1 - confidence) * catalog_mean
    ) / 10

    # Normalize each feature group before measuring title similarity.
    feature_blocks = [
        normalize(index[key].astype(np.float32)) * np.sqrt(weight)
        for key, weight in CONTENT_WEIGHTS.items()
        if index[key].shape[1] > 0
    ]

    if feature_blocks:
        index["diversity_matrix"] = normalize(
            hstack(feature_blocks, format="csr")
        )
    else:
        index["diversity_matrix"] = csr_matrix(
            (len(rows), 0),
            dtype=np.float32,
        )

    return index


def get_genre_scores(preferred_genres: list[str], index: dict):
    encoder = index["genre_encoder"]
    known_genres = set(encoder.classes_)

    selected = [
        genre
        for genre in normalize_genres(preferred_genres)
        if genre in known_genres
    ]

    if not selected:
        return None

    user_vector = encoder.transform([selected])

    return cosine_similarity(
        user_vector,
        index["genre_matrix"],
    ).ravel()


def get_content_scores(
    media_ids: set[int],
    index: dict,
    weights=None,
):
    """Build a profile from either liked or disliked media."""
    rows = [
        index["row_by_id"][media_id]
        for media_id in media_ids
        if media_id in index["row_by_id"]
    ]

    if not rows:
        return None

    feature_weights = CONTENT_WEIGHTS if weights is None else weights
    combined = np.zeros(
        len(index["media_ids"]),
        dtype=np.float32,
    )
    active_weight = 0.0

    for key, weight in feature_weights.items():
        matrix = index[key]

        if matrix.shape[1] == 0:
            continue

        profile = np.asarray(
            matrix[rows].mean(axis=0)
        )

        if not np.any(profile):
            continue

        combined += weight * cosine_similarity(
            profile,
            matrix,
        ).ravel()

        active_weight += weight

    if active_weight == 0:
        return None

    return combined / active_weight


def select_recommendation_rows(
    positive_scores,
    final_scores,
    index,
    excluded_ids,
    queued_ids,
    liked_ids,
    limit,
    rng=None,
    exploration_share=EXPLORATION_SHARE,
):
    rng = random if rng is None else rng

    eligible = [
        row
        for row, media_id in enumerate(index["media_ids"])
        if media_id not in excluded_ids
        and positive_scores[row] > 0
        and final_scores[row] > 0
    ]

    if not eligible or limit <= 0:
        return []

    # Allow broader matches, but require a content connection.
    best_relevance = max(
        float(positive_scores[row])
        for row in eligible
    )
    minimum_relevance = max(0.05, best_relevance * 0.15)

    remaining = [
        row
        for row in eligible
        if positive_scores[row] >= minimum_relevance
    ]

    queued_rows = [
        index["row_by_id"][media_id]
        for media_id in queued_ids
        if media_id in index["row_by_id"]
    ]
    liked_rows = [
        index["row_by_id"][media_id]
        for media_id in liked_ids
        if media_id in index["row_by_id"]
    ]

    selected = []
    matrix = index["diversity_matrix"]

    for _ in range(min(limit, len(remaining))):
        exploring = rng.random() < exploration_share

        references = queued_rows + selected
        if exploring:
            references = references + liked_rows

        if references and matrix.shape[1] > 0:
            redundancy = cosine_similarity(
                matrix[remaining],
                matrix[references],
            ).max(axis=1)
        else:
            redundancy = np.zeros(len(remaining))

        relevance_weight = 0.45 if exploring else 0.80

        selection_scores = (
            relevance_weight * final_scores[remaining]
            - (1 - relevance_weight) * redundancy
        )

        order = np.argsort(
            -selection_scores,
            kind="stable",
        )

        if exploring:
            # Choose among good edge candidates, not arbitrary titles.
            position = int(rng.choice(order[:10].tolist()))
        else:
            position = int(order[0])

        selected.append(remaining.pop(position))

    return selected


def get_recommendations(
    user_id: int,
    db: Session,
    index: dict,
    limit: int = 3,
    exclude_ids: list[int] | None = None,
) -> list[Media]:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if limit <= 0:
        return []

    feedback_rows = db.execute(
        select(
            UserMediaFeedback.media_id,
            UserMediaFeedback.feedback,
        ).where(UserMediaFeedback.user_id == user_id)
    ).all()

    seen_ids = {row.media_id for row in feedback_rows}

    liked_ids = {
        row.media_id
        for row in feedback_rows
        if row.feedback == "like"
    }
    disliked_ids = {
        row.media_id
        for row in feedback_rows
        if row.feedback == "dislike"
    }

    queued_ids = set(exclude_ids or [])
    excluded_ids = seen_ids | queued_ids

    statement = select(Media).where(
        Media.adult.is_(False),
        Media.id.notin_(excluded_ids),
    )

    personalized = (
        len(liked_ids) >= PERSONALIZATION_LIKE_THRESHOLD
    )

    if personalized:
        positive_scores = get_content_scores(liked_ids, index)
    else:
        positive_scores = get_genre_scores(
            user.preferred_genres or [],
            index,
        )

    if positive_scores is None:
        popular_pool = db.scalars(
            statement
            .where(Media.media_type == "movie")
            .order_by(
                Media.popularity.desc(),
                Media.vote_count.desc(),
                Media.id,
            )
            .limit(100)
        ).all()

        return random.sample(
            popular_pool,
            min(limit, len(popular_pool)),
        )

    final_scores = positive_scores.copy()
    context_weights = {"context_matrix": 1.0}

    if personalized:
        positive_context = get_content_scores(
            liked_ids,
            index,
            context_weights,
        )

        if positive_context is not None:
            final_scores += (
                CONTEXT_LIKE_WEIGHT * positive_context
            )

    # Increase negative influence gradually over the first five dislikes.
    confidence = min(len(disliked_ids) / 5, 1.0)

    negative_scores = get_content_scores(
        disliked_ids,
        index,
    )
    negative_context = get_content_scores(
        disliked_ids,
        index,
        context_weights,
    )

    if negative_scores is not None:
        final_scores -= (
            DISLIKE_WEIGHT * confidence * negative_scores
        )

    if negative_context is not None:
        final_scores -= (
            CONTEXT_DISLIKE_WEIGHT
            * confidence
            * negative_context
        )

    final_scores += np.where(
        final_scores > 0,
        0.05 * index["quality_scores"],
        0.0,
    )

    selected_rows = select_recommendation_rows(
        positive_scores,
        final_scores,
        index,
        excluded_ids,
        queued_ids,
        liked_ids,
        limit,
    )

    selected_ids = [
        index["media_ids"][row]
        for row in selected_rows
    ]

    if not selected_ids:
        return []

    media_rows = db.scalars(
        statement.where(Media.id.in_(selected_ids))
    ).all()

    media_by_id = {
        media.id: media
        for media in media_rows
    }

    return [
        media_by_id[media_id]
        for media_id in selected_ids
        if media_id in media_by_id
    ]