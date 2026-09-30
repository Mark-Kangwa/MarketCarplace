import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";
import InventoryTable, { type InventorySearchParams } from "@/components/inventory-table";
import PendingPayments from "@/components/pending-payments";

export const dynamic = "force-dynamic";

export default async function PendingReviewPage({ searchParams }: { searchParams: InventorySearchParams }): Promise<JSX.Element> {
  await guard();
  let publishedCount = 0;
  let pendingCount = 0;
  if (await dbOk()) {
    [publishedCount, pendingCount] = await Promise.all([
      prisma.car.count({ where: { status: "PUBLISHED" } }),
      prisma.car.count({ where: { status: "DRAFT" } })
    ]);
  }
  return (
    <div className="space-y-4">
      <PendingPayments />
      <div>
        <h2 className="text-base font-bold">2. Listings waiting</h2>
      </div>
      <InventoryTable
      basePath="/admin/inventory/pending-review"
      title="Pending review"
      subtitle="User submissions and drafts waiting for a decision."
      baseStatus="DRAFT"
      extraStatuses={["BLOCKED"]}
      ownCount={pendingCount}
      otherHref="/admin/inventory/published"
      otherLabel={`← Published (${publishedCount})`}
      emptyText="All caught up — no listings waiting for review."
      showApprove={true}
      showWaiting={true}
      searchParams={searchParams}
    />
    </div>
  );
}
