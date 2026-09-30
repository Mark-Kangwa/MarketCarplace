import Link from "next/link";
import CarCard from "@/components/car-card";
import SiteHeader from "@/components/site-header";
import { getUserSession } from "@/lib/auth";
import Pagination from "@/components/pagination";
import SaveSearchButton from "@/components/save-search-button";
import SearchFilters, { hiddenInputs } from "@/components/search-filters";
import { prisma, dbOk } from "@/lib/db";
import { provinceOf } from "@/lib/zambia";
import { getCustomFilterDefs } from "@/lib/vehicle-validation";
import { getSettings } from "@/lib/settings";
import {
  BODY_TYPES,
  SORT_OPTIONS,
  buildCarWhere,
  describeSearch,
  hasActiveFilters,
  isSearchRequest,
  parseSearchParams,
  regularOrderBy,
  searchHistoryKey,
  toQueryString,
  type SearchFilters as Filters
} from "@/lib/search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SP = Record<string, string | string[] | undefined>;

function FeaturedSection({ featured, filtering, signedIn }: {
  featured: React.ComponentProps<typeof CarCard>["car"][];
  filtering: boolean;
  signedIn: boolean;
}): JSX.Element | null {
  if (featured.length > 0) {
    return (
      <section aria-label="Featured results">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold">Featured results</h2>
          <span className="text-xs text-gray-500">Sponsored</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c) => (
            <CarCard key={c.id} car={c} signedIn={signedIn} />
          ))}
        </div>
      </section>
    );
  }
  if (!filtering) {
    return (
      <section aria-label="Featured results">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold">Featured results</h2>
          <span className="text-xs text-gray-500">Sponsored</span>
        </div>
        <div className="rounded-lg border border-dashed border-line bg-white p-6 text-sm text-gray-600">
          <p className="font-semibold text-asphalt">No featured listings right now.</p>
          <p className="mt-1">Admins can pin stock here from Inventory → ★ Feature. Regular listings still appear below.</p>
        </div>
      </section>
    );
  }
  return null;
}

function SortControl({ f }: { f: Filters }): JSX.Element {
  return (
    <form method="get" action="/#listings" className="flex items-center gap-2 text-sm">
      {hiddenInputs(f, ["sort", "page"])}
      <label htmlFor="sort-top" className="text-xs font-semibold text-gray-600">Sort:</label>
      <select id="sort-top" name="sort" defaultValue={f.sort} className="rounded border border-line px-2 py-1.5 text-sm">
        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="submit" className="rounded border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-lot">Go</button>
    </form>
  );
}

export default async function Home({ searchParams }: { searchParams: SP }): Promise<JSX.Element> {
  const customDefs = await getCustomFilterDefs();
  const settings = await getSettings();
  const f = parseSearchParams(searchParams, customDefs);
  // Searching = the URL carries any search key (even empty — GET forms always
  // submit named controls, so clicking Search with a blank field counts).
  // A plain `/` visit has no keys and renders the landing view.
  const searching = isSearchRequest(searchParams);
  const filtering = hasActiveFilters(f);
  const base = buildCarWhere(f, undefined, settings.soldGraceDays);
  const featuredWhere = { ...base, isFeatured: true };
  const regularWhere = { ...base, isFeatured: false };
  const perPage = searching ? PAGE_SIZE : settings.landingTake;
  const baseParams = {
    q: f.q || undefined,
    make: f.make || undefined,
    model: f.model || undefined,
    body: f.body || undefined,
    condition: f.condition || undefined,
    gearbox: f.gearbox || undefined,
    fuel: f.fuel || undefined,
    location: f.location || undefined,
    province: f.province || undefined,
    serviceHistory: f.serviceHistory || undefined,
    drivetrain: f.drivetrain || undefined,
    color: f.color || undefined,
    minSeats: f.minSeats,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minYear: f.minYear,
    maxYear: f.maxYear,
    maxMileage: f.maxMileage,
    ...Object.fromEntries(Object.entries(f.custom).map(([k, v]) => [`cf_${k}`, v])),
    sort: f.sort !== "newest" ? f.sort : undefined
  };
  const user = await getUserSession();

  let featured: React.ComponentProps<typeof CarCard>["car"][] = [];
  let regular: React.ComponentProps<typeof CarCard>["car"][] = [];
  let regularCount = 0;
  let totalPublished = 0;
  let makes: { make: string; _count: { make: number } }[] = [];
  let models: { model: string; _count: { model: number } }[] = [];
  let locations: { location: string; _count: { location: number } }[] = [];
  let colors: { color: string | null; _count: { color: number } }[] = [];
  let connected = false;

  if (await dbOk()) {
    connected = true;
    const [featuredRows, regularRows, fCount, rCount, total, makeRows, locationRows, colorRows] = await Promise.all([
      prisma.car.findMany({
        where: featuredWhere,
        orderBy: [{ featuredAt: "desc" }, { createdAt: "desc" }],
        take: settings.featuredTake
      }),
      prisma.car.findMany({
        where: regularWhere,
        orderBy: regularOrderBy(f.sort),
        skip: (f.page - 1) * perPage,
        take: perPage
      }),
      prisma.car.count({ where: featuredWhere }),
      prisma.car.count({ where: regularWhere }),
      prisma.car.count({ where: { status: "PUBLISHED" } }),
      prisma.car.groupBy({ by: ["make"], where: { status: "PUBLISHED" }, _count: { make: true } }),
      prisma.car.groupBy({ by: ["location"], where: { status: "PUBLISHED" }, _count: { location: true } }),
      prisma.car.groupBy({ by: ["color"], where: { status: "PUBLISHED" }, _count: { color: true } })
    ]);
    const favIds = new Set<string>(
      user
        ? (await prisma.favorite.findMany({ where: { userId: user.id }, select: { carId: true } })).map((r) => r.carId)
        : []
    );
    const map = (c: (typeof featuredRows)[number]) => ({
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
      isFeatured: c.isFeatured,
      isFavorite: favIds.has(c.id),
      sold: c.status === "SOLD"
    });
    featured = featuredRows.map(map);
    regular = regularRows.map(map as never) as typeof featured;
    regularCount = rCount;
    totalPublished = total;
    if (searching && user) {
      // Record this search (bump recency on repeats), prune beyond newest 20.
      const key = searchHistoryKey(f);
      await prisma.searchHistory.upsert({
        where: { userId_key: { userId: user.id, key } },
        update: {
          label: describeSearch(f, customDefs),
          params: toQueryString(baseParams),
          resultCount: fCount + rCount,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          key,
          label: describeSearch(f, customDefs),
          params: toQueryString(baseParams),
          resultCount: fCount + rCount
        }
      });
      const staleSearches = await prisma.searchHistory.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
        skip: 20
      });
      if (staleSearches.length > 0) {
        await prisma.searchHistory.deleteMany({ where: { id: { in: staleSearches.map((r) => r.id) } } });
      }
    }
    makes = makeRows;
    if (f.make) {
      const modelRows = await prisma.car.groupBy({
        by: ["model"],
        where: { status: "PUBLISHED", make: { equals: f.make, mode: "insensitive" } },
        _count: { model: true }
      });
      models = modelRows.sort((a, b) => a.model.localeCompare(b.model)).slice(0, 50);
    }
    makes = makeRows.sort((a, b) => a.make.localeCompare(b.make)).slice(0, 50);
    locations = locationRows
      .filter((r) => r.location.trim().length > 0)
      .sort((a, b) => a.location.localeCompare(b.location))
      .slice(0, 50);
    colors = colorRows
      .filter((r) => (r.color ?? "").trim().length > 0)
      .sort((a, b) => (a.color ?? "").localeCompare(b.color ?? ""))
      .slice(0, 50);
  }

  // Derived geography: selecting Chongwe reveals its Lusaka Province home
  // plus the live province-wide count (aggregated from the town facet).
  const geoProvince = f.province || (f.location ? provinceOf(f.location) ?? "" : "");
  const geoCount = geoProvince
    ? locations.filter((l) => provinceOf(l.location) === geoProvince).reduce((s, l) => s + l._count.location, 0)
    : 0;
  const geoLine =
    f.location && geoProvince
      ? `${f.location} · ${geoProvince} Province — ${geoCount} car${geoCount === 1 ? "" : "s"} in this province`
      : geoProvince
        ? `${geoCount} car${geoCount === 1 ? "" : "s"} in ${geoProvince} Province`
        : "";

  const totalPages = Math.max(1, Math.ceil(regularCount / perPage));
  const safePage = Math.min(f.page, totalPages);
  const pageHref = (p: number) => `/${toQueryString({ ...baseParams, page: p > 1 ? p : undefined })}#listings`;
  const rangeStart = regularCount === 0 ? 0 : (safePage - 1) * perPage + 1;
  const rangeEnd = (safePage - 1) * perPage + regular.length;

  const resultsGrid = searching ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  const searchRecord: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s !== undefined && s !== "") searchRecord[k] = s;
  }

  const resultsSection = (
    <section aria-label="Results">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-bold">{filtering ? "Results" : searching ? "All cars" : "Latest listings"}</h2>
        <span className="text-xs text-gray-500">
          {searching
            ? `${rangeStart}–${rangeEnd} of ${regularCount} result${regularCount === 1 ? "" : "s"}`
            : `${regularCount} result${regularCount === 1 ? "" : "s"}${totalPublished ? ` · ${totalPublished} published` : ""}`}
        </span>
      </div>
      {(f.province || f.location || f.make || f.model) && (
        <nav aria-label="Active search trail" className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/#listings" className="hover:text-trader">Buy a car</Link>
          {[
            ...(f.province ? [{ label: `${f.province} Province`, href: `/?province=${encodeURIComponent(f.province)}#listings` }] : []),
            ...(f.location ? [{ label: f.location, href: `/?location=${encodeURIComponent(f.location)}#listings` }] : []),
            ...(f.make ? [{ label: f.make, href: `/?make=${encodeURIComponent(f.make)}#listings` }] : []),
            ...(f.model ? [{ label: f.model, href: `/?make=${encodeURIComponent(f.make)}&model=${encodeURIComponent(f.model)}#listings` }] : [])
          ].map((c) => (
            <span key={c.href} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              <Link href={c.href} className="font-semibold text-trader hover:underline">{c.label}</Link>
            </span>
          ))}
        </nav>
      )}
      {searching ? (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <SaveSearchButton defaultName={describeSearch(f, customDefs)} search={searchRecord} signedIn={user !== null} />
          <SortControl f={f} />
        </div>
      ) : null}
      {searching && geoLine ? (
        <p className="mb-3 rounded-lg border border-line bg-white px-3 py-2 text-xs text-gray-600">
          📍 {geoLine}
        </p>
      ) : null}
      {regular.length === 0 ? (
        <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
          {filtering ? (
            <>
              <p className="font-semibold text-asphalt">No cars match your filters.</p>
              <p className="mt-1">Try widening the price or mileage range, or clear all filters.</p>
              <Link href="/#listings" className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Clear all filters</Link>
            </>
          ) : regularCount > 0 ? (
            <>
              <p className="font-semibold text-asphalt">You&apos;ve gone past the last page.</p>
              <p className="mt-1">There {regularCount === 1 ? "is" : "are"} only {regularCount} regular listing{regularCount === 1 ? "" : "s"}.</p>
              <Link href={`/${toQueryString({ ...baseParams })}#listings`} className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Back to page 1</Link>
            </>
          ) : featured.length > 0 ? (
            <p>All published stock is currently featured above.</p>
          ) : (
            <>
              <p className="font-semibold text-asphalt">No published stock yet.</p>
              <p className="mt-1">Run seed and published cars will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 ${resultsGrid}`}>
            {regular.map((c) => (
              <CarCard key={c.id} car={c} signedIn={user !== null} />
            ))}
          </div>
          <Pagination safePage={safePage} totalPages={totalPages} pageHref={pageHref} />
        </>
      )}
    </section>
  );

  const filterAside = (
    <aside aria-label="Search filters" className="min-w-0">
      <details className="rounded-lg border border-line bg-white lg:hidden" open={filtering}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold">
          <span aria-hidden="true">⚙ </span>Filters{filtering ? " (active)" : ""}
        </summary>
        <div className="border-t border-line">
          <SearchFilters f={f} makes={makes} models={models} locations={locations} colors={colors} customFilters={customDefs} />
        </div>
      </details>
      <div className="hidden lg:block lg:sticky lg:top-4 overflow-hidden rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold">Filters{filtering ? " (active)" : ""}</h2>
        <SearchFilters f={f} makes={makes} models={models} locations={locations} colors={colors} customFilters={customDefs} />
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="bg-asphalt pb-10 pt-8 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="max-w-xl text-3xl font-bold leading-tight md:text-4xl">Find new &amp; used cars for sale</h1>
          <form className="mt-4 flex flex-col gap-2 rounded-lg bg-white p-2 text-asphalt md:flex-row" action="/#listings" method="get">
            <select name="body" aria-label="Body type" defaultValue={f.body} className="rounded border border-line px-3 py-2.5 text-sm">
              <option value="">All categories</option>
              {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select name="make" aria-label="Make" defaultValue={f.make} className="rounded border border-line px-3 py-2.5 text-sm">
              <option value="">All makes</option>
              {makes.map((m) => <option key={m.make} value={m.make}>{m.make} ({m._count.make})</option>)}
            </select>
            {f.make ? (
              <select name="model" aria-label="Model" defaultValue={f.model} className="rounded border border-line px-3 py-2.5 text-sm">
                <option value="">All models</option>
                {models.map((m) => <option key={m.model} value={m.model}>{m.model} ({m._count.model})</option>)}
              </select>
            ) : null}
            <input name="q" aria-label="Search keywords" placeholder="Search make, model, keyword…" defaultValue={f.q} className="flex-1 rounded border border-line px-3 py-2.5 text-sm" />
            {hiddenInputs(f, ["q", "make", "model", "body"])}
            <button className="rounded bg-signal px-6 py-2.5 text-sm font-bold text-white hover:brightness-110" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <main id="listings" className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {!connected ? (
          <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
            <p className="font-semibold text-asphalt">No published stock yet.</p>
            <p className="mt-1">Connect Postgres, run seed, and published cars will appear here exactly as buyers see them.</p>
            <code className="mt-3 block rounded bg-lot p-2 text-xs">npm run db:push && npm run db:seed</code>
          </div>
        ) : searching ? (
          <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            {filterAside}
            <div className="min-w-0 space-y-8">
              <FeaturedSection featured={featured} filtering={filtering} signedIn={user !== null} />
              {resultsSection}
            </div>
          </div>
        ) : (
          <>
            <FeaturedSection featured={featured} filtering={filtering} signedIn={user !== null} />
            {resultsSection}
          </>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { t: "Get a free car valuation", d: "Find out what your car is worth in seconds." },
            { t: "Car finance calculator", d: "Estimate monthly payments before you apply." },
            { t: "Sell your car", d: "Reach serious buyers across South Africa." }
          ].map((c) => (
            <div key={c.t} className="rounded-lg border border-line bg-white p-4">
              <h3 className="text-sm font-bold">{c.t}</h3>
              <p className="mt-1 text-sm text-gray-600">{c.d}</p>
            </div>
          ))}
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
