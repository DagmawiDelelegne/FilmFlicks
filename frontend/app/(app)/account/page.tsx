"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import LogoutButton from "@/components/LogoutButton";
import { getAccount, deleteAccount } from "@/lib/api";
import type { Account } from "@/lib/types/media";
import Link from "next/link";
import { BarChart, ChevronRight } from "lucide-react";
import { signOut } from "next-auth/react";

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pictureFailed, setPictureFailed] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      try {
        const data = await getAccount();

        if (!cancelled) {
          setAccount(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your account",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDeleteAccount() {
    if (deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccount();
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Unable to finish deleting your account",
      );
    } finally {
      setDeleting(false);
    }
}

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-white">
      <header>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="mt-2 text-sm text-white/60">
          Manage your profile and preferences.
        </p>
      </header>

      {loading && (
        <p role="status" className="text-white/60">
          Loading your profile...
        </p>
      )}

      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}

      {account && (
        <section
          aria-labelledby="profile-title"
          className="rounded-2xl border border-white/10 bg-white/5 p-6"
        >
          <h2 id="profile-title" className="text-xl font-semibold">
            Profile
          </h2>

          <div className="mt-5 flex items-center gap-4">
            {account.picture && !pictureFailed ? (
              <Image
                src={account.picture}
                alt="Your profile picture"
                width={64}
                height={64}
                unoptimized
                onError={() => setPictureFailed(true)}
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="grid h-16 w-16 shrink-0 place-items-center
                           rounded-full bg-purple-500/20 text-2xl
                           font-semibold text-purple-200"
              >
                {(account.name || account.email).charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="break-words text-lg font-medium">
                {account.name || "Your profile"}
              </p>
              <p className="mt-1 break-words text-sm text-white/60">
                {account.email}
              </p>
            </div>
          </div>
        </section>
      )}
      
      <Link
        href="/stats"
        className="flex items-center gap-4 rounded-2xl
                  border border-white/10 bg-white/5 p-6
                  transition-colors hover:bg-white/10
                  focus-visible:outline-2
                  focus-visible:outline-purple-400"
      >
        <BarChart
          size={24}
          aria-hidden="true"
          className="shrink-0 text-purple-300"
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Your stats</h2>

          <p className="mt-1 text-sm text-white/60">
            Explore your liked genres and streaming services.
          </p>
        </div>

        <ChevronRight
          size={20}
          aria-hidden="true"
          className="shrink-0 text-white/50"
        />
      </Link>

      <section
        aria-labelledby="account-actions-title"
        className="rounded-2xl border border-white/10 bg-white/5 p-6"
      >
        <h2
          id="account-actions-title"
          className="text-xl font-semibold"
        >
          Account actions
        </h2>

        <LogoutButton
          className="mt-5 rounded-lg bg-white/10 px-4 py-3
                     text-sm font-medium hover:bg-white/20 cursor-pointer"
        />
        {account && (
          <details className="mt-6 border-t border-white/10 pt-5">
            <summary
              className="cursor-pointer text-sm text-white/60
                        hover:text-white"
            >
              Account management
            </summary>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  deleteDialogRef.current?.showModal();
                }}
                className="cursor-pointer rounded-lg px-3 py-2
                          text-sm text-red-300 hover:bg-red-500/10"
              >
                Delete account
              </button>
            </div>
          </details>
        )}

        <dialog
          ref={deleteDialogRef}
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-description"
          onCancel={(event) => {
            if (deleting) {
              event.preventDefault();
            }
          }}
          className="m-auto w-[90vw] max-w-md rounded-2xl
                    border border-white/10 bg-neutral-950 p-6
                    text-white backdrop:bg-black/70"
        >
          <h2
            id="delete-account-title"
            className="text-xl font-semibold"
          >
            Delete your account?
          </h2>

          <p
            id="delete-account-description"
            className="mt-3 text-sm leading-6 text-white/70"
          >
            Your FilmFlicks account, genre preferences, likes, and
            dislikes will be permanently deleted. This cannot be undone.
          </p>

          {deleteError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {deleteError}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={deleting}
              onClick={() => deleteDialogRef.current?.close()}
              className="cursor-pointer rounded-lg bg-white/10
                        px-4 py-2 text-sm hover:bg-white/20
                        disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteAccount}
              className="cursor-pointer rounded-lg bg-red-600
                        px-4 py-2 text-sm font-medium hover:bg-red-500
                        disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </dialog>
      </section>

      <footer className="border-t border-white/10 pt-5">
        <nav
          aria-label="Information links"
          className="flex flex-wrap gap-6"
        >
          <Link
            href="/about"
            className="text-sm text-purple-300 hover:underline
                       focus-visible:outline-2
                       focus-visible:outline-offset-4
                       focus-visible:outline-purple-400"
          >
            About FilmFlicks
          </Link>
        </nav>
      </footer>
    </section>
  );
}
