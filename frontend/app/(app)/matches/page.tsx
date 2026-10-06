"use client";

import { useEffect, useId, useState } from "react";
import { DetailsCard } from "@/components/DetailsCard";
import { MediaCard } from "@/components/MediaCard";
import { getLikedMedia, unlikeMedia } from "@/lib/api";
import { MediaItem } from "@/lib/types/media";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

const PAGE_SIZE = 10;

export default function MatchesPage() {
  const { data: session, status } = useSession();
  const [matches, setMatches] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MediaItem | null>(null);
  const detailsTitleId = useId();

  async function loadMatches() {
    setLoading(true);
    try {
      const data = await getLikedMedia(page, PAGE_SIZE);
      setMatches(data.items);
      setHasNext(data.has_next);
    } catch (err) {
      console.error("Failed to load matches:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(item: MediaItem) {
    if (!session?.user?.id) return;

    try {
      await unlikeMedia(item.id);

      setMatches((current) =>
        current.filter((match) => match.id !== item.id)
      );

      if (selectedMatch?.id === item.id) {
        setSelectedMatch(null);
      }
    } catch (err) {
      console.error("Failed to remove match:", err);
    }
  }

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      loadMatches();
      return;
    }

    if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, session?.user?.id, page]);

  if (status === "loading" || loading) return <div className="min-h-screen p-6 text-white">Loading...</div>;
  if (matches.length === 0) return <div className="min-h-screen p-6 text-white">No liked media yet.</div>;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Your Liked Media</h1>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {matches.map((item) => (
          <div key={item.id} className="relative">
            <MediaCard
              item={item}
              onClick={() => setSelectedMatch(item)}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRemove(item);
              }}
              className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-black/70 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
              aria-label={`Remove ${item.title} from liked media`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          disabled={page === 1 || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="rounded-md bg-white/10 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        <span className="text-sm text-white/60">Page {page}</span>

        <button
          disabled={!hasNext || loading}
          onClick={() => setPage((current) => current + 1)}
          className="rounded-md bg-white/10 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {selectedMatch ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailsTitleId}
            className="w-full max-w-5xl max-h-[calc(100vh-4rem)] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <DetailsCard
              item={selectedMatch}
              titleId={detailsTitleId}
              onClose={() => setSelectedMatch(null)}
              opaque
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
