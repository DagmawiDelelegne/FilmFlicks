from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sklearn.preprocessing import MultiLabelBinarizer
from models import Media, UserMediaFeedback

GENERE_ALIASES = {
    "Action & Adventure": ["Action", "Adventure"],
    "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
    "War & Politics" : ["War", "Politics"],
}

def normalize_genre(genres: list[str]) -> list[str]:
    normalized = set()
    for genre in genres:
        genre = genre.strip()
        
        if not genre:
            continue

        normalized.update(GENERE_ALIASES.get(genre,[genre]))
    return sorted(normalized)

def build_genre_index(db: Session):
    rows = db.execute(
        select(Media.id, Media.genres)
        .where(Media.adult.is_(False))
        .order_by(Media.id)
    ).all()

    if not rows:
        raise RuntimeError("Cannot build recommendation: catalog is emty")

    media_ids = [row.id for row in rows]
    genre_lists = [normalize_genre(row.genres or []) for row in rows]

    encoder = MultiLabelBinarizer(sparse_output=True)
    matrix = encoder.fit_transform(genre_lists)

    return {
        "media_ids": media_ids,
        "genre_encoder": encoder,
        "genre_matrix": matrix,
    }

def get_recommendations(
    user_id: int,
    db: Session,
    limit: int = 10,
    exclude_ids: list[int] | None = None,
) -> list[Media]:
    seen_media_ids = select(UserMediaFeedback.media_id).where(
        UserMediaFeedback.user_id == user_id
    )

    recommendations = db.scalars(
        select(Media)
        .where(Media.id.notin_(seen_media_ids),
               Media.id.notin_(exclude_ids or []))
        .order_by(func.random())
        .limit(limit)
    ).all()

    if not recommendations:
        raise HTTPException(status_code=404, detail="No recommendations available")

    return recommendations