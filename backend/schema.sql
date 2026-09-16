CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL DEFAULT '',
    picture TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_auth_accounts (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (provider,provider_user_id)
);

CREATE TABLE media(
    id BIGSERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(10) NOT NULL,
    is_anime BOOLEAN NOT NULL DEFAULT FALSE,
    title TEXT NOT NULL,
    overview TEXT NOT NULL,
    genre_ids INTEGER[] NOT NULL,
    genres TEXT[] NOT NULL,
    thumbnail_url TEXT NOT NULL,
    release_date DATE NOT NULL,
    vote_average REAL NOT NULL,
    vote_count INTEGER NOT NULL,
    adult BOOLEAN NOT NULL DEFAULT FALSE,
    primary_streaming_service TEXT NOT NULL DEFAULT '',
    watch_providers JSONB NOT NULL DEFAULT '{}',
    keywords TEXT[] NOT NULL DEFAULT '{}',
    popularity REAL NOT NULL DEFAULT 0,
    original_language TEXT NOT NULL DEFAULT '',

    CONSTRAINT valid_media_type
        CHECK (media_type IN ('movie','tv')),
    
    CONSTRAINT unique_tmdb_media
        UNIQUE (media_type,tmdb_id)
);


CREATE TABLE user_media_feedback(
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id BIGINT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    feedback TEXT NOT NULL CHECK (feedback IN ('like','dislike')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id,media_id)
);

