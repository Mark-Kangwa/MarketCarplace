import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import AutoRefresh from "@/components/auto-refresh";
import CarCard from "@/components/car-card";
import FavoriteListSection from "@/components/favorite-list-section";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isSoldVisible } from "@/lib/search";
import { getSetting } from "@/lib/settings";

function isLive(car: { status: string; soldAt: Date | null }, soldDays: number): boolean {
  return car.status === "PUBLISHED" || (car.status === "SOLD" && isSoldVisible(car.soldAt, new Date(), soldDays));
}

export const dynamic = "force-dynamic";

function toCard(car: {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  priceZmw: number;
  mileageKm: number;
  transmission: string;
  fuel: string;
  condition: string;
  photos: unknown;
  isFeatured: boolean;
  status: string;
}) {
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    variant: car.variant,
    year: car.year,
    priceZmw: car.priceZmw,
    mileageKm: car.mileageKm,
    transmission: String(car.transmission),
    fuel: String(car.fuel),
    condition: String(car.condition),
    photos: car.photos,
    isFeatured: car.isFeatured,
    isFavorite: true,
    sold: car.status === "SOLD"
  };
}

export default async function FavouritesPage(): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login");
  }
  const [lists, unsorted] = await Promise.all([
    prisma.favoriteList.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "asc" },
      include: { favorites: { orderBy: { createdAt: "desc" }, include: { car: true } } }
    }),
    prisma.favorite.findMany({
      where: { userId: session.id, listId: null },
      orderBy: { createdAt: "desc" },
      include: { car: true }
    })
  ]);
  const soldDays = await getSetting("soldGraceDays");
  const visibleLists = lists
    .map((l) => ({ ...l, cars: l.favorites.filter((f) => isLive(f.car, soldDays)) }))
    .filter((l) => l.cars.length > 0);
  const unsortedCars = unsorted.filter((f) => isLive(f.car, soldDays));
  const total = visibleLists.reduce((n, l) => n + l.cars.length, 0) + unsortedCars.length;

  return (
    <AccountShell
      active="favourites"
      crumb="Favourites"
      title="Favourites"
      subtitle={total === 0 ? "Cars you save will appear here, organised by your lists." : `${total} saved car${total === 1 ? "" : "s"} across ${visibleLists.length + (unsortedCars.length > 0 ? 1 : 0)} list${visibleLists.length + (unsortedCars.length > 0 ? 1 : 0) === 1 ? "" : "s"}.`}
    >
      <AutoRefresh />
      {total === 0 ? (
        <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
          <p className="font-semibold text-asphalt">No favourites yet.</p>
          <p className="mt-1">Tap the heart on any listing, then pick or create a list to organise it.</p>
          <Link href="/#listings" className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Browse cars</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleLists.map((l) => (
            <FavoriteListSection key={l.id} id={l.id} name={l.name}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {l.cars.map(({ car }) => (
                  <CarCard key={car.id} signedIn refreshOnToggle car={toCard(car)} />
                ))}
              </div>
            </FavoriteListSection>
          ))}
          {unsortedCars.length > 0 ? (
            <section aria-label="Unsorted favourites">
              <h2 className="mb-3 text-xl font-bold">Unsorted</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {unsortedCars.map(({ car }) => (
                  <CarCard key={car.id} signedIn refreshOnToggle car={toCard(car)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AccountShell>
  );
}
