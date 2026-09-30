import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";
import InventoryTable, { type InventorySearchParams } from "@/components/inventory-table";

export const dynamic = "force-dynamic";

export default async function PublishedInventoryPage({ searchParams }: { searchParams: InventorySearchParams }): Promise<JSX.Element> {
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
    <InventoryTable
      basePath="/admin/inventory/published"
      title="Published"
      subtitle="Everything live on the marketplace."
      baseStatus="PUBLISHED"
      extraStatuses={["SOLD"]}
      ownCount={publishedCount}
      otherHref="/admin/inventory/pending-review"
      otherLabel={`Pending review (${pendingCount}) →`}
      emptyText="No published stock yet. Publish from Pending review or add a car."
      showApprove={false}
      showWaiting={false}
      searchParams={searchParams}
    />
  );
}
