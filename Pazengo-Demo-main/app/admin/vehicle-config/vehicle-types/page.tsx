import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import VehicleTypeManager from "@/components/vehicle-type-manager";

export const dynamic = "force-dynamic";

export default async function VehicleTypesPage(): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const types = await prisma.vehicleType.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { fields: true, cars: true } } }
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Vehicle types</h1>
        <p className="text-sm text-gray-600">Car, Motorbike, Boats, Trucks — each type gets its own set of inventory fields.</p>
      </div>
      <VehicleTypeManager initial={types} />
    </div>
  );
}
