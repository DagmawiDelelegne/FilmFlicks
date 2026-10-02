export type MediaItem = {
    id: number;
    media_type : "movie" | "tv";
    is_anime?: boolean;
    title : string;
    overview : string;
    genres : string[];
    thumbnail_url: string;
    release_date : string; 
    vote_average : number;
    streaming_service?: string;
}

export function getMediaDisplayType(item: MediaItem) {
    return item.is_anime ? "ANIME" : item.media_type.toUpperCase();
}


export type FeedbackPaylaod ={
    google_id : string;
    title : string;
    action : "like" | "dislike";
};

export type RemoveMatchPayload = {
    google_id : string;
    title : string;
};
