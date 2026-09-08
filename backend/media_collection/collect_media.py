import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("TMDB_ACCESS_TOKEN")

movie_url = "https://api.themoviedb.org/3/discover/movie"
show_url = "https://api.themoviedb.org/3/discover/tv"
poster_base_url = "https://image.tmdb.org/t/p/w500"

TOTAL_MOVIES = 1000
TOTAL_SHOWS = 1000
TOTAL_ANIME = 1000

headers = {
    "accept": "application/json",
    "Authorization": f"Bearer {token}",
}

base_params = {
    "sort_by": "popularity.desc",
    "vote_average.gte": 7.0,
    "vote_count.gte": 20,
    "include_adult": False,
}

anime_params = {
    **base_params,
    "with_genres": 16,
    "with_original_language": "ja",
}


def is_complete_movie(movie):
    if not movie.get("title"):
        return False
    if not movie.get("overview"):
        return False
    if not movie.get("poster_path"):
        return False
    if not movie.get("release_date"):
        return False
    if not movie.get("genre_ids"):
        return False
    if not movie.get("vote_average"):
        return False
    if not movie.get("vote_count"):
        return False
    return True


def is_complete_show(show):
    if not show.get("name"):
        return False
    if not show.get("overview"):
        return False
    if not show.get("poster_path"):
        return False
    if not show.get("first_air_date"):
        return False
    if not show.get("genre_ids"):
        return False
    if not show.get("vote_average"):
        return False
    if not show.get("vote_count"):
        return False
    return True


def normalize_movie(movie, is_anime):
    return {
        "tmdb_id": movie["id"],
        "media_type": "movie",
        "is_anime": is_anime,
        "title": movie["title"],
        "overview": movie["overview"],
        "genres": movie["genre_ids"],
        "thumbnail_url": poster_base_url + movie["poster_path"],
        "release_date": movie["release_date"],
        "vote_average": movie["vote_average"],
        "vote_count": movie["vote_count"],
        "adult": movie.get("adult", False),
    }


def normalize_show(show, is_anime):
    return {
        "tmdb_id": show["id"],
        "media_type": "tv",
        "is_anime": is_anime,
        "title": show["name"],
        "overview": show["overview"],
        "genres": show["genre_ids"],
        "thumbnail_url": poster_base_url + show["poster_path"],
        "release_date": show["first_air_date"],
        "vote_average": show["vote_average"],
        "vote_count": show["vote_count"],
        "adult": show.get("adult", False),
    }


def collect_movies():
    movies = []
    seen_keys = set()
    page = 1

    while len(movies) < TOTAL_MOVIES:
        params = {**base_params, "page": page}
        response = requests.get(movie_url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        for movie in data["results"]:
            if not is_complete_movie(movie):
                continue

            key = ("movie", movie["id"])
            if key in seen_keys:
                continue

            movies.append(normalize_movie(movie, is_anime=False))
            seen_keys.add(key)

            if len(movies) == TOTAL_MOVIES:
                break

        print(f"Total movies collected: {len(movies)}")

        if page >= data["total_pages"]:
            break
        page += 1

    return movies


def collect_shows():
    shows = []
    seen_keys = set()
    page = 1

    while len(shows) < TOTAL_SHOWS:
        params = {**base_params, "page": page}
        response = requests.get(show_url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        for show in data["results"]:
            if not is_complete_show(show):
                continue

            key = ("tv", show["id"])
            if key in seen_keys:
                continue

            shows.append(normalize_show(show, is_anime=False))
            seen_keys.add(key)

            if len(shows) == TOTAL_SHOWS:
                break

        print(f"Total TV shows collected: {len(shows)}")

        if page >= data["total_pages"]:
            break
        page += 1

    return shows


def collect_anime(movies, shows, records_by_key):
    anime_keys = {
        key for key, record in records_by_key.items()
        if record["is_anime"]
    }
    movie_page = 1
    show_page = 1
    movie_pages_finished = False
    show_pages_finished = False

    while len(anime_keys) < TOTAL_ANIME:
        if movie_pages_finished and show_pages_finished:
            break

        if not movie_pages_finished:
            params = {**anime_params, "page": movie_page}
            response = requests.get(movie_url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            for movie in data["results"]:
                if len(anime_keys) == TOTAL_ANIME:
                    break
                if not is_complete_movie(movie):
                    continue

                key = ("movie", movie["id"])
                if key in records_by_key:
                    records_by_key[key]["is_anime"] = True
                else:
                    record = normalize_movie(movie, is_anime=True)
                    movies.append(record)
                    records_by_key[key] = record
                anime_keys.add(key)

            print(f"Anime records marked: {len(anime_keys)}")

            if movie_page >= data["total_pages"]:
                movie_pages_finished = True
            movie_page += 1

        if len(anime_keys) == TOTAL_ANIME:
            break

        if not show_pages_finished:
            params = {**anime_params, "page": show_page}
            response = requests.get(show_url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            for show in data["results"]:
                if len(anime_keys) == TOTAL_ANIME:
                    break
                if not is_complete_show(show):
                    continue

                key = ("tv", show["id"])
                if key in records_by_key:
                    records_by_key[key]["is_anime"] = True
                else:
                    record = normalize_show(show, is_anime=True)
                    shows.append(record)
                    records_by_key[key] = record
                anime_keys.add(key)

            print(f"Anime records marked: {len(anime_keys)}")

            if show_page >= data["total_pages"]:
                show_pages_finished = True
            show_page += 1


movies = collect_movies()
shows = collect_shows()

records_by_key = {
    (record["media_type"], record["tmdb_id"]): record
    for record in movies + shows
}

collect_anime(movies, shows, records_by_key)

output_directory = Path(__file__).parent / "data"
output_directory.mkdir(exist_ok=True)

movies_file = output_directory / "movies.json"
shows_file = output_directory / "shows.json"

with movies_file.open("w", encoding="utf-8") as file:
    json.dump(movies, file, indent=2, ensure_ascii=False)

with shows_file.open("w", encoding="utf-8") as file:
    json.dump(shows, file, indent=2, ensure_ascii=False)

all_records = movies + shows
unique_keys = {
    (record["media_type"], record["tmdb_id"])
    for record in all_records
}
anime_record_count = sum(1 for record in all_records if record["is_anime"])
duplicates_detected = len(unique_keys) != len(all_records)

print("Final summary")
print(f"Total movie records: {len(movies)}")
print(f"Total TV records: {len(shows)}")
print(f"Records marked as anime: {anime_record_count}")
print(f"Unique (media_type, tmdb_id) keys: {len(unique_keys)}")
print(f"Duplicates detected: {duplicates_detected}")
