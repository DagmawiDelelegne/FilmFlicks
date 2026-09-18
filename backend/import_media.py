import json
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from database import sessionLocal
from models import Media

DATA_DIR = Path(__file__).parent / "media_collection" / "data"
MOVIES_FILE = DATA_DIR / "movies.json"
SHOWS_FILE = DATA_DIR / "shows.json"

def load_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)

def media_values(record):
    return {
        "tmdb_id": record["tmdb_id"],
        "media_type": record["media_type"],
        "is_anime": record["is_anime"],
        "title": record["title"],
        "overview": record["overview"],
        "genre_ids": record["genre_ids"],
        "genres": record["genres"],
        "keywords": record.get("keywords", []),
        "thumbnail_url": record["thumbnail_url"],
        "release_date": record["release_date"],
        "vote_average": record["vote_average"],
        "vote_count": record["vote_count"],
        "popularity": record.get("popularity", 0),
        "original_language": record.get("original_language", ""),
        "watch_providers": record.get("watch_providers", {}),
        "primary_streaming_service": record.get("primary_streaming_service", ""),
        "adult": record.get("adult", False),
    }


def import_records(session, records):
    inserted = 0
    skipped = 0

    for record in records:
        statement = insert(Media).values(**media_values(record))
        statement = statement.on_conflict_do_nothing(
            index_elements=["media_type", "tmdb_id"]
        )

        result = session.execute(statement)

        if result.rowcount == 1:
            inserted += 1
        else:
            skipped += 1

    return inserted, skipped


def main():
    movies = load_json(MOVIES_FILE)
    shows = load_json(SHOWS_FILE)
    records = movies + shows

    with sessionLocal() as session:
        inserted, skipped = import_records(session, records)
        session.commit()

    print(f"Records loaded: {len(records)}")
    print(f"Inserted: {inserted}")
    print(f"Skipped duplicates: {skipped}")

if __name__ == "__main__":
    main()