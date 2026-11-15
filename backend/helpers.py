from datetime import date

from models import Media
from schemas import MediaItem


def get_preference_categories(
    genres: list[str] | None,
    is_anime: bool,
) -> list[str]:
    """Derive explicit animation categories without changing TMDB genres."""
    categories = {genre.strip() for genre in genres or [] if genre.strip()}
    is_animation = "Animation" in categories or "Other Animation" in categories
    categories.difference_update({"Animation", "Anime", "Other Animation"})

    if is_anime:
        categories.add("Anime")
    elif is_animation:
        categories.add("Other Animation")

    return sorted(categories)


def normalize_preferred_genres(genres: list[str] | None) -> list[str]:
    """Preserve the broad meaning of legacy Animation preferences."""
    preferred = set()

    for genre in genres or []:
        genre = genre.strip()
        if genre == "Animation":
            preferred.update({"Anime", "Other Animation"})
        elif genre:
            preferred.add(genre)

    return sorted(preferred)


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
        genres=get_preference_categories(media.genres, media.is_anime),
        thumbnail_url=media.thumbnail_url,
        media_type=media.media_type,
        is_anime=media.is_anime,
        release_date=format_date(media.release_date),
        vote_average=media.vote_average,
        streaming_service=media.primary_streaming_service,
    )

