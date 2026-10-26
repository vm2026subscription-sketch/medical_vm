import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

function photoUrls(images: string[]) {
  return [...new Set(images.map((url) => url.trim()).filter(Boolean))];
}

export function CollegeImage({ images, name }: { images: string[]; name: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = photoUrls(images).find((image) => !failed.includes(image));
  if (!url) return null;
  return (
    <img
      key={url}
      src={url}
      alt={`${name} campus`}
      loading="lazy"
      referrerPolicy="no-referrer"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFailed((previous) => [...previous, url])}
    />
  );
}

export function CollegeGallery({ images, name }: { images: string[]; name: string }) {
  const urls = photoUrls(images);
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const available = urls.filter((url) => !failed.includes(url));
  // Thumbnails probe in parallel: a slow/broken first URL cannot block a working photo.
  const cover =
    selected && available.includes(selected)
      ? selected
      : available.find((url) => loaded.includes(url)) || available[0];
  const markLoaded = (url: string) => {
    setLoaded((previous) => (previous.includes(url) ? previous : [...previous, url]));
    setSelected((previous) => previous ?? url);
  };
  const markFailed = (url: string) => {
    setFailed((previous) => (previous.includes(url) ? previous : [...previous, url]));
    setSelected((previous) => (previous === url ? null : previous));
  };

  return (
    <>
      <div className="flex h-48 items-center justify-center bg-gradient-to-br from-teal-700 to-ink-3 md:h-80">
        {cover ? (
          <img
            key={cover}
            src={cover}
            alt={`${name} campus`}
            fetchPriority="high"
            referrerPolicy="no-referrer"
            decoding="async"
            className="h-full w-full object-cover"
            onLoad={() => markLoaded(cover)}
            onError={() => markFailed(cover)}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-white/80">
            <ImageOff className="size-5" /> Campus photos unavailable
          </p>
        )}
      </div>
      {available.length > 0 && (
        <div className={cn("flex gap-2 overflow-x-auto p-3", urls.length === 1 && "hidden")}>
          {available.map((url) => (
            <button
              key={url}
              type="button"
              aria-label={`View campus photo ${urls.indexOf(url) + 1}`}
              aria-pressed={cover === url}
              onClick={() => setSelected(url)}
              className={cn(
                "shrink-0 overflow-hidden rounded-lg border-2",
                cover === url ? "border-teal-600" : "border-transparent",
              )}
            >
              <img
                src={url}
                referrerPolicy="no-referrer"
                alt={`Campus photo ${urls.indexOf(url) + 1}`}
                decoding="async"
                className="h-14 w-20 object-cover"
                onLoad={() => markLoaded(url)}
                onError={() => markFailed(url)}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
