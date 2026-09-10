import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("TMDB_ACCESS_TOKEN")

movie_url = "https://api.themoviedb.org/3/discover/movie"
show_url = "https://api.themoviedb.org/3/discover/tv"
tmdb_base_url = "https://api.themoviedb.org/3"
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


def get_genre_map(media_type):
    response = requests.get(
        f"{tmdb_base_url}/genre/{media_type}/list",
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return {
        genre["id"]: genre["name"]
        for genre in data["genres"]
    }


def get_genre_names(genre_ids, genres_by_id):
    return [
        genres_by_id[genre_id]
        for genre_id in genre_ids
        if genre_id in genres_by_id
    ]


def get_keywords(media_type, tmdb_id):
    try:
        response = requests.get(
            f"{tmdb_base_url}/{media_type}/{tmdb_id}/keywords",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as error:
        print(f"Keyword request failed for {media_type} {tmdb_id}: {error}")
        return []

    data = response.json()

    keyword_results = data.get("keywords") or data.get("results") or []
    return [
        keyword["name"]
        for keyword in keyword_results
        if keyword.get("name")
    ]


def get_watch_providers(media_type, tmdb_id):
    empty_providers = {
        "flatrate": [],
        "free": [],
        "ads": [],
        "rent": [],
        "buy": [],
    }

    try:
        response = requests.get(
            f"{tmdb_base_url}/{media_type}/{tmdb_id}/watch/providers",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as error:
        print(f"Watch provider request failed for {media_type} {tmdb_id}: {error}")
        return empty_providers

    data = response.json()
    us_providers = data.get("results", {}).get("US", {})
    watch_providers = {}

    for provider_type in empty_providers:
        providers = us_providers.get(provider_type, [])
        watch_providers[provider_type] = [
            provider["provider_name"]
            for provider in providers
            if provider.get("provider_name")
        ]

    return watch_providers


def get_primary_streaming_service(watch_providers):
    for provider_type in ("flatrate", "free", "ads", "rent", "buy"):
        providers = watch_providers.get(provider_type, [])
        if providers:
            return providers[0]
    return ""


def normalize_movie(movie, is_anime):
    watch_providers = get_watch_providers("movie", movie["id"])

    return {
        "tmdb_id": movie["id"],
        "media_type": "movie",
        "is_anime": is_anime,
        "title": movie["title"],
        "overview": movie["overview"],
        "genre_ids": movie["genre_ids"],
        "genres": get_genre_names(movie["genre_ids"], movie_genres_by_id),
        "keywords": get_keywords("movie", movie["id"]),
        "thumbnail_url": poster_base_url + movie["poster_path"],
        "release_date": movie["release_date"],
        "vote_average": movie["vote_average"],
        "vote_count": movie["vote_count"],
        "popularity": movie.get("popularity", 0),
        "original_language": movie.get("original_language", ""),
        "watch_providers": watch_providers,
        "primary_streaming_service": get_primary_streaming_service(watch_providers),
        "adult": movie.get("adult", False),
    }


def normalize_show(show, is_anime):
    watch_providers = get_watch_providers("tv", show["id"])

    return {
        "tmdb_id": show["id"],
        "media_type": "tv",
        "is_anime": is_anime,
        "title": show["name"],
        "overview": show["overview"],
        "genre_ids": show["genre_ids"],
        "genres": get_genre_names(show["genre_ids"], show_genres_by_id),
        "keywords": get_keywords("tv", show["id"]),
        "thumbnail_url": poster_base_url + show["poster_path"],
        "release_date": show["first_air_date"],
        "vote_average": show["vote_average"],
        "vote_count": show["vote_count"],
        "popularity": show.get("popularity", 0),
        "original_language": show.get("original_language", ""),
        "watch_providers": watch_providers,
        "primary_streaming_service": get_primary_streaming_service(watch_providers),
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


movie_genres_by_id = get_genre_map("movie")
show_genres_by_id = get_genre_map("tv")

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
