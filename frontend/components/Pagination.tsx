"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  totalPages: number;
  loading: boolean;
  onChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, loading, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Keep the boundary page visible when moving into the next group.
  const start = Math.max(1, Math.floor(page / 5) * 5);
  const end = Math.min(totalPages, start === 1 ? 5 : start + 5);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const buttonClass = "grid h-9 w-9 shrink-0 place-items-center rounded text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-center gap-1">
      <button
        type="button"
        disabled={loading || page <= 1}
        onClick={() => onChange(page - 1)}
        className={`${buttonClass} hover:bg-white/10`}
        aria-label="Previous page"
        title="Previous page"
      >
        <ChevronLeft size={18} />
      </button>
      {pages.map((number) => (
        <button
          key={number}
          type="button"
          disabled={loading}
          onClick={() => onChange(number)}
          aria-label={`Page ${number}`}
          aria-current={page === number ? "page" : undefined}
          className={`${buttonClass} ${page === number ? "bg-purple-600 text-white" : "bg-white/10 hover:bg-white/20"}`}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        disabled={loading || page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={`${buttonClass} hover:bg-white/10`}
        aria-label="Next page"
        title="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
