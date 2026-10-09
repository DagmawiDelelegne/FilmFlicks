"use client";

import { useEffect, useState } from "react";
import { MediaCard } from "@/components/MediaCard";
import { DetailsCard } from "@/components/DetailsCard";
import UndoButton from "@/components/UndoButton";
import { Heart, X } from "lucide-react";
import { getRec, sendFeedback, getLikedCount, undoFeedback } from "@/lib/api";
import { MediaItem } from "@/lib/types/media";
import { useSession } from "next-auth/react";

const RECOMMENDATION_BATCH_SIZE = 10;
const QUEUE_REFILL_THRESHOLD = 3;

async function fetchRecommendationBatch(existingIds = new Set<number>()) {
  const recommendations = await getRec(RECOMMENDATION_BATCH_SIZE);
  return recommendations.filter((media) => !existingIds.has(media.id));
}

export default function DiscoveryPage() {
  const { data: session, status } = useSession();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [queue, setQueue] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedCount, setLikedCount] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedbackItem, setLastFeedbackItem] = useState<MediaItem | null>(
    null
  );

  useEffect(() => {
    async function loadCount() {
      if (!session?.user?.id) return;

      try {
        const count = await getLikedCount();
        setLikedCount(count);
      } catch (err) {
        console.error("Failed to load liked count:", err);
      }
    }

    if (status === "authenticated") {
      loadCount();
    }
  }, [status, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      if (!session?.user?.id) return;
      if (likedCount === null || likedCount < 5) return;

      setLoading(true);

      try {
        const recommendations = await fetchRecommendationBatch();
        if (cancelled) return;

        const [first, ...rest] = recommendations;
        setItem(first ?? null);
        setQueue(rest);
      } catch (err) {
        console.error("Failed to load recommendations:", err);
        if (!cancelled) {
          setItem(null);
          setQueue([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (status === "authenticated") {
      loadRecommendations();
    }

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, likedCount]);

  async function handleFeedback(action: "like" | "dislike") {
    if (!item || !session?.user?.id || submitting) return;

    const feedbackItem = item;
    setSubmitting(true);

    try {
      await sendFeedback({
        media_id: feedbackItem.id,
        action,
      });

      const [nextFromQueue, ...remainingQueue] = queue;
      let nextItem = nextFromQueue ?? null;
      let nextQueue = remainingQueue;

      if (!nextItem || nextQueue.length <= QUEUE_REFILL_THRESHOLD) {
        const existingIds = new Set(nextQueue.map((media) => media.id));

        if (nextItem) {
          existingIds.add(nextItem.id);
        }

        const moreRecommendations = await fetchRecommendationBatch(existingIds);

        if (!nextItem) {
          const [firstMore, ...restMore] = moreRecommendations;
          nextItem = firstMore ?? null;
          nextQueue = restMore;
        } else {
          nextQueue = [...nextQueue, ...moreRecommendations];
        }
      }

      setLastFeedbackItem(feedbackItem);
      setItem(nextItem);
      setQueue(nextQueue);
      setCanUndo(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function undo() {
    if (!canUndo || undoing || !lastFeedbackItem) return;

    setUndoing(true);

    try {
      await undoFeedback();

      const currentItem = item;
      setItem(lastFeedbackItem);
      setQueue((currentQueue) =>
        currentItem ? [currentItem, ...currentQueue] : currentQueue
      );
      setLastFeedbackItem(null);
      setCanUndo(false);
    } finally {
      setUndoing(false);
    }
  }

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Please sign in to use discovery.
      </main>
    );
  }

  if (likedCount !== null && likedCount < 5) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">
            Please search and select at least 5 movies
          </h1>
          <p className="mt-2 text-white/60">
            You've selected {likedCount} so far
          </p>
        </div>
      </main>
    );
  }

  if (loading || likedCount === null) {
    return <div className="text-white p-6">Loading...</div>;
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        No media found.
      </main>
    );
  }

  const iconClass =
    "h-9 w-9 text-white-500 transition-colors hover:text-white-800";

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6">
        <div className="mt-5 w-full flex justify-center">
          <MediaCard item={item} disableLink />
        </div>

        <div className="mt-4 flex items-center gap-10">
          <button
            onClick={() => handleFeedback("dislike")}
            disabled={submitting || undoing}
            className="grid h-15 w-15 place-items-center rounded-full bg-red-600/90 text-3xl shadow-lg ring-1 ring-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Dislike"
          >
            <X className={iconClass} />
          </button>

          <button
            onClick={() => handleFeedback("like")}
            disabled={submitting || undoing}
            className="grid h-15 w-15 place-items-center rounded-full bg-green-600/90 text-3xl shadow-lg ring-1 ring-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Like"
          >
            <Heart className={iconClass} />
          </button>
        </div>

        <UndoButton
          disabled={!canUndo || submitting}
          loading={undoing}
          onClick={undo}
        />

        <div className="mt-6 w-full mb-6">
          <DetailsCard item={item} />
        </div>
      </section>
    </main>
  );
}
