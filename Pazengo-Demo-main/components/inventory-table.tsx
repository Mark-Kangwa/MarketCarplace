import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma, dbOk } from "@/lib/db";
import { zmw, km } from "@/lib/format";
import { Pill, carStatusTone, listingTone } from "@/components/pills";
import { FeaturedToggleButton } from "@/components/featured-toggle-button";
import { ApproveButton } from "@/components/approve-button";

export type InventorySearchParams = {
  q?: string; status?: string; featured?: string; sort?: string; dir?: string; publisher?: string;
};

type Row = Prisma.CarGetPayload<{
  include: { owner: { select: { name: true; email: true } }; _count: { select: { reviews: true } } };
}>;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  BLOCKED: "Blocked",
  SOLD: "Sold"
};

function daysWaiting(from: Date): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000));
  return days === 0 ? "today" : `${days}d`;
}

export default async function InventoryTable({
  basePath,
  title,
  subtitle,
  baseStatus,
  extraStatuses,
  ownCount,
  otherHref,
  otherLabel,
  emptyText,
  showApprove,
  showWaiting,
  searchParams
}: {
  basePath: string;
  title: string;
  subtitle: string;
  baseStatus: "PUBLISHED" | "DRAFT";
  extraStatuses: ("SOLD" | "BLOCKED")[];
  ownCount: number;
  otherHref: string;
  otherLabel: string;
  emptyText: string;
  showApprove: boolean;
  showWaiting: boolean;
  searchParams: InventorySearchParams;
}): Promise<JSX.Element> {
  const q = (searchParams.q ?? "").trim();
  const allowedStatuses = [baseStatus, ...extraStatuses];
  const status = allowedStatuses.includes(searchParams.status as never) ? (searchParams.status as string) : baseStatus;
  const featured = searchParams.featured || "";
  const publisher: "" | "admin" | "users" = searchParams.publisher === "admin" || searchParams.publisher === "users" ? searchParams.publisher : "";
  const sortKeys = ["price", "mileage", "status", "listing", "published"] as const;
  const sort: (typeof sortKeys)[number] | "" = (sortKeys as readonly string[]).includes(searchParams.sort ?? "") ? (searchParams.sort as (typeof sortKeys)[number]) : "";
  const dir: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.CarOrderByWithRelationInput | Prisma.CarOrderByWithRelationInput[] =
    sort === "price"
      ? { priceZmw: dir }
      : sort === "mileage"
        ? { mileageKm: dir }
        : sort === "status"
          ? { status: dir }
          : sort === "listing"
            ? { isFeatured: dir }
            : sort === "published"
              ? { createdAt: dir }
              : [{ isFeatured: "desc" }, { createdAt: "desc" }];
  const withParams = (extra: Record<string, string | undefined>): string => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== baseStatus) sp.set("status", status);
    if (featured) sp.set("featured", featured);
    if (publisher) sp.set("publisher", publisher);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) sp.delete(k);
      else sp.set(k, v);
    }
    const s = sp.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  const sortHref = (key: (typeof sortKeys)[number]): string =>
    withParams({ sort: key, dir: sort === key && dir === "desc" ? "asc" : "desc" });
  const arrow = (key: (typeof sortKeys)[number]): string => (sort === key ? (dir === "desc" ? " ▼" : " ▲") : "");
  const publisherWhere: Prisma.CarWhereInput =
    publisher === "admin" ? { ownerId: null } : publisher === "users" ? { ownerId: { not: null } } : {};
  let cars: Row[] = [];
  let adminCount = 0;
  let userCount = 0;
  if (await dbOk()) {
    [cars, adminCount, userCount] = await Promise.all([
      prisma.car.findMany({
        where: {
          status: status as never,
          ...publisherWhere,
          ...(featured === "yes" ? { isFeatured: true } : featured === "no" ? { isFeatured: false } : {}),
          ...(q ? { OR: [{ make: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }, { chassisNo: { contains: q, mode: "insensitive" } }] } : {})
        },
        include: { owner: { select: { name: true, email: true } }, _count: { select: { reviews: true } } },
        orderBy,
        take: 100
      }),
      prisma.car.count({ where: { status: status as never, ownerId: null } }),
      prisma.car.count({ where: { status: status as never, ownerId: { not: null } } })
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title} ({ownCount})</h1>
          <p className="text-sm text-gray-600">{subtitle} <Link href={otherHref} className="font-semibold text-trader hover:underline">{otherLabel}</Link></p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/inventory/import" className="rounded border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-lot">Import CSV</Link>
          <Link href="/admin/inventory/new" className="rounded bg-signal px-3 py-2 text-sm font-bold text-white">Add car</Link>
        </div>
      </div>

      <form className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3 sm:flex-row" method="get" action={basePath}>
        <input name="q" defaultValue={q} placeholder="Search make, model…" className="flex-1 rounded border border-line px-3 py-2 text-sm" aria-label="Search inventory" />
        <select name="status" defaultValue={status} className="rounded border border-line px-3 py-2 text-sm" aria-label="Filter by status">
          {allowedStatuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="featured" defaultValue={featured} className="rounded border border-line px-3 py-2 text-sm" aria-label="Filter by listing type">
          <option value="">All listings</option>
          <option value="yes">★ Featured</option>
          <option value="no">Regular</option>
        </select>
        {publisher ? <input type="hidden" name="publisher" value={publisher} /> : null}
        <button className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Filter</button>
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Publisher">
        {([
          { key: "", label: `All (${adminCount + userCount})` },
          { key: "admin", label: `Admin (${adminCount})` },
          { key: "users", label: `User listings (${userCount})` }
        ] as const).map((t) => (
          <Link
            key={t.key || "all"}
            href={withParams({ publisher: t.key || undefined })}
            role="tab"
            aria-selected={publisher === t.key}
            className={`rounded-full border px-4 py-1.5 text-sm ${publisher === t.key ? "border-asphalt bg-asphalt font-semibold text-white" : "border-line bg-white hover:bg-lot"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-line bg-lot text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2">Car</th>
              <th className="px-3 py-2"><Link href={sortHref("price")} className="hover:text-trader">Price{arrow("price")}</Link></th>
              <th className="px-3 py-2"><Link href={sortHref("mileage")} className="hover:text-trader">Mileage{arrow("mileage")}</Link></th>
              <th className="px-3 py-2"><Link href={sortHref("published")} className="hover:text-trader">Published{arrow("published")}</Link></th>
              {showWaiting ? <th className="px-3 py-2">Waiting</th> : null}
              <th className="px-3 py-2"><Link href={sortHref("status")} className="hover:text-trader">Status{arrow("status")}</Link></th>
              <th className="px-3 py-2"><Link href={sortHref("listing")} className="hover:text-trader">Listing{arrow("listing")}</Link></th>
              <th className="px-3 py-2">Publisher</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-lot/60">
                <td className="px-3 py-2"><span className="font-semibold">{c.year} {c.make} {c.model}</span> <span className="text-gray-500">{c.variant ?? ""}</span>{c._count.reviews > 0 ? <span title={`${c._count.reviews} feedback message${c._count.reviews === 1 ? "" : "s"}`} className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">💬 {c._count.reviews}</span> : null}</td>
                <td className="tabular px-3 py-2 font-semibold">{zmw(c.priceZmw)}</td>
                <td className="tabular px-3 py-2">{km(c.mileageKm)}</td>
                <td className="tabular whitespace-nowrap px-3 py-2 text-xs text-gray-600">{new Date(c.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</td>
                {showWaiting ? <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-amber-800">{daysWaiting(c.createdAt)}</td> : null}
                <td className="px-3 py-2"><Pill tone={carStatusTone(c.status)}>{c.status}</Pill></td>
                <td className="px-3 py-2"><Pill tone={listingTone(c.isFeatured)}>{c.isFeatured ? "★ FEATURED" : "REGULAR"}</Pill></td>
                <td className="px-3 py-2">
                  {c.owner ? (
                    <span title={c.owner.email}>
                      <span className="block rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-trader">UPLOADED BY USER</span>
                      <span className="mt-0.5 block max-w-[160px] truncate text-xs text-gray-600">{c.owner.name}</span>
                    </span>
                  ) : (
                    <span className="rounded bg-lot px-1.5 py-0.5 text-[11px] font-bold text-gray-600">ADMIN</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {c.productName ? (
                    <span className="block max-w-[140px] truncate text-xs font-semibold" title={c.productName}>📦 {c.productName}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    {showApprove && c.status === "DRAFT" ? <ApproveButton id={c.id} label={`${c.year} ${c.make} ${c.model}`} /> : null}
                    <FeaturedToggleButton id={c.id} featured={c.isFeatured} />
                    <Link href={`/admin/inventory/${c.id}`} className="text-trader underline">Open</Link>
                  </span>
                </td>
              </tr>
            ))}
            {cars.length === 0 ? (
              <tr><td colSpan={showWaiting ? 10 : 9} className="px-3 py-8 text-center text-sm text-gray-500">{emptyText}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
