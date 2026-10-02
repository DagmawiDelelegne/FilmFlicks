import {getMediaDisplayType, type MediaItem } from "@/lib/types/media";

type SearchCardProps = {
  item: MediaItem;
  onLike?: (item: MediaItem) => void;
  liked?: boolean;
};

export function SearchCard({ item, onLike, liked }: SearchCardProps) {
  return (
    <div className="w-full rounded-lg bg-white/5 p-4 ring-1 ring-white/10 flex gap-4">
      <img src={item.thumbnail_url} 
      alt={`${item.title} poster`}
      className="h-28 w-20 rounded-md object-cover bg-white/10 shrink-0" 
      />

      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold">
          {item.title}
        </h3>
        <p className="text-sm text-white/60">
          {getMediaDisplayType(item)}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-white/70">
          {item.overview}
        </p>
      </div>

      <button
        onClick={() => onLike?.(item)}
        className={`h-10 rounded-full px-4 text-sm transition shrink-0 ${
          liked
            ? "bg-white text-black hover:bg-white/80"
            : "bg-green-600 text-white hover:bg-green-500"
        }`}
      >
        {liked ? "Liked" : "Like"}
      </button>
    </div>
  );
}
