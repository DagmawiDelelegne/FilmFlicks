from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models import Media, UserMediaFeedback


def get_recommendations(
    user_id: int,
    db: Session,
    limit: int = 10,
) -> list[Media]:
    seen_media_ids = select(UserMediaFeedback.media_id).where(
        UserMediaFeedback.user_id == user_id
    )

    recommendations = db.scalars(
        select(Media)
        .where(Media.id.notin_(seen_media_ids))
        .order_by(func.random())
        .limit(limit)
    ).all()

    if not recommendations:
        raise HTTPException(status_code=404, detail="No recommendations available")

    return recommendations