from datetime import datetime, date
from uuid import UUID

from sqlalchemy import (
    Boolean, 
    DateTime, 
    Text, 
    func, 
    Integer,
    REAL,
    ForeignKey, 
    UniqueConstraint,
    CheckConstraint,
    text,
    Date,
    Index,
    Uuid,
    )
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    name: Mapped[str] = mapped_column(Text,nullable=False,default="")
    picture: Mapped[str] = mapped_column(Text,nullable=False,default="")
    preferred_genres: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default=text("ARRAY[]::TEXT[]"),
    )
    genre_onboarding_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("FALSE"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

class UserAuthAccount(Base):
    __tablename__ = "user_auth_accounts"

    id: Mapped[int] = mapped_column(primary_key = True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete = "CASCADE"), 
        nullable=False
        )
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    provider_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
            DateTime,
            nullable=False,
            server_default=func.now(),
        )

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id"),
    )

class Media(Base):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    media_type: Mapped[str] = mapped_column(Text, nullable=False)
    tmdb_id: Mapped[int] = mapped_column(Integer, nullable=False)
    is_anime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    title: Mapped[str] = mapped_column(Text,nullable=False)
    overview: Mapped[str] = mapped_column(Text, nullable=False)

    genre_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    genres: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    keywords: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default=text("ARRAY[]::TEXT[]"),
    )

    thumbnail_url: Mapped[str] = mapped_column(Text, nullable=False)
    release_date: Mapped[date] = mapped_column(Date, nullable=False)

    vote_average: Mapped[float] = mapped_column(REAL, nullable=False)
    vote_count: Mapped[int] = mapped_column(Integer, nullable=False)
    popularity: Mapped[float] = mapped_column(REAL, nullable=False, default=0)
    original_language: Mapped[str] = mapped_column(Text, nullable=False, default="")
    watch_providers: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb")
    )
    primary_streaming_service: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default=""
    )

    adult: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint("media_type IN ('movie', 'tv')", name="valid_media_type"),
        UniqueConstraint("media_type", "tmdb_id", name="unique_tmdb_media"),
    )

class MediaDisplay(Base):
    __tablename__ = "media_displays"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    media_id: Mapped[int] = mapped_column(
        ForeignKey("media.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    displayed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "event_id",
            name="uq_media_displays_user_event",
        ),
        Index(
            "ix_media_displays_user_recent",
            "user_id",
            "displayed_at",
            "id",
        ),
    )


class LatestFeedback(Base):
    __tablename__ = "latest_feedback"
    user_id : Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),primary_key=True)
    media_id: Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("feedback IN ('like', 'dislike')", name="valid_latest_feedback"),
    )

class UserMediaFeedback(Base):
    __tablename__ = "user_media_feedback"

    user_id : Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),primary_key=True,)
    media_id : Mapped[int] = mapped_column(ForeignKey("media.id", ondelete="CASCADE"), primary_key=True,)
    feedback : Mapped[str] = mapped_column(Text, nullable=False)
    created_at : Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )
    __table_args__ = (
        CheckConstraint("feedback IN ('like', 'dislike')", name="valid_user_media_feedback"),
    )
