from pydantic import BaseModel
from typing import List, Literal

MediaType = Literal["movie","tv"]

class MediaItem(BaseModel):
    title: str
    overview: str = ""
    genres: List[str] = []
    thumbnail_url: str = ""
    media_type: MediaType
    release_date: str = ""     
    vote_average: float = 0.0  
    streaming_service: str = ""  
    is_anime: bool = False 

