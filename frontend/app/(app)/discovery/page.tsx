"use client";

import { useEffect, useRef, useState } from "react";
import { MediaCard } from "@/components/MediaCard";
import { DetailsCard } from "@/components/DetailsCard";
import { Heart, X, ArrowRight, RotateCcw, Undo2, Info } from "lucide-react";
import { getRec, sendFeedback, getOnboarding, saveOnboarding, undoFeedback } from "@/lib/api";
import type { MediaItem, OnboardingStatus } from "@/lib/types/media";
import { useSession } from "next-auth/react";

const RECOMMENDATION_BATCH_SIZE = 3;

const GENRES = [
  "Action", "Action & Adventure", "Adventure", "Animation", "Comedy", "Crime",
  "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Kids",
  "Music", "Mystery", "News", "Reality", "Romance", "Science Fiction",
  "Sci-Fi & Fantasy", "Soap", "Talk", "Thriller", "TV Movie", "War",
  "War & Politics", "Western",
];

async function fetchRecommendationBatch(existingIds = new Set<number>()): Promise<MediaItem[]> {
  const needed = Math.max(0, RECOMMENDATION_BATCH_SIZE - existingIds.size);
  if (needed == 0) return [];

  const recommendations = await getRec(needed,Array.from(existingIds));
  return recommendations;
}

export default function DiscoveryPage() {
  const { data: session, status } = useSession();
  const detailsDialog = useRef<HTMLDialogElement>(null);

  const [item, setItem] = useState<MediaItem | null>(null);
  const [queue, setQueue] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedbackItem, setLastFeedbackItem] = useState<MediaItem | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDiscovery() {
      setLoading(true);
      setError(null);
      setOnboarding(null);
      setItem(null);
      setQueue([]);
      setCanUndo(false);
      setLastFeedbackItem(null);

      try {
        const data = await getOnboarding();
        if (cancelled) return;
        setOnboarding(data);
        setSelectedGenres(data.preferred_genres.map(String));

        if (!data.onboarding_completed) return;

        const recommendations = await fetchRecommendationBatch();
        if (cancelled) return;

        const [first, ...rest] = recommendations;
        setItem(first ?? null);
        setQueue(rest);
      } catch (err) {
        console.error("Failed to load discovery:", err);
        if (!cancelled) {
          setError("Unable to load discovery. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (status === "authenticated" && session?.user?.id) {
      loadDiscovery();
    }

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, retryCount]);

  async function completeOnboarding(genres: string[]) {
    if (!onboarding || savingOnboarding) return;
    setSavingOnboarding(true);
    setError(null);

    try {
      await saveOnboarding(genres);
      setRetryCount((count) => count + 1);
    } catch {
      setError("Unable to save genre preferences. Please try again.");
    } finally {
      setSavingOnboarding(false);
    }
  }

  async function handleFeedback(action: "like" | "dislike") {
    if (!item || !session?.user?.id || submitting || undoing) return;

    const feedbackItem = item;
    setSubmitting(true);

    try {
      await sendFeedback({
        media_id: feedbackItem.id,
        action,
      });
    } catch (err) {
      console.error("Feedback was not saved:", err);
      setSubmitting(false);
      return;
    }

    const [nextFromQueue, ...remainingQueue] = queue;
    const nextItem = nextFromQueue ?? null;

    setLastFeedbackItem(feedbackItem);
    setCanUndo(true);
    setItem(nextItem);
    setQueue(remainingQueue);

    const existingIds = new Set(remainingQueue.map((media) => media.id));

    if (nextItem) {
      existingIds.add(nextItem.id);
    }
    try {
      const replacements = await fetchRecommendationBatch(existingIds);

      if (nextItem) {
        setQueue([...remainingQueue, ...replacements]);
      } else {
        const [first, ...rest] = replacements;
        setItem(first ?? null);
        setQueue(rest);
      }
    } catch (err) {
      console.error("Feedback saved, but recommendations could not refill:", err);
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
        (currentItem ? [currentItem, ...currentQueue] : currentQueue)
        .slice(0,RECOMMENDATION_BATCH_SIZE-1)
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

  if (status === "loading" || loading) {
    return <div className="text-white p-6" role="status">Loading...</div>;
  }

  if (error && (!onboarding || onboarding.onboarding_completed)) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <p role="alert">{error}</p>
        <button
          onClick={() => setRetryCount((count) => count + 1)}
          className="mt-4 inline-flex items-center gap-2 rounded border border-white/30 px-4 py-2"
        >
          <RotateCcw size={16} /> Retry
        </button>
      </main>
    );
  }

  if (onboarding && !onboarding.onboarding_completed) {
    return (
      <main className="min-h-screen bg-black text-white">
        <section className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-semibold">Your Genres</h1>
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              void completeOnboarding(selectedGenres);
            }}
          >
            <fieldset disabled={savingOnboarding}>
              <legend className="mb-4 text-sm text-white/70">Genre preferences</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {GENRES.map((genre) => (
                  <label key={genre} className="flex min-h-11 items-center gap-3 border-b border-white/15 py-2">
                    <input
                      type="checkbox"
                      checked={selectedGenres.includes(genre)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedGenres((current) => checked
                          ? [...current, genre]
                          : current.filter((selected) => selected !== genre));
                      }}
                      className="h-4 w-4 shrink-0 accent-green-500"
                    />
                    <span className="min-w-0 break-words">{genre}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p role="alert" className="mt-4 text-red-400">{error}</p>}
            <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-4 border-t border-white/15 bg-black py-4">
              <button
                type="submit"
                disabled={savingOnboarding || selectedGenres.length === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded bg-green-600 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingOnboarding ? "Saving..." : "Continue"} <ArrowRight size={16} />
              </button>
              <button
                type="button"
                disabled={savingOnboarding}
                onClick={() => void completeOnboarding([])}
                className="min-h-11 px-2 py-2 text-white/70 hover:text-white disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        No media found.
      </main>
    );
  }

  const actionClass =
    "grid h-12 w-12 shrink-0 place-items-center rounded-full cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section
      aria-label="Discovery"
      className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-lg flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-white"
    >
      <div className="min-h-0 flex-1">
        <MediaCard item={item} disableLink layout="discovery" />
      </div>

      <div className="flex h-12 shrink-0 items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => handleFeedback("dislike")}
          disabled={submitting || undoing}
          className={`${actionClass} bg-red-600 hover:bg-red-500`}
          aria-label="Dislike"
          title="Dislike"
        >
          <X size={26} />
        </button>

        <button
          type="button"
          onClick={undo}
          disabled={!canUndo || submitting || undoing}
          className={`${actionClass} bg-white/10 hover:bg-white/20`}
          aria-label="Undo previous feedback"
          title={undoing ? "Undoing..." : "Undo previous feedback"}
          aria-busy={undoing}
        >
          <Undo2 size={22} />
        </button>

        <button
          type="button"
          onClick={() => handleFeedback("like")}
          disabled={submitting || undoing}
          className={`${actionClass} bg-green-600 hover:bg-green-500`}
          aria-label="Like"
          title="Like"
        >
          <Heart size={26} />
        </button>

        <button
          type="button"
          onClick={() => detailsDialog.current?.showModal()}
          className={`${actionClass} bg-white/10 hover:bg-white/20`}
          aria-label="Show media details"
          title="Show media details"
          aria-haspopup="dialog"
        >
          <Info size={22} />
        </button>
      </div>

      <dialog
        ref={detailsDialog}
        aria-labelledby="discovery-details-title"
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-lg border border-white/15 bg-black p-0 text-white backdrop:bg-black/75"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            detailsDialog.current?.close();
          }
        }}
      >
        <DetailsCard
          item={item}
          titleId="discovery-details-title"
          opaque
          onClose={() => detailsDialog.current?.close()}
        />
      </dialog>
    </section>
  );
}
