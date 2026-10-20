"use client";

import { useEffect, useState } from "react";
import { SearchCard } from "@/components/SearchCard";
import Pagination from "@/components/Pagination";
import {
  searchMovies,
  getLikedMediaIds,
  likeMedia,
  unlikeMedia,
} from "@/lib/api";
import { MediaItem } from "@/lib/types/media";
import { useSession } from "next-auth/react";

const PAGE_SIZE = 10;

export default function SearchPage() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedMediaIds, setLikedMediaIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function loadLikes() {
      if (!session?.user?.id) return;

      try {
        const liked = await getLikedMediaIds();
        setLikedMediaIds(new Set(liked));
      } catch (err) {
        console.error("Failed to load liked media ids:", err);
      }
    }

    if (status === "authenticated") {
      loadLikes();
    }
  }, [status, session?.user?.id]);

  useEffect(() => {
    const delay = setTimeout(() => {
      const trimmed = query.trim();

      setPage(1);
      setSubmittedQuery(trimmed);

      if (!trimmed) {
        setResults([]);
        setTotalPages(0);
        setError(null);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  useEffect(() => {
    if (!submittedQuery) return;
    let cancelled = false;

    async function runSearch() {
      setLoading(true);
      setError(null);

      try {
        const data = await searchMovies(submittedQuery, page, PAGE_SIZE);
        if (cancelled) return;
        if (page > Math.max(1, data.total_pages)) {
          setPage(Math.max(1, data.total_pages));
          return;
        }
        setResults(data.items);
        setTotalPages(data.total_pages);
      } catch {
        if (!cancelled) setError("Unable to load search results. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    runSearch();
    return () => {
      cancelled = true;
    };
  }, [submittedQuery, page]);

  async function handleLike(item: MediaItem) {
    if (!session?.user?.id) return;

    const alreadyLiked = likedMediaIds.has(item.id);

    setLikedMediaIds((prev) => {
      const updated = new Set(prev);

      if (alreadyLiked) {
        updated.delete(item.id);
      } else {
        updated.add(item.id);
      }

      return updated;
    });

    try {
      if (alreadyLiked) {
        await unlikeMedia(item.id);
      } else {
        await likeMedia(item.id);
      }
    } catch (err) {
      console.error("Failed to update like:", err);

      setLikedMediaIds((prev) => {
        const updated = new Set(prev);

        if (alreadyLiked) {
          updated.add(item.id);
        } else {
          updated.delete(item.id);
        }

        return updated;
      });
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <section className="mx-auto max-w-4xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies..."
          className="w-full rounded-lg bg-white/10 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
        />

        {loading && <p className="mt-4 text-white/60">Searching...</p>}
        {error && <p role="alert" className="mt-4 text-red-400">{error}</p>}

        <div className="mt-6 flex flex-col gap-4">
          {results.map((item) => {
            const isLiked = likedMediaIds.has(item.id);

            return (
              <SearchCard
                key={item.id}
                item={item}
                onLike={handleLike}
                liked={isLiked}
              />
            );
          })}
        </div>

        {!loading && !error && submittedQuery && results.length === 0 && (
          <p className="mt-6 text-white/50">No results found.</p>
        )}

        {submittedQuery && (
          <Pagination page={page} totalPages={totalPages} loading={loading} onChange={setPage} />
        )}
      </section>
    </main>
  );
}
