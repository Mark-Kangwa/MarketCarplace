"use client";

import { useState } from "react";

export default function CarGallery({ photos, title }: { photos: string[]; title: string }): JSX.Element {
  const [active, setActive] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="relative aspect-[16/10] bg-lot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://placehold.co/1024x640/e2e5ea/0F1F38?text=${encodeURIComponent(title)}`}
            alt={title}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    );
  }
  const prev = (): void => setActive((i) => (i - 1 + photos.length) % photos.length);
  const next = (): void => setActive((i) => (i + 1) % photos.length);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="relative aspect-[16/10] bg-lot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[active]} alt={`${title} — photo ${active + 1}`} className="h-full w-full object-cover" />
        <span className="absolute left-3 top-3 rounded bg-asphalt/85 px-2 py-0.5 text-xs text-white">
          {active + 1} / {photos.length}
        </span>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-asphalt/70 px-3 py-1.5 text-lg font-bold text-white hover:bg-asphalt"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-asphalt/70 px-3 py-1.5 text-lg font-bold text-white hover:bg-asphalt"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-t border-line p-2" role="listbox" aria-label="Listing photos">
          {photos.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
              aria-selected={i === active}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${i === active ? "border-trader" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
