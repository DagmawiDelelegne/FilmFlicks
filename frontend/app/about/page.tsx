import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | FilmFlicks",
  description: "Learn about FilmFlicks and its media data sources.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-10">
        <Link
          href="/"
          className="inline-block text-sm text-purple-300 hover:underline"
        >
          Back to FilmFlicks
        </Link>

        <header className="space-y-4">
          <h1 className="text-4xl font-semibold">About FilmFlicks</h1>

          <p className="leading-7 text-white/75">
            FilmFlicks helps you discover movies, TV shows, and anime
            through personalized recommendations.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How it works</h2>

          <p className="leading-7 text-white/75">
            Choose genres you enjoy, explore recommendations, and like
            or dislike titles. FilmFlicks uses your preferences and
            feedback to help you find more media to explore.
          </p>
        </section>

        <section className="space-y-4 border-t border-white/15 pt-8">
          <h2 className="text-xl font-semibold">Media data and images</h2>

          <a
            href="https://www.themoviedb.org/"
            className="inline-block"
          >
            <Image
              src="/tmdb.svg"
              alt="TMDB"
              width={128}
              height={32}
              className="h-8 w-32 object-contain object-left"
            />
          </a>

          <p className="leading-7 text-white/75">
            This product uses the TMDB API but is not endorsed or
            certified by TMDB.
          </p>
        </section>

        <section className="space-y-3 border-t border-white/15 pt-8">
          <h2 className="text-xl font-semibold">
            Streaming availability
          </h2>

          <p className="leading-7 text-white/75">
            Streaming availability data is provided by{" "}
            <a
              href="https://www.justwatch.com/"
              className="text-purple-300 hover:underline"
            >
              JustWatch
            </a>{" "}
            through TMDB. Availability varies by country and may change.
          </p>
        </section>
      </div>
    </main>
  );
}