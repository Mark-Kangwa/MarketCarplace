import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import CreateAlertDialog from "@/components/create-alert-dialog";
import SavedSearchList from "@/components/saved-search-list";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildCarWhere, parseSearchParams } from "@/lib/search";
import { getCustomFilterDefs } from "@/lib/vehicle-validation";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AlertsPage(): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login");
  }
  const rows = await prisma.savedSearch.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" }
  });
  const [makeRows, modelRows, locationRows, colorRows] = await Promise.all([
    prisma.car.groupBy({ by: ["make"], where: { status: "PUBLISHED" }, _count: { make: true } }),
    prisma.car.groupBy({ by: ["make", "model"], where: { status: "PUBLISHED" }, _count: { model: true } }),
    prisma.car.groupBy({ by: ["location"], where: { status: "PUBLISHED" }, _count: { location: true } }),
    prisma.car.groupBy({ by: ["color"], where: { status: "PUBLISHED" }, _count: { color: true } })
  ]);
  const makes = makeRows.sort((a, b) => a.make.localeCompare(b.make)).slice(0, 50);
  const modelsByMake: Record<string, string[]> = {};
  for (const r of modelRows) {
    (modelsByMake[r.make] ??= []).push(r.model);
  }
  for (const k of Object.keys(modelsByMake)) modelsByMake[k].sort((a, b) => a.localeCompare(b));
  const locations = locationRows
    .filter((r) => r.location.trim().length > 0)
    .sort((a, b) => a.location.localeCompare(b.location))
    .slice(0, 50);
  const colors = colorRows
    .filter((r) => (r.color ?? "").trim().length > 0)
    .sort((a, b) => (a.color ?? "").localeCompare(b.color ?? ""))
    .slice(0, 50);
  const customDefs = await getCustomFilterDefs();
  const soldGraceDays = (await getSettings()).soldGraceDays;
  const initial = await Promise.all(
    rows.map(async (s) => {
      const where = buildCarWhere(parseSearchParams(Object.fromEntries(new URLSearchParams(s.params)), customDefs), undefined, soldGraceDays);
      const [matchCount, newCount] = await Promise.all([
        prisma.car.count({ where }),
        prisma.car.count({ where: { ...where, createdAt: { gt: s.lastSeenAt } } })
      ]);
      return {
        id: s.id,
        name: s.name,
        params: s.params,
        emailAlerts: s.emailAlerts,
        matchCount,
        newCount,
        updatedAt: s.updatedAt.toISOString(),
        createdAt: s.createdAt.toISOString()
      };
    })
  );

  return (
    <AccountShell
      active="alerts"
      crumb="Alerts"
      title="Alerts & saved searches"
      subtitle={
        initial.length === 0
          ? "Save any search to return to it instantly and catch new matches first."
          : `${initial.length} saved search${initial.length === 1 ? "" : "es"}. New matches light up automatically.`
      }
      action={<CreateAlertDialog makes={makes} modelsByMake={modelsByMake} locations={locations} colors={colors} customFilters={customDefs} />}
    >
      <SavedSearchList initial={initial} />
    </AccountShell>
  );
}
