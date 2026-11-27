"use client"

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoginButtons from "@/components/LoginButtons";
import Link from "next/link";

export default function Home() {

  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/discovery");
    }
  }, [status, router]);

  if (status === "loading") {
    return null;
  }

  if (session) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <LoginButtons />
      <p className="max-w-md text-sm leading-6 text-white/70">
        Discover movies, TV shows, and anime based on your interests.
      </p>

      <Link
        href="/about"
        className="text-sm text-purple-300 hover:underline"
      >
        About FilmFlicks
      </Link>
    </main>
  );
}