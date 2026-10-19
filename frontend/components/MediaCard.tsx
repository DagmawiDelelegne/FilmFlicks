"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getMediaDisplayType, type MediaItem } from "@/lib/types/media";

type MediaCardProps = {
  item: MediaItem;
  onClick?: () => void;
  disableLink?: boolean;
  layout?: "discovery" | "default";
};

const FALLBACK_IMAGE = "/thumbnail_resources/not_found_cat.png";

function resolveThumbnailUrl(thumbnailUrl: string) {
  const src = thumbnailUrl?.trim();

  if (!src || ["nan", "none", "null"].includes(src.toLowerCase())) {
    return FALLBACK_IMAGE;
  }

  if (src.startsWith("http") || src.startsWith("/")) {
    return src;
  }

  return `https://image.tmdb.org/t/p/w500${src}`;
}

export function MediaCard({ item, onClick, disableLink = false, layout = "default" }: MediaCardProps) {
  const isDiscovery = layout === "discovery";

  const href = `/media/${encodeURIComponent(item.title)}`;
  const resolvedImgSrc = resolveThumbnailUrl(item.thumbnail_url);
  const [failedImgSrc, setFailedImgSrc] = useState<string | null>(null);
  const imgSrc =
    failedImgSrc === resolvedImgSrc ? FALLBACK_IMAGE : resolvedImgSrc;

  const streamingService = item.streaming_service?.trim();
  const className = isDiscovery
    ? "flex h-full min-h-0 min-w-0 w-full flex-col gap-2"
    : "relative block w-full max-w-md overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10";

  const cardContent = isDiscovery ? (
    <>
      <div className="relative min-h-0 flex-1">
        <Image
          src={imgSrc}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 90vw, 450px"
          className="object-contain"
          priority
          onError={() => {
            if (resolvedImgSrc !== FALLBACK_IMAGE) {
              setFailedImgSrc(resolvedImgSrc);
            }
          }}
        />
      </div>

      <h2
        className="line-clamp-2 h-14 shrink-0 break-words text-center text-lg leading-7 font-semibold"
        title={item.title}
      >
        {item.title}
      </h2>
    </>
  ) : (
    <>
      <div className="relative h-[600px] w-full">
        <Image
          src={imgSrc}
          alt={item.title}
          fill
          className="object-cover"
          priority
          onError={() => {
            if (resolvedImgSrc !== FALLBACK_IMAGE) {
              setFailedImgSrc(resolvedImgSrc);
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      </div>

      <div className="absolute bottom-0 w-full p-6">
        <h2 className="text-4xl font-bold leading-tight">{item.title}</h2>

        <p className="mt-1 text-sm text-white/70">
          {getMediaDisplayType(item)}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {streamingService ? (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-100 ring-1 ring-emerald-300/30">
              {streamingService}
            </span>
          ) : null}

          {(item.genres ?? []).slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/15"
            >
              {genre}
            </span>
          ))}
        </div>

        <p className="mt-4 line-clamp-2 text-sm italic text-white/85">
          &ldquo;{item.overview}&rdquo;
        </p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer border-0 p-0 text-left`}
        aria-haspopup="dialog"
      >
        {cardContent}
      </button>
    );
  }

  if (disableLink) {
    return <div className={className}>{cardContent}</div>;
  }

  return (
    <Link href={href} className={className}>
      {cardContent}
    </Link>
  );
}
