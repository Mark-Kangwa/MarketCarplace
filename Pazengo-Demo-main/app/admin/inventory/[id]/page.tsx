import { notFound } from "next/navigation";
import CarForm from "@/components/car-form";
import CarCard from "@/components/car-card";
import DeleteCarButton from "@/components/delete-car-button";
import ReviewThread from "@/components/review-thread";
import FeedbackForm from "@/components/feedback-form";
import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";
import { getAllAssignments, getVehicleTypes } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EditCarPage({ params }: { params: { id: string } }): Promise<JSX.Element> {
  await guard();
  if (!(await dbOk())) return <p className="text-sm">Database not connected.</p>;
  const car = await prisma.car.findUnique({ where: { id: params.id }, include: { owner: { select: { name: true, email: true } } } });
  if (!car) notFound();
  const reviews = await prisma.listingReview.findMany({
    where: { carId: car.id },
    orderBy: { createdAt: "asc" }
  });
  const photos = Array.isArray(car.photos) ? (car.photos as string[]) : [];
  const features = Array.isArray(car.features) ? (car.features as string[]) : [];
  const makeRows = await prisma.car.groupBy({ by: ["make"], _count: { make: true } });
  const makes = makeRows.map((r) => r.make).sort((a, b) => a.localeCompare(b));
  const modelRows = await prisma.car.groupBy({ by: ["make", "model"], _count: { model: true } });
  const modelsByMake: Record<string, string[]> = {};
  for (const r of modelRows) {
    (modelsByMake[r.make] ??= []).push(r.model);
  }
  for (const k of Object.keys(modelsByMake)) modelsByMake[k].sort((a, b) => a.localeCompare(b));
  const vehicleTypes = await getVehicleTypes();
  const assignments = await getAllAssignments();
  const maxPhotos = await getSetting("maxPhotos");
  const locationRows = await prisma.car.groupBy({ by: ["location"], _count: { location: true } });
  const inventoryLocations = locationRows.map((r) => r.location).filter((l) => l.trim().length > 0).sort((a, b) => a.localeCompare(b));
  const libraryMakes: string[] = [];
  const libraryLocations: string[] = [];
  const seenMake = new Set<string>();
  const seenLoc = new Set<string>();
  for (const fields of Object.values(assignments)) {
    for (const f of fields) {
      if (f.binding === "make") for (const o of f.options) { if (!seenMake.has(o.toLowerCase())) { seenMake.add(o.toLowerCase()); libraryMakes.push(o); } }
      if (f.binding === "location") for (const o of f.options) { if (!seenLoc.has(o.toLowerCase())) { seenLoc.add(o.toLowerCase()); libraryLocations.push(o); } }
    }
  }
  const attrs = (car.attributes ?? {}) as Record<string, unknown>;
  const initial: Record<string, string | number | string[] | boolean | Record<string, unknown> | undefined> = {
    make: car.make, model: car.model, variant: car.variant ?? "",
    year: car.year, priceZmw: car.priceZmw, mileageKm: car.mileageKm,
    transmission: car.transmission, fuel: car.fuel, bodyType: car.bodyType,
    drivetrain: car.drivetrain ?? "",
    condition: car.condition, chassisNo: car.chassisNo ?? "", color: car.color ?? "",
    location: car.location ?? "", seats: car.seats, serviceHistory: car.serviceHistory,
    status: car.status, isFeatured: car.isFeatured, photos, features,
    vehicleTypeId: car.vehicleTypeId ?? undefined, attributes: attrs
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Edit {car.year} {car.make} {car.model}</h1>
          <p className="text-sm text-gray-600">Changes apply immediately to the public listing when published.</p>
          {car.owner ? (
            <p className="mt-2 inline-block rounded bg-blue-100 px-2.5 py-1 text-xs font-bold text-trader">
              Uploaded by {car.owner.name} ({car.owner.email}) — publish to go live.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <CarForm id={car.id} initial={initial} makes={makes} modelsByMake={modelsByMake} vehicleTypes={vehicleTypes} assignments={assignments} libraryMakes={libraryMakes} libraryLocations={libraryLocations} inventoryLocations={inventoryLocations} maxPhotos={maxPhotos} />
        </div>
        {car.owner ? (
          <section aria-label="Review feedback" className="space-y-3 rounded-lg border border-line bg-white p-4">
            <h2 className="font-bold">Review feedback for {car.owner.name}</h2>
            <ReviewThread reviews={reviews} />
            <FeedbackForm carId={car.id} />
          </section>
        ) : null}
        <DeleteCarButton id={car.id} label={`${car.year} ${car.make} ${car.model}`} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-gray-600">Buyer preview</h2>
        <CarCard car={{ id: car.id, make: car.make, model: car.model, variant: car.variant, year: car.year, priceZmw: car.priceZmw, mileageKm: car.mileageKm, transmission: car.transmission, fuel: car.fuel, condition: car.condition, photos: car.photos, isFeatured: car.isFeatured }} />
      </div>
    </div>
  );
}
