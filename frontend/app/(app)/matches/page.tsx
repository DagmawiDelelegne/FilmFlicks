"use client";

import { useEffect, useId, useState } from "react";
import { DetailsCard } from "@/components/DetailsCard";
import { MediaCard } from "@/components/MediaCard";
import Pagination from "@/components/Pagination";
import { getLikedMedia, unlikeMedia } from "@/lib/api";
import { MediaItem } from "@/lib/types/media";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

const PAGE_SIZE = 10;

export default function MatchesPage() {
  const { data: session, status } = useSession();
  const [matches, setMatches] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [reloadCount, setReloadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MediaItem | null>(null);
  const detailsTitleId = useId();

  async function handleRemove(item: MediaItem) {
    if (!session?.user?.id) return;

    try {
      await unlikeMedia(item.id);

      setReloadCount((count) => count + 1);

      if (selectedMatch?.id === item.id) {
        setSelectedMatch(null);
      }
    } catch (err) {
      console.error("Failed to remove match:", err);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      setLoading(true);
      try {
        const data = await getLikedMedia(page, PAGE_SIZE);
        if (cancelled) return;
        if (page > Math.max(1, data.total_pages)) {
          setPage(Math.max(1, data.total_pages));
          return;
        }
        setMatches(data.items);
        setTotalPages(data.total_pages);
      } catch (err) {
        console.error("Failed to load matches:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (status === "authenticated" && session?.user?.id) {
      loadMatches();
    }

    if (status === "unauthenticated") {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, page, reloadCount]);

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

      <Pagination page={page} totalPages={totalPages} loading={loading} onChange={setPage} />

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
