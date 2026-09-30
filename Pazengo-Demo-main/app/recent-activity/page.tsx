import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import AutoRefresh from "@/components/auto-refresh";
import CarCard from "@/components/car-card";
import ClearHistoryButton from "@/components/clear-history-button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { isSoldVisible } from "@/lib/search";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

type TimelineItem =
  | { kind: "car"; at: Date; carId: string; card: React.ReactNode; caption: string }
  | { kind: "search"; at: Date; label: string; href: string; resultCount: number };

export default async function RecentActivityPage(): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login");
  }
  const [views, searches] = await Promise.all([
    prisma.recentView.findMany({
      where: { userId: session.id },
      orderBy: { viewedAt: "desc" },
      take: 20,
      include: { car: true }
    }),
    prisma.searchHistory.findMany({
      where: { userId: session.id },
      orderBy: { updatedAt: "desc" },
      take: 20
    })
  ]);
  const soldDays = await getSetting("soldGraceDays");
  const liveViews = views.filter(
    (v) => v.car.status === "PUBLISHED" || (v.car.status === "SOLD" && isSoldVisible(v.car.soldAt, new Date(), soldDays))
  );

  const items: TimelineItem[] = [
    ...liveViews.map((v) => ({
      kind: "car" as const,
      at: v.viewedAt,
      carId: v.car.id,
      card: (
        <CarCard
          signedIn
          car={{
            id: v.car.id,
            make: v.car.make,
            model: v.car.model,
            variant: v.car.variant,
            year: v.car.year,
            priceZmw: v.car.priceZmw,
            mileageKm: v.car.mileageKm,
            transmission: v.car.transmission,
            fuel: v.car.fuel,
            condition: v.car.condition,
            photos: v.car.photos,
            isFeatured: v.car.isFeatured,
            sold: v.car.status === "SOLD"
          }}
        />
      ),
      caption: `Viewed ${timeAgo(v.viewedAt)}`
    })),
    ...searches.map((s) => ({
      kind: "search" as const,
      at: s.updatedAt,
      label: s.label,
      href: `/${s.params}#listings`,
      resultCount: s.resultCount
    }))
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <AccountShell
      active="recent-activity"
      crumb="Recent activity"
      title="Recent activity"
      subtitle={items.length === 0 ? "Cars you open and searches you run will appear here." : `Your last ${items.length} viewed car${items.length === 1 ? "" : "s"} and searches.`}
      action={items.length > 0 ? <ClearHistoryButton /> : undefined}
    >
      <AutoRefresh />
      {items.length === 0 ? (
        <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
          <p className="font-semibold text-asphalt">Nothing here yet.</p>
          <p className="mt-1">Open any listing or run a search and it will show up here on all your devices.</p>
          <Link href="/#listings" className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Browse cars</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) =>
            item.kind === "car" ? (
              <div key={`car-${item.carId}-${item.at.getTime()}`}>
                {item.card}
                <p className="mt-1 text-xs text-gray-500">{item.caption}</p>
              </div>
            ) : (
              <Link
                key={`search-${item.label}-${item.at.getTime()}`}
                href={item.href}
                className="flex flex-col justify-between rounded-lg border border-line bg-white p-4 transition-shadow hover:shadow-md"
              >
                <span>
                  <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-lot text-base">🔍</span>
                  <span className="mt-2 block text-sm font-bold leading-snug">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {item.resultCount} result{item.resultCount === 1 ? "" : "s"} · Searched {timeAgo(item.at)}
                  </span>
                </span>
                <span className="mt-3 text-sm font-semibold text-trader">View results →</span>
              </Link>
            )
          )}
        </div>
      )}
    </AccountShell>
  );
}
