import os
import secrets
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, case, desc, func
from contextlib import asynccontextmanager
from recommender import get_recommendations, build_genre_index

from dotenv import load_dotenv

from schemas import MediaItem,OAuthLoginIn,UserOut,LikePayload, PaginatedMediaResponse, FeedbackPayload
from models import Media, User, UserAuthAccount, UserMediaFeedback, LatestFeedback
from database import sessionLocal
from helpers import media_to_api_item
from recommender import get_recommendations

@asynccontextmanager
async def lifespan(app: FastAPI):
    with sessionLocal() as db:
        app.state.recommender_index = build_genre_index(db)

    print(
        "Recommendation genre index loaded:",
        app.state.recommender_index["genre_matrix"].shape,
    )

    yield


api = FastAPI(lifespan=lifespan)

load_dotenv()
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL")


api.add_middleware(
    CORSMiddleware,
    allow_origins= [FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# use interal secret to ensure that important endpoints are accessed by a trusted server side request. 
def require_internal_secret(backend_internal_secret: str | None = Header(default=None)):
    if not INTERNAL_API_SECRET:
        raise HTTPException(status_code=500, detail="Internal API secret not configured")
    if not backend_internal_secret:
        raise HTTPException(status_code=401, detail="Missing internal API secret")
    if not secrets.compare_digest(backend_internal_secret,INTERNAL_API_SECRET):
        raise HTTPException(status_code=401, detail="Invalid internal API secret")

# create a database session for the request and close it afterward.
def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()

"""
OAuth for user sign in/up
currently only allowes an email to be linked to one provider .
"""
@api.post("/api/auth/sync-user", response_model=UserOut)
def sync_user(payload: OAuthLoginIn,
              _: bool = Depends(require_internal_secret),
              db: Session = Depends(get_db),):
    statement = (
        select(UserAuthAccount).where(
            UserAuthAccount.provider == payload.provider,
            UserAuthAccount.provider_user_id == payload.provider_user_id
        )
    )

    account = db.scalar(statement)

    if account:
        user = db.get(User,account.user_id)
        if not user:
            raise HTTPException(status_code=500, detail="Auth account points to missing user")
        return UserOut(
            id=user.id,
            email=user.email,
            email_verified=user.email_verified,
            name=user.name,
            picture=user.picture,
        )

    existing_email_user = db.scalar(
    select(User).where(User.email == payload.email)
    )

    if existing_email_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Sign in with the original provider first.",
        )

    user = User(
        email = payload.email,
        email_verified = payload.email_verified,
        name=payload.name,
        picture=payload.picture,
    )   
    db.add(user)
    db.flush()

    auth_account = UserAuthAccount(
        user_id=user.id,
        provider=payload.provider,
        provider_user_id = payload.provider_user_id,
    )

    db.add(auth_account)
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        name=user.name,
        picture=user.picture,
    )

"""
Search media by title
"""
@api.get("/api/search", response_model=PaginatedMediaResponse)
def search(query: str, page: int = Query(default=1, ge=1), limit: int = Query(default=10, ge=1, le=50), db: Session = Depends(get_db)):
    query = query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    search_text = f"%{query}%"
    starts_with = f"{query}%"
    offset = (page - 1) * limit

    statement = (
        select(Media)
        .where(Media.title.ilike(search_text))
        .order_by(
            case(
            (Media.title.ilike(starts_with), 0),
            else_=1,
        ),
        desc(Media.popularity),
        desc(Media.vote_count),
        Media.id,
        )
        .offset(offset)
        .limit(limit + 1)
    )
    media_results = db.scalars(statement).all()
    has_next = len(media_results) > limit
    page_items = media_results[:limit]
    total = db.scalar(
        select(func.count()).select_from(Media)
        .where(Media.title.ilike(search_text))
    ) or 0

    return PaginatedMediaResponse(
        items=[media_to_api_item(media) for media in page_items],
        page=page,
        limit=limit,
        has_next=has_next,
        total_pages=(total + limit - 1) // limit,
    )


# Provide ids of medias already liked by the user for search page
@api.get("/api/likes/{user_id}/ids", response_model=list[int])
def liked_ids(user_id: int, _: bool = Depends(require_internal_secret), db: Session= Depends(get_db)):
    statement = (
        select(UserMediaFeedback.media_id).where(
            UserMediaFeedback.user_id == user_id,
            UserMediaFeedback.feedback == "like",
        )
    )
    return list(db.scalars(statement).all())

# returns a list of MediaItems liked by the user
@api.get("/api/likes/{user_id}", response_model=PaginatedMediaResponse)
def liked_media(user_id: int,
                page : int = Query(default=1, ge=1),
                limit : int = Query(default=10, ge=1, le=50),
                _: bool = Depends(require_internal_secret),
                db: Session = Depends(get_db)):
    offset = (page - 1) * limit
    statement = (
        select(Media)
        .join(UserMediaFeedback, UserMediaFeedback.media_id == Media.id)
        .where(
            UserMediaFeedback.user_id == user_id,
            UserMediaFeedback.feedback == "like",
        )
        .order_by(desc(UserMediaFeedback.created_at), Media.id)
        .offset(offset)
        .limit(limit+1)
    )

    media_results = db.scalars(statement).all()
    has_next = len(media_results) > limit
    page_items = media_results[:limit]
    total = db.scalar(
        select(func.count()).select_from(UserMediaFeedback).where(
            UserMediaFeedback.user_id == user_id,
            UserMediaFeedback.feedback == "like",
        )
    ) or 0
    return PaginatedMediaResponse(
        items=[media_to_api_item(media) for media in page_items],
        page=page,
        limit=limit,
        has_next=has_next,
        total_pages=(total + limit - 1) // limit,
    )

# updates or addes to the user's feedback table
@api.post("/api/likes")
def like_media(
    payload: LikePayload,
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):
    feedback = db.get(UserMediaFeedback, (payload.user_id, payload.media_id))

    if feedback:
        feedback.feedback = "like"
    else:
        feedback = UserMediaFeedback(
            user_id=payload.user_id,
            media_id=payload.media_id,
            feedback="like",
        )
        db.add(feedback)

    db.commit()
    return {"ok": True}

@api.get("/api/likes/{user_id}/count")
def liked_count(
    user_id: int,
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):
    count = db.scalar(
        select(func.count())
        .select_from(UserMediaFeedback)
        .where(
            UserMediaFeedback.user_id == user_id,
            UserMediaFeedback.feedback == "like",
        )
    )
    return {"count": count or 0}


@api.get("/api/rec/{user_id}", response_model=list[MediaItem])
def recommended_media(
    user_id: int,
    limit: int = Query(default=3, ge=1, le=3),
    exclude_ids: list[int] | None = Query(default=None),
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):
    recommendations = get_recommendations(user_id=user_id, db=db, limit=limit, exclude_ids=exclude_ids)
    return [media_to_api_item(media) for media in recommendations]


@api.post("/api/feedback")
def save_feedback(
    payload: FeedbackPayload,
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):
    media = db.get(Media, payload.media_id)

    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    feedback = db.get(UserMediaFeedback, (payload.user_id, payload.media_id))

    if feedback:
        feedback.feedback = payload.feedback
    else:
        feedback = UserMediaFeedback(
            user_id=payload.user_id,
            media_id=payload.media_id,
            feedback=payload.feedback,
        )
        db.add(feedback)

    latest_feedback = db.get(LatestFeedback, payload.user_id)

    if latest_feedback:
        latest_feedback.media_id = payload.media_id
        latest_feedback.feedback = payload.feedback
        latest_feedback.updated_at = func.now()
    else:
        latest_feedback = LatestFeedback(
            user_id=payload.user_id,
            media_id=payload.media_id,
            feedback=payload.feedback,
        )
        db.add(latest_feedback)

    db.commit()
    return {"ok": True}


@api.post("/api/undo/{user_id}")
def undo_latest_feedback(
    user_id: int,
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):
    latest_feedback = db.get(LatestFeedback, user_id)

    if not latest_feedback:
        raise HTTPException(status_code=400, detail="No feedback to undo")

    feedback = db.get(UserMediaFeedback, (user_id, latest_feedback.media_id))

    if feedback and feedback.feedback == latest_feedback.feedback:
        db.delete(feedback)

    db.delete(latest_feedback)
    db.commit()

    return {"ok": True}


@api.delete("/api/likes/{user_id}/{media_id}")
def unlike_media(
    user_id: int,
    media_id: int,
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):
    feedback = db.get(UserMediaFeedback, (user_id, media_id))

    if feedback and feedback.feedback == "like":
        db.delete(feedback)
        db.commit()

    return {"ok": True}


@api.post("/api/onboarding/{user_id}")
def user_onboarding(
    user_id: int,
    genre_list : list[str],
    _: bool = Depends(require_internal_secret),
    db: Session = Depends(get_db),
):

    user = db.get(User, (user_id))

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.preferred_genres = genre_list
    user.genre_onboarding_completed = True

    db.commit()
    return {"ok": True}

@api.get("/api/onboarding/{user_id}")
def get_onboarding(
    user_id: int,
    _ : bool = Depends(require_internal_secret),
    db : Session = Depends(get_db),
):

    user = db.get(User, (user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "preferred_genres": user.preferred_genres,
        "onboarding_completed": user.genre_onboarding_completed,
    }

@api.get("/api/stats/genres/{user_id}", response_model = dict[str,int])
def get_stats(user_id: int,
              _ : bool = Depends(require_internal_secret),
              db : Session = Depends(get_db)):
    statement = (
        select(Media.genres).join(
            UserMediaFeedback,
            UserMediaFeedback.media_id == Media.id,
        ).where(
            UserMediaFeedback.user_id == user_id,
            UserMediaFeedback.feedback == "like",
        )
    )

    genre_list = db.scalars(statement).all()

    genre_dict = {}
    for genres in genre_list:
        for genre in genres:
            if genre not in genre_dict:
                genre_dict[genre] = 1
            else:
                genre_dict[genre] += 1

    return genre_dict

@api.get("/api/stats/streaming/{user_id}", response_model = dict[str, int])
def get_streaming(user_id: int, 
                  _ : bool = Depends(require_internal_secret),
                  db : Session = Depends(get_db)):

    statement = (
        select(Media.primary_streaming_service)
        .join(
            UserMediaFeedback,
            UserMediaFeedback.media_id == Media.id
        ).where(
            UserMediaFeedback.user_id == user_id,
            UserMediaFeedback.feedback == "like"
        )
    )
    streaming = db.scalars(statement).all()
    
    streaming_counts = {}

    for service in streaming:
        service = (service or "").strip()

        if not service:
            continue

        if service not in streaming_counts:
            streaming_counts[service] = 1
        else:
            streaming_counts[service] += 1

    return streaming_counts

@api.get("/api/stats/{user_id}", response_model = dict[str,int])
def feedback_stat(user_id : int,
                  _ : bool = Depends(require_internal_secret),
                  db : Session = Depends(get_db)):
    statement = (
        select(UserMediaFeedback.feedback)
        .where(UserMediaFeedback.user_id == user_id)
    )

    feedbacks = db.scalars(statement)
    counts = {
        "liked" : 0,
        "disliked" : 0,
    }
    
    for feedback in feedbacks:
        if feedback == "like":
            counts["liked"] += 1
        elif feedback == "dislike":
            counts["disliked"] += 1

    return counts