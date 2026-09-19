import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, case, desc

from dotenv import load_dotenv

from schemas import MediaItem
from models import Media
from database import sessionLocal
from helpers import media_to_api_item
api = FastAPI()

load_dotenv()
FRONTEND_URL = os.getenv("FRONTEND_URL")
api.add_middleware(
    CORSMiddleware,
    allow_origins= [FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()

@api.get("/api/search", response_model=list[MediaItem])
def search(query: str, limit: int = 10, db: Session = Depends(get_db)):
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
