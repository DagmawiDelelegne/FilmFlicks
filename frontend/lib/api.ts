import { MediaItem, FeedbackPaylaod, PaginatedMediaResponse } from "./types/media";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;


export async function getRec(google_id: string) : Promise<MediaItem> {
    const res = await fetch(`${BASE_URL}/api/rec/${google_id}`, {cache:"no-store"});
    if (!res.ok) throw new Error(`getRec failed: ${res.status}`);
  return res.json();
}

export async function sendFeedback(payload: FeedbackPaylaod): Promise<MediaItem> {
    const res = await fetch(`${BASE_URL}/api/feedback`, 
                {method : "POST", 
                 headers: {"Content-Type": "application/json"}, 
                 body: JSON.stringify(payload),});

        if (!res.ok) throw new Error(`sendFeedback failed: ${res.status}`);
        return res.json();
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

export async function getLikedCount(userId: string): Promise<number> {
  const res = await fetch(`http://localhost:8000/api/likes/count/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch liked count");
  const data = await res.json();
  return data.count;
}

export async function undoFeedback(googleId: string): Promise<MediaItem> {
  const res = await fetch (`${BASE_URL}/api/undo/${googleId}`);
  if (!res.ok) throw new Error (`undoFeedback failed : ${res.status}`);
  const media = await res.json();
  return media;
}
