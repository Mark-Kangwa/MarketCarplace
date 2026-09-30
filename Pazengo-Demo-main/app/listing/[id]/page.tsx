import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CarCard from "@/components/car-card";
import CarGallery from "@/components/car-gallery";
import ContactSeller from "@/components/contact-seller";
import FavoriteButton from "@/components/favorite-button";
import SiteHeader from "@/components/site-header";
import { getUserSession } from "@/lib/auth";
import { maskPhone } from "@/lib/phone";
import { prisma, dbOk } from "@/lib/db";
import { zmw, km, timeAgo } from "@/lib/format";
import { serviceHistoryLabel } from "@/lib/validators";
import { isSoldVisible, notExpiredWhere, visibleCarWhere } from "@/lib/search";
import { getSetting } from "@/lib/settings";
import { provinceOf } from "@/lib/zambia";

export const dynamic = "force-dynamic";

type Params = { id: string };

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function maskChassis(chassisNo: string | null): string {
  if (!chassisNo) return "—";
  if (chassisNo.length <= 5) return "•••••";
  return `•••••${chassisNo.slice(-5)}`;
}

async function getCar(id: string) {
  if (!(await dbOk())) return null;
  return prisma.car.findUnique({
    where: { id },
    include: {
      dealer: { select: { name: true, phone: true } },
      owner: { select: { name: true, phone: true } }
    }
  });
}

function isCarPublic(car: { status: string; soldAt: Date | null; expiresAt: Date | null }, soldDays: number): boolean {
  if (car.expiresAt && new Date(car.expiresAt).getTime() <= Date.now()) return false;
  if (car.status === "PUBLISHED") return true;
  if (car.status === "SOLD") return isSoldVisible(car.soldAt, new Date(), soldDays);
  return false;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const car = await getCar(params.id);
  if (!car || !isCarPublic(car, await getSetting("soldGraceDays"))) {
    return { title: "Listing not found — Pazengo" };
  }
  const title = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;
  if (car.status === "SOLD") {
    return {
      title: `${title} (sold) — Pazengo`,
      description: `${title}, ${km(car.mileageKm)}, ${car.transmission.toLowerCase()}, ${car.fuel.toLowerCase()}. This car has been sold.`
    };
  }
  return {
    title: `${title} for sale at ${zmw(car.priceZmw)} — Pazengo`,
    description: `${title}, ${km(car.mileageKm)}, ${car.transmission.toLowerCase()}, ${car.fuel.toLowerCase()}.`
  };
}

export default async function ListingPage({ params }: { params: Params }): Promise<JSX.Element> {
  const car = await getCar(params.id);
  if (!car) {
    if (!(await dbOk())) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">Database not connected. Start Postgres and try again.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-trader">← Back to listings</Link>
        </div>
      );
    }
    notFound();
  }
  if (!isCarPublic(car, await getSetting("soldGraceDays"))) notFound();

  const user = await getUserSession();
  let isFavorite = false;
  if (user) {
    // Record this view (bump recency), then prune history beyond the newest 20.
    await prisma.recentView.upsert({
      where: { userId_carId: { userId: user.id, carId: car.id } },
      update: { viewedAt: new Date() },
      create: { userId: user.id, carId: car.id }
    });
    const stale = await prisma.recentView.findMany({
      where: { userId: user.id },
      orderBy: { viewedAt: "desc" },
      select: { id: true },
      skip: 20
    });
    if (stale.length > 0) {
      await prisma.recentView.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    }
    isFavorite = (await prisma.favorite.findUnique({
      where: { userId_carId: { userId: user.id, carId: car.id } },
      select: { id: true }
    })) !== null;
  }
  const photos = parseStringArray(car.photos);
  const features = parseStringArray(car.features);
  const title = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;
  // User-submitted cars show their owner; admin stock falls back to the
  // dealer contact, then the site-wide fallback.
  const dealerName = car.owner?.name ?? car.dealer?.name ?? process.env.SITE_CONTACT_NAME ?? "Pazengo dealer";
  const dealerPhone = car.owner?.phone ?? car.dealer?.phone ?? process.env.SITE_CONTACT_PHONE ?? null;

  const similar = await prisma.car.findMany({
    where: {
      AND: [
        visibleCarWhere(await getSetting("soldGraceDays")),
        notExpiredWhere(),
        { id: { not: car.id }, OR: [{ make: car.make }, { bodyType: car.bodyType }] }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 4
  });
  const similarFavIds = new Set<string>(
    user
      ? (await prisma.favorite.findMany({ where: { userId: user.id }, select: { carId: true } })).map((r) => r.carId)
      : []
  );

  const keySpecs = [
    { label: "Mileage", value: km(car.mileageKm) },
    { label: "Transmission", value: car.transmission.charAt(0) + car.transmission.slice(1).toLowerCase() },
    { label: "Fuel", value: car.fuel.charAt(0) + car.fuel.slice(1).toLowerCase() },
    { label: "Body type", value: car.bodyType },
    { label: "Condition", value: car.condition.charAt(0) + car.condition.slice(1).toLowerCase() },
    { label: "Colour", value: car.color || "—" }
  ];

  const specRows: Array<[string, string]> = [
    ["Make", car.make],
    ["Model", car.model],
    ["Variant", car.variant || "—"],
    ["Year", String(car.year)],
    ["Drivetrain", car.drivetrain || "—"],
    ["Location", car.location || "—"],
    ["Seats", `${car.seats} seats`],
    ["Service history", serviceHistoryLabel(car.serviceHistory)],
    ["Price", zmw(car.priceZmw)],
    ["Chassis number", maskChassis(car.chassisNo)],
    ["Listed", timeAgo(car.createdAt)]
  ];

  // Custom attributes from Vehicle Config, labelled by their form fields.
  const attrs = (car.attributes ?? {}) as Record<string, unknown>;
  const extraRows: Array<[string, string]> = [];
  if (car.vehicleTypeId && Object.keys(attrs).length > 0) {
    const typeFields = await prisma.vehicleTypeField.findMany({
      where: { vehicleTypeId: car.vehicleTypeId },
      include: { field: true }
    });
    const byKey = new Map(typeFields.map((t) => [t.field.key, t.field]));
    for (const [key, raw] of Object.entries(attrs)) {
      if (raw === null || raw === undefined || raw === "") continue;
      const field = byKey.get(key);
      const label = field?.label ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      const unit = field?.unit ? ` ${field.unit}` : "";
      const value = typeof raw === "boolean" ? (raw ? "Yes" : "No") : Array.isArray(raw)
        ? raw.filter((x): x is string => typeof x === "string").join(", ") || "—"
        : `${typeof raw === "number" ? raw.toLocaleString("en-ZA") : String(raw)}${unit}`;
      extraRows.push([label, value]);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/#listings" className="hover:text-trader">Buy a car</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">{title}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-asphalt px-2 py-0.5 text-xs font-semibold text-white">{car.condition}</span>
              <span className="text-xs text-gray-500">Listed {timeAgo(car.createdAt)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">{car.bodyType} · {car.color || "Colour not listed"} · {km(car.mileageKm)}</p>
            {car.status === "SOLD" ? (
              <p role="status" className="mt-2 inline-block rounded bg-signal px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Sold{car.soldAt ? ` · ${new Date(car.soldAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </p>
            ) : null}
            <nav aria-label="Listing location and vehicle" className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
              <span aria-hidden="true">📍</span>
              {(() => {
                const crumbs: { label: string; href: string }[] = [];
                const province = car.location ? provinceOf(car.location) : null;
                if (province) crumbs.push({ label: `${province} Province`, href: `/?province=${encodeURIComponent(province)}#listings` });
                if (car.location) crumbs.push({ label: car.location, href: `/?location=${encodeURIComponent(car.location)}#listings` });
                crumbs.push({ label: car.make, href: `/?make=${encodeURIComponent(car.make)}#listings` });
                crumbs.push({ label: car.model, href: `/?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}#listings` });
                return crumbs.map((c, i) => (
                  <span key={c.href} className="inline-flex items-center gap-1.5">
                    {i > 0 ? <span aria-hidden="true">/</span> : null}
                    <Link href={c.href} className="font-semibold text-trader hover:underline">{c.label}</Link>
                  </span>
                ));
              })()}
            </nav>
          </div>
          <Link href="/" className="text-sm font-semibold text-trader hover:underline">← Back to results</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <CarGallery photos={photos} title={title} />

            <section aria-labelledby="key-specs" className="rounded-lg border border-line bg-white p-4">
              <h2 id="key-specs" className="text-base font-bold">Key specifications</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {keySpecs.map((s) => (
                  <div key={s.label} className="rounded bg-lot p-3">
                    <dt className="text-xs text-gray-500">{s.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="features" className="rounded-lg border border-line bg-white p-4">
              <h2 id="features" className="text-base font-bold">Features &amp; extras</h2>
              {features.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">No additional features listed for this vehicle. Contact the dealer to confirm extras.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="specs" className="overflow-hidden rounded-lg border border-line bg-white">
              <h2 id="specs" className="border-b border-line p-4 text-base font-bold">Full specifications</h2>
              <dl>
                {specRows.map(([k, v], i) => (
                  <div key={k} className={`grid grid-cols-[160px_1fr] gap-2 px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-white" : "bg-lot/60"}`}>
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {extraRows.length > 0 ? (
              <section aria-labelledby="extra-specs" className="overflow-hidden rounded-lg border border-line bg-white">
                <h2 id="extra-specs" className="border-b border-line p-4 text-base font-bold">Additional details</h2>
                <dl>
                  {extraRows.map(([k, v], i) => (
                    <div key={k} className={`grid grid-cols-[160px_1fr] gap-2 px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-white" : "bg-lot/60"}`}>
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section aria-label="Price" className="rounded-lg border border-line bg-white p-4">
              <p className="tabular text-3xl font-bold text-asphalt">{zmw(car.priceZmw)}</p>
              <p className="mt-1 text-xs text-gray-500">Excludes on-road fees</p>
              <div className="mt-4 space-y-2">
                <FavoriteButton carId={car.id} initial={isFavorite} signedIn={user !== null} variant="full" />
                {car.status === "SOLD" ? (
                  <p role="status" className="rounded-lg border border-line bg-lot p-4 text-center text-sm text-gray-600">
                    <span className="block font-bold text-asphalt">This car is sold.</span>
                    <span className="mt-1 block">Contact is closed for this listing — browse similar cars below.</span>
                  </p>
                ) : (
                  <ContactSeller
                    dealerName={dealerName}
                    dealerPhone={dealerPhone}
                    title={title}
                    priceLabel={zmw(car.priceZmw)}
                    carId={car.id}
                    accountId={user ? user.id : null}
                  />
                )}
              </div>
            </section>

            <section aria-label="Dealer" className="rounded-lg border border-line bg-white p-4">
              <h2 className="text-sm font-bold">Seller</h2>
              <p className="mt-1 text-sm font-semibold">{dealerName}</p>
              {dealerPhone ? <p className="mt-0.5 text-sm text-gray-600">{maskPhone(dealerPhone)}</p> : <p className="mt-0.5 text-sm text-gray-600">Verified Pazengo seller</p>}
              <p className="mt-2 text-xs text-gray-500">{car.condition.toLowerCase()} · {car.bodyType}</p>
            </section>

            <section aria-label="Safety" className="rounded-lg border border-amber-300 bg-amber-100 p-4 text-xs text-amber-900">
              <h2 className="text-sm font-bold">Stay safe</h2>
              <p className="mt-1">Never pay a deposit before viewing the vehicle and verifying paperwork. Meet in a public place and check the chassis number against registration documents.</p>
            </section>
          </aside>
        </div>

        <section aria-labelledby="similar">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="similar" className="text-xl font-bold">Similar cars</h2>
            <Link href="/#listings" className="text-sm font-semibold text-trader hover:underline">View all</Link>
          </div>
          {similar.length === 0 ? (
            <p className="rounded-lg border border-line bg-white p-4 text-sm text-gray-600">No similar cars right now. Check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((c) => (
                <CarCard
                  key={c.id}
                  signedIn={user !== null}
                  car={{
                    id: c.id,
                    make: c.make,
                    model: c.model,
                    variant: c.variant,
                    year: c.year,
                    priceZmw: c.priceZmw,
                    mileageKm: c.mileageKm,
                    transmission: c.transmission,
                    fuel: c.fuel,
                    condition: c.condition,
                    photos: c.photos,
                    isFavorite: similarFavIds.has(c.id),
                    sold: c.status === "SOLD"
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
          <p>© 2026 Pazengo. Prices exclude on-road and licence fees. Confirm details with the seller before purchase.</p>
        </div>
      </footer>
    </div>
  );
}
