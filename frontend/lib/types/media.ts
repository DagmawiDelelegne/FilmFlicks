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
    media_id : number;
    action : "like" | "dislike";
};

export type PaginatedMediaResponse = {
    items: MediaItem[];
    page: number;
    limit: number;
    has_next: boolean;
    total_pages: number;
}

export type OnboardingStatus = {
    preferred_genres : String[];
    onboarding_completed : boolean;
}
