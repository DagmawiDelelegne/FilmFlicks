from pydantic import BaseModel
from typing import List, Literal

MediaType = Literal["movie","tv"]
OAuthProvider = Literal["google","github","instagram"]

class MediaItem(BaseModel):
    id: int
    title: str
    overview: str = ""
    genres: List[str] = []
    thumbnail_url: str = ""
    media_type: MediaType
    release_date: str = ""     
    vote_average: float = 0.0  
    streaming_service: str = ""  
    is_anime: bool = False 

class PaginatedMediaResponse(BaseModel):
    items: list[MediaItem]
    page: int
    limit: int
    has_next: bool

class OAuthLoginIn(BaseModel):
    provider: OAuthProvider
    provider_user_id: str
    email: str
    email_verified: bool = False
    name: str
    picture: str = ""

class UserOut(BaseModel):
    id: int
    email: str
    email_verified: bool
    name: str
    picture: str

class LikePayload(BaseModel):
    user_id: int
    media_id: int