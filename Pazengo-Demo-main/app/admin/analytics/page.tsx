import { guard } from "@/lib/guard";
import { prisma, dbOk } from "@/lib/db";
import { provinceOf } from "@/lib/zambia";
import { PriceBandsBar, SignupsArea } from "@/components/analytics-charts";

export const dynamic = "force-dynamic";

type SP = { preset?: string; from?: string; to?: string };

type Range = { from: Date | null; to: Date | null; preset: string; label: string };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseISODate(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseRange(sp: SP): Range {
  const now = new Date();
  const preset = (sp.preset ?? "").trim();
  const customFrom = parseISODate(sp.from?.trim());
  const customTo = parseISODate(sp.to?.trim());
  if (customFrom || customTo) {
    const from = customFrom ? startOfDay(customFrom) : null;
    const to = customTo ? endOfDay(customTo) : null;
    if (from && to && from > to) return { from: null, to: null, preset: "all", label: "All time" };
    const fmt = (d: Date) => d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    const label = from && to ? `${fmt(from)} – ${fmt(to)}` : from ? `Since ${fmt(from)}` : to ? `Until ${fmt(to)}` : "All time";
    return { from, to, preset: "custom", label };
  }
  const currYear = now.getFullYear();
  switch (preset) {
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86400000), to: null, preset, label: "Last 7 days" };
    case "12m":
      return { from: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), to: null, preset, label: "Last 12 months" };
    case "prev-year":
      return {
        from: new Date(currYear - 1, 0, 1),
        to: endOfDay(new Date(currYear - 1, 11, 31)),
        preset,
        label: `Previous year (${currYear - 1})`
      };
    case "all":
      return { from: null, to: null, preset, label: "All time" };
    case "30d":
    default:
      return { from: new Date(now.getTime() - 30 * 86400000), to: null, preset: "30d", label: "Last 30 days" };
  }
}

function inRange(from: Date | null, to: Date | null): { gte?: Date; lte?: Date } {
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

function bucketize(dates: Date[], from: Date | null, to: Date | null): { label: string; count: number }[] {
  const end = to ?? new Date();
  const start = from ?? (dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : new Date(end.getTime() - 30 * 86400000));
  const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  const mode: "day" | "week" | "month" = spanDays <= 62 ? "day" : spanDays <= 370 ? "week" : "month";
  const buckets = new Map<string, { label: string; count: number; t: number }>();
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = mode === "day"
      ? cursor.toISOString().slice(0, 10)
      : mode === "week"
        ? `w${cursor.toISOString().slice(0, 10)}`
        : `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = mode === "day"
      ? cursor.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
      : mode === "week"
        ? `w/o ${cursor.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
        : cursor.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
    if (!buckets.has(key)) buckets.set(key, { label, count: 0, t: cursor.getTime() });
    if (mode === "day") cursor.setDate(cursor.getDate() + 1);
    else if (mode === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const d of dates) {
    if (d < start || d > end) continue;
    const key = mode === "day"
      ? d.toISOString().slice(0, 10)
      : mode === "week"
        ? (() => {
            // Anchor weeks to the range start for stable buckets.
            const diff = Math.floor((startOfDay(d).getTime() - startOfDay(start).getTime()) / 86400000);
            const anchor = new Date(start);
            anchor.setDate(anchor.getDate() + Math.floor(diff / 7) * 7);
            return `w${anchor.toISOString().slice(0, 10)}`;
          })()
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (b) b.count += 1;
  }
  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

function StatBar({ label, count, max }: { label: string; count: number; max: number }): JSX.Element {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="tabular shrink-0 font-bold">{count}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-lot" role="img" aria-label={`${label}: ${count}`}>
        <div className="h-full rounded bg-trader" style={{ width: `${count === 0 ? 0 : pct}%` }} />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="tabular mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h2 className="font-bold">{title}</h2>
      <p className="mb-3 text-xs text-gray-500">{hint}</p>
      {children}
    </section>
  );
}

const PRESETS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "12m", label: "12M" },
  { value: "prev-year", label: "Prev year" },
  { value: "all", label: "All" }
];

const PRICE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Under K200k", min: 0, max: 199999 },
  { label: "K200–350k", min: 200000, max: 349999 },
  { label: "K350–500k", min: 350000, max: 499999 },
  { label: "K500–750k", min: 500000, max: 749999 },
  { label: "K750k+", min: 750000, max: Number.MAX_SAFE_INTEGER }
];

export default async function AnalyticsPage({ searchParams }: { searchParams: SP }): Promise<JSX.Element> {
  await guard();
  const range = parseRange(searchParams);
  const connected = await dbOk();
  if (!connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-bold">Database not connected.</p>
          <p className="mt-1">Set <code>DATABASE_URL</code> to Postgres, then run <code>npm run db:push && npm run db:seed</code>.</p>
        </div>
      </div>
    );
  }

  const created = inRange(range.from, range.to);
  const [
    stock, published, featured,
    statusRows, makeRows, priceRows, locationRows, ageRows, soldRows,
    newCars, userTotal, roleRows, blocked, signupRows,
    favCount, viewCount, enquiryCount,
    topFav, topViewed, topEnquired,
    payRows
  ] = await Promise.all([
    prisma.car.count(),
    prisma.car.count({ where: { status: "PUBLISHED" } }),
    prisma.car.count({ where: { status: "PUBLISHED", isFeatured: true } }),
    prisma.car.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.car.groupBy({ by: ["make"], _count: { make: true }, orderBy: { _count: { make: "desc" } }, take: 8 }),
    prisma.car.findMany({ where: { status: "PUBLISHED" }, select: { priceZmw: true } }),
    prisma.car.groupBy({ by: ["location"], where: { status: "PUBLISHED" }, _count: { location: true } }),
    prisma.car.findMany({ where: { status: "PUBLISHED" }, select: { createdAt: true } }),
    prisma.car.findMany({ where: { status: "SOLD", soldAt: { not: null } }, select: { createdAt: true, soldAt: true } }),
    prisma.car.count({ where: { createdAt: created } }),
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
    prisma.user.count({ where: { status: "BLOCKED" } }),
    prisma.user.findMany({ where: { createdAt: created }, select: { createdAt: true } }),
    prisma.favorite.count({ where: { createdAt: created } }),
    prisma.recentView.count({ where: { viewedAt: created } }),
    prisma.enquiry.count({ where: { createdAt: created } }),
    prisma.favorite.groupBy({ by: ["carId"], where: { createdAt: created }, _count: { carId: true }, orderBy: { _count: { carId: "desc" } }, take: 5 }),
    prisma.recentView.groupBy({ by: ["carId"], where: { viewedAt: created }, _count: { carId: true }, orderBy: { _count: { carId: "desc" } }, take: 5 }),
    prisma.enquiry.groupBy({ by: ["carId"], where: { createdAt: created }, _count: { carId: true }, orderBy: { _count: { carId: "desc" } }, take: 5 }),
    prisma.payment.groupBy({ by: ["status"], _count: { status: true }, _sum: { amountZar: true } })
  ]);

  const soldInRange = soldRows.filter((c) => {
    if (!c.soldAt) return false;
    if (range.from && c.soldAt < range.from) return false;
    if (range.to && c.soldAt > range.to) return false;
    return true;
  });
  const daysToSell = soldInRange
    .map((c) => (c.soldAt!.getTime() - c.createdAt.getTime()) / 86400000)
    .filter((d) => d >= 0);
  const avgDays = daysToSell.length > 0 ? (daysToSell.reduce((a, b) => a + b, 0) / daysToSell.length).toFixed(1) : "—";

  const priceData = PRICE_BANDS.map((b) => ({
    band: b.label,
    count: priceRows.filter((r) => r.priceZmw >= b.min && r.priceZmw <= b.max).length
  }));

  const now = new Date();
  const day = 86400000;
  const ageBuckets = [
    { label: "Under 30 days", count: ageRows.filter((r) => now.getTime() - r.createdAt.getTime() < 30 * day).length },
    { label: "30–90 days", count: ageRows.filter((r) => { const d = now.getTime() - r.createdAt.getTime(); return d >= 30 * day && d < 90 * day; }).length },
    { label: "90–180 days", count: ageRows.filter((r) => { const d = now.getTime() - r.createdAt.getTime(); return d >= 90 * day && d < 180 * day; }).length },
    { label: "180+ days", count: ageRows.filter((r) => now.getTime() - r.createdAt.getTime() >= 180 * day).length }
  ];

  const provinceCounts = new Map<string, number>();
  for (const r of locationRows) {
    const loc = r.location.trim();
    if (!loc) continue;
    const p = provinceOf(loc) ?? "Other";
    provinceCounts.set(p, (provinceCounts.get(p) ?? 0) + r._count.location);
  }
  const provinceData = Array.from(provinceCounts.entries()).sort((a, b) => b[1] - a[1]);

  const signupData = bucketize(signupRows.map((r) => r.createdAt), range.from, range.to);

  const roleCounts: Record<string, number> = {};
  for (const r of roleRows) roleCounts[r.role] = r._count.role;
  const approvedSum = payRows.find((r) => r.status === "APPROVED")?._sum.amountZar ?? 0;

  const topIds = Array.from(new Set([...topFav.map((t) => t.carId), ...topViewed.map((t) => t.carId), ...topEnquired.map((t) => t.carId)]));
  const topCars = topIds.length > 0
    ? await prisma.car.findMany({ where: { id: { in: topIds } }, select: { id: true, year: true, make: true, model: true } })
    : [];
  const topName = (id: string) => {
    const c = topCars.find((x) => x.id === id);
    return c ? `${c.year} ${c.make} ${c.model}` : id.slice(0, 8);
  };

  const maxStatus = Math.max(1, ...statusRows.map((r) => r._count.status));
  const maxMake = Math.max(1, ...makeRows.map((r) => r._count.make));
  const maxProvince = Math.max(1, ...provinceData.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">Inventory, audience and engagement for {range.label.toLowerCase()}.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-3" action="/admin/analytics">
        <span className="flex flex-wrap gap-1.5" role="group" aria-label="Range presets">
          {PRESETS.map((p) => (
            <a
              key={p.value}
              href={`/admin/analytics?preset=${p.value}`}
              aria-current={range.preset === p.value ? "true" : undefined}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${range.preset === p.value ? "bg-asphalt text-white" : "border border-line hover:bg-lot"}`}
            >
              {p.label}
            </a>
          ))}
        </span>
        <label className="text-xs font-semibold text-gray-600">From
          <input type="date" name="from" defaultValue={range.from ? range.from.toISOString().slice(0, 10) : ""} className="ml-1 rounded border border-line px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-gray-600">To
          <input type="date" name="to" defaultValue={range.to ? range.to.toISOString().slice(0, 10) : ""} className="ml-1 rounded border border-line px-2 py-1.5 text-sm" />
        </label>
        <button className="rounded bg-asphalt px-4 py-1.5 text-sm font-semibold text-white">Apply</button>
        <a href="/admin/analytics" className="rounded border border-line px-4 py-1.5 text-sm hover:bg-lot">Reset</a>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Cars in stock" value={stock} hint={`${published} published · ★ ${featured} featured`} />
        <Kpi label={`Sold (${range.label.toLowerCase()})`} value={soldInRange.length} hint={soldInRange.length > 0 ? `avg ${avgDays} days to sell` : "no sales in range"} />
        <Kpi label="Users" value={userTotal} hint={`${roleCounts.BUYER ?? 0} general · ${roleCounts.DEALER ?? 0} dealers · ${blocked} blocked`} />
        <Kpi label={`New cars (${range.label.toLowerCase()})`} value={newCars} hint="added in range" />
        <Kpi label="Pending payments" value={payRows.find((r) => r.status === "PENDING")?._count.status ?? 0} hint={`K ${(approvedSum / 100).toLocaleString("en-ZA")} approved total`} />
        <Kpi label={`Enquiries (${range.label.toLowerCase()})`} value={enquiryCount} hint={`${favCount} favourites · ${viewCount} views`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Stock by status" hint="Current inventory">
          <div className="space-y-2">
            {statusRows.map((r) => <StatBar key={r.status} label={r.status} count={r._count.status} max={maxStatus} />)}
          </div>
        </Section>
        <Section title="Top makes" hint="Current inventory">
          <div className="space-y-2">
            {makeRows.map((r) => <StatBar key={r.make} label={r.make} count={r._count.make} max={maxMake} />)}
          </div>
        </Section>
        <Section title="Price bands" hint="Published stock by asking price">
          <PriceBandsBar data={priceData} />
        </Section>
        <Section title="Signups" hint={`New accounts · ${range.label.toLowerCase()}`}>
          <SignupsArea data={signupData} />
        </Section>
        <Section title="Stock by province" hint="Derived from town locations">
          <div className="space-y-2">
            {provinceData.length === 0 ? <p className="text-sm text-gray-500">No located stock.</p> : null}
            {provinceData.map(([p, n]) => <StatBar key={p} label={`${p} Province`} count={n} max={maxProvince} />)}
          </div>
        </Section>
        <Section title="Stock age" hint="Days since listed (published)">
          <div className="space-y-2">
            {ageBuckets.map((b) => <StatBar key={b.label} label={b.label} count={b.count} max={Math.max(1, ...ageBuckets.map((x) => x.count))} />)}
          </div>
        </Section>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Section title="Most favourited" hint={range.label}>
          <TopList rows={topFav} topName={topName} empty="No favourites in range." />
        </Section>
        <Section title="Most viewed" hint={range.label}>
          <TopList rows={topViewed} topName={topName} empty="No views in range." />
        </Section>
        <Section title="Most enquired" hint={range.label}>
          <TopList rows={topEnquired} topName={topName} empty="No enquiries in range." />
        </Section>
      </div>

      <Section title="Payments" hint={`All time by status · approved revenue K ${(approvedSum / 100).toLocaleString("en-ZA")}`}>
        <div className="grid gap-2 sm:grid-cols-3">
          {payRows.map((r) => (
            <div key={r.status} className="rounded bg-lot p-3">
              <p className="text-xs text-gray-500">{r.status}</p>
              <p className="tabular text-xl font-bold">{r._count.status}</p>
              <p className="tabular text-xs text-gray-500">K {((r._sum.amountZar ?? 0) / 100).toLocaleString("en-ZA")}</p>
            </div>
          ))}
          {payRows.length === 0 ? <p className="text-sm text-gray-500">No payments recorded.</p> : null}
        </div>
      </Section>
    </div>
  );
}

function TopList({ rows, topName, empty }: { rows: { carId: string; _count: { carId: number } }[]; topName: (id: string) => string; empty: string }): JSX.Element {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r._count.carId));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.carId}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <a href={`/listing/${r.carId}`} className="truncate font-medium text-trader hover:underline">{topName(r.carId)}</a>
            <span className="tabular shrink-0 font-bold">{r._count.carId}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-lot" role="img" aria-label={`${topName(r.carId)}: ${r._count.carId}`}>
            <div className="h-full rounded bg-trader" style={{ width: `${Math.max(2, Math.round((r._count.carId / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
