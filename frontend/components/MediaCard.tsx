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
    ? "flex h-full min-h-0 min-w-0 w-full items-center justify-center [container-type:inline-size]"
    : "relative block w-full max-w-md overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10";

  const cardContent = isDiscovery ? (
      <div className="relative aspect-[2/3] h-full max-h-[150cqw] max-w-full overflow-hidden rounded-lg bg-black">
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-3 text-left sm:p-4">
          <h2
            className="line-clamp-2 break-words text-lg leading-6 font-semibold"
            title={item.title}
          >
            {item.title}
          </h2>
          <p className="mt-1 text-xs text-white/70">
            {getMediaDisplayType(item)}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-xs">
            {streamingService && (
              <span
                className="max-w-[45%] shrink-0 truncate rounded bg-emerald-500/20 px-2 py-1 text-emerald-100"
                title={streamingService}
              >
                {streamingService}
              </span>
            )}
            <span className="min-w-0 truncate text-white/85" title={item.genres.join(", ")}>
              {item.genres.slice(0, 3).join(", ")}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 italic text-white/85 [@media(max-height:600px)]:hidden">
            {item.overview}
          </p>
        </div>
      </div>
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
