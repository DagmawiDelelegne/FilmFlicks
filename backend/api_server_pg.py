import os
import secrets
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, case, desc

from dotenv import load_dotenv

from schemas import MediaItem,OAuthLoginIn,UserOut
from models import Media, User, UserAuthAccount
from database import sessionLocal
from helpers import media_to_api_item


api = FastAPI()

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
@api.get("/api/search", response_model=list[MediaItem])
def search(query: str, limit: int = Query(default=10, ge=1, le=50), db: Session = Depends(get_db)):
    query = query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    search_text = f"%{query}%"
    starts_with = f"{query}%"

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
        )
        .limit(limit)
    )
    media_results = db.scalars(statement).all()
    return [media_to_api_item(media) for media in media_results]
