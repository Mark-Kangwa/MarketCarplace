import Link from "next/link";
import { zmw, km } from "@/lib/format";
import FavoriteButton from "@/components/favorite-button";

export type CardCar = {
  id: string;
  make: string;
  model: string;
  variant?: string | null;
  year: number;
  priceZmw: number;
  mileageKm: number;
  transmission: string;
  fuel: string;
  condition: string;
  photos: unknown;
  isFeatured?: boolean;
  isFavorite?: boolean;
  sold?: boolean;
};

export default function CarCard({ car, signedIn, refreshOnToggle }: { car: CardCar; signedIn?: boolean; refreshOnToggle?: boolean }): JSX.Element {
  const photos = Array.isArray(car.photos) ? (car.photos as string[]) : [];
  const img = photos[0] ?? `https://placehold.co/640x400/e2e5ea/0F1F38?text=${encodeURIComponent(car.make + " " + car.model)}`;
  const title = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;
  return (
    <Link href={`/listing/${car.id}`} aria-label={`View details: ${title}`} className="block h-full rounded-lg focus-visible:outline-2">
      <article className={`h-full overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md ${car.isFeatured ? "border-amber-400 ring-1 ring-amber-300" : "border-line"} ${car.sold ? "opacity-90" : ""}`}>
        <div className="relative aspect-[16/10] bg-lot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={title} className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute left-2 top-2 rounded bg-asphalt/85 px-2 py-0.5 text-xs text-white">
            {photos.length || 1} photos
          </span>
          {car.sold ? (
            <span className="absolute left-2 top-8 rounded bg-signal px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Sold
            </span>
          ) : null}
          <FavoriteButton carId={car.id} initial={car.isFavorite ?? false} signedIn={signedIn ?? false} variant="icon" refreshOnToggle={refreshOnToggle} />
          {car.isFeatured ? (
            <span className="absolute bottom-2 left-2 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-asphalt">
              ★ Featured
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5 p-3">
          <p className="tabular text-lg font-bold text-asphalt">{zmw(car.priceZmw)}</p>
          <h3 className="text-sm font-semibold leading-snug">
            {car.year} {car.make} {car.model}
            {car.variant ? <span className="font-normal text-gray-600"> {car.variant}</span> : null}
          </h3>
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
            <li>{car.condition}</li>
            <li>{km(car.mileageKm)}</li>
            <li className="capitalize">{car.transmission.toLowerCase()}</li>
            <li className="capitalize">{car.fuel.toLowerCase()}</li>
          </ul>
        </div>
      </article>
    </Link>
  );
}
