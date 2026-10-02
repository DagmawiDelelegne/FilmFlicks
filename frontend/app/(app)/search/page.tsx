"use client";

import { useEffect, useState } from "react";
import { SearchCard } from "@/components/SearchCard";
import { searchMovies, getLikedMediaIds, likeMedia, unlikeMedia } from "@/lib/api";
import { MediaItem } from "@/lib/types/media";
import { useSession } from "next-auth/react";

export default function SearchPage() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (!query.trim()) {
        setResults([]);
        return;
      }

      async function runSearch() {
        setLoading(true);
        try {
          const data = await searchMovies(query);
          setResults(data);
        } finally {
          setLoading(false);
        }
      }

      runSearch();
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

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

        {/* Search input */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies..."
          className="w-full rounded-lg bg-white/10 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
        />

        {/* Loading */}
        {loading && (
          <p className="mt-4 text-white/60">Searching...</p>
        )}

        {/* Results */}
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

        {/* Empty state */}
        {!loading && query && results.length === 0 && (
          <p className="mt-6 text-white/50">
            No results found.
          </p>
        )}

      </section>
    </main>
  );
}
