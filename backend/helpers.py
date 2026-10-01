from datetime import date

from models import Media
from schemas import MediaItem

# Frontend expects a string for release date
def format_date(value: date | None) -> str:
    if not value:
        return ""
    return value.isoformat()

# Trimms the data to what frontend expects
def media_to_api_item(media: Media) -> MediaItem :
    return MediaItem(
        id=media.id,
        title=media.title,
        overview=media.overview,
        genres=media.genres or [],
        thumbnail_url=media.thumbnail_url,
        media_type=media.media_type,
        is_anime=media.is_anime,
        release_date=format_date(media.release_date),
        vote_average=media.vote_average,
        streaming_service=media.primary_streaming_service,
    )

