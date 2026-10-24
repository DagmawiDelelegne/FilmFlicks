import { MediaItem, FeedbackPaylaod, PaginatedMediaResponse, OnboardingStatus } from "./types/media";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;


export async function getRec(limit = 3, exclude_ids: number[]): Promise<MediaItem[]> {
  const params = new URLSearchParams({limit:String(limit)});
  for (const id of exclude_ids){
    params.append("exclude_ids",String(id));
  }
  const res = await fetch(`/api/rec?${params}`, {cache:"no-store"});
  if (!res.ok) throw new Error(`getRec failed: ${res.status}`);
  return res.json();
}

export async function sendFeedback(payload: FeedbackPaylaod): Promise<void> {
    const res = await fetch(`/api/feedback`, 
                {method : "POST", 
                 headers: {"Content-Type": "application/json"}, 
                 body: JSON.stringify(payload),});

        if (!res.ok) throw new Error(`sendFeedback failed: ${res.status}`);
}

export async function getLikedMedia(page: number, limit = 10): Promise<PaginatedMediaResponse> {

  const res = await fetch(`/api/likes?page=${page}&limit=${limit}`,{cache: "no-store"},);
  if (!res.ok){
    throw new Error("Failed to fetch liked media");
  }
  
  return res.json();
}

export async function unlikeMedia(mediaId: number): Promise<void> {
    const res = await fetch(`/api/likes/${mediaId}`, {
        method: "DELETE",
    });

    if (!res.ok) throw new Error(`unlikeMedia failed: ${res.status}`);
}

export async function searchMovies(query: string, page: number, limit = 10): Promise<PaginatedMediaResponse> {
  const res = await fetch(
    `${BASE_URL}/api/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );

  if (!res.ok) {
    throw new Error("Failed to search movies");
  }

  return res.json();
}

export async function getLikedMediaIds(): Promise<number[]> {
  const res = await fetch("/api/likes/ids", {cache: "no-store"});
  if (!res.ok) throw new Error("Failed to fetch liked media Ids");
  return res.json();
}

export async function likeMedia(mediaId: number): Promise<void> {
  const res = await fetch(`/api/likes`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({media_id: mediaId})
  });
  if (!res.ok) throw new Error("Failed to like media");
}

export async function getLikedCount(): Promise<number> {
  const res = await fetch(`/api/likes/count`);
  if (!res.ok) throw new Error("Failed to fetch liked count");
  const data = await res.json();
  return data.count;
}

export async function undoFeedback(): Promise<void> {
  const res = await fetch (`/api/undo`, {method: "POST"});
  if (!res.ok) throw new Error (`undoFeedback failed : ${res.status}`);
}


export async function getOnboarding(): Promise<OnboardingStatus>{
  const res = await fetch(`/api/onboarding`,{
    cache: "no-store",
  });

  if (!res.ok){
    throw new Error (`getOnboarding failed: ${res.status}`);
  }
  return res.json();
}

export async function saveOnboarding(genres: string[]): Promise<void>{
  const res = await fetch(`/api/onboarding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(genres),
  });

  if (!res.ok){
    throw new Error (`SaveOnboarding failed: ${res.status}`);
  }
}

export async function get_stats() : Promise<{
  "liked": number;
  "disliked": number;
}>{
  
  const res = await fetch("/api/stats",{
    cache: "no-store",
  }
  )
  if (!res.ok){
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  return res.json();
}

export async function get_genre_stats(): Promise<Record<string, number>>{
    
    const res = await fetch("/api/stats/genres", {
      cache: "no-store",
    })
    
  if (!res.ok){
    throw new Error(`Failed to fetch genre stats: ${res.status}`);
  }
    return res.json();
}

export async function get_streaming_stats(): Promise<Record<string, number>>{
    
    const res = await fetch("/api/stats/streaming", {
      cache: "no-store",
    })
    
  if (!res.ok){
    throw new Error(`Failed to fetch streaming stats: ${res.status}`);
  }
    return res.json();
}