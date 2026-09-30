import CarForm from "@/components/car-form";
import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";
import { getAllAssignments, getVehicleTypes } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewCarPage(): Promise<JSX.Element> {
  await guard();
  let makes: string[] = [];
  let modelsByMake: Record<string, string[]> = {};
  let vehicleTypes: Awaited<ReturnType<typeof getVehicleTypes>> = [];
  let assignments: Awaited<ReturnType<typeof getAllAssignments>> = {};
  let libraryMakes: string[] = [];
  let libraryLocations: string[] = [];
  let inventoryLocations: string[] = [];
  let maxPhotos = 10;
  if (await dbOk()) {
    const [makeRows, modelRows, locationRows] = await Promise.all([
      prisma.car.groupBy({ by: ["make"], _count: { make: true } }),
      prisma.car.groupBy({ by: ["make", "model"], _count: { model: true } }),
      prisma.car.groupBy({ by: ["location"], _count: { location: true } })
    ]);
    makes = makeRows.map((r) => r.make).sort((a, b) => a.localeCompare(b));
    for (const r of modelRows) {
      (modelsByMake[r.make] ??= []).push(r.model);
    }
    for (const k of Object.keys(modelsByMake)) modelsByMake[k].sort((a, b) => a.localeCompare(b));
    inventoryLocations = locationRows.map((r) => r.location).filter((l) => l.trim().length > 0).sort((a, b) => a.localeCompare(b));
    vehicleTypes = await getVehicleTypes();
    assignments = await getAllAssignments();
    maxPhotos = await getSetting("maxPhotos");
    const seenMake = new Set<string>();
    const seenLoc = new Set<string>();
    for (const fields of Object.values(assignments)) {
      for (const f of fields) {
        if (f.binding === "make") for (const o of f.options) { if (!seenMake.has(o.toLowerCase())) { seenMake.add(o.toLowerCase()); libraryMakes.push(o); } }
        if (f.binding === "location") for (const o of f.options) { if (!seenLoc.has(o.toLowerCase())) { seenLoc.add(o.toLowerCase()); libraryLocations.push(o); } }
      }
    }
  }
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Add listing to inventory</h1>
        <p className="text-sm text-gray-600">Pick a vehicle type — the form follows its fields. Listings save as draft until you set status to Published. Chassis numbers must be unique.</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <CarForm makes={makes} modelsByMake={modelsByMake} vehicleTypes={vehicleTypes} assignments={assignments} libraryMakes={libraryMakes} libraryLocations={libraryLocations} inventoryLocations={inventoryLocations} maxPhotos={maxPhotos} />
      </div>
    </div>
  );
}
