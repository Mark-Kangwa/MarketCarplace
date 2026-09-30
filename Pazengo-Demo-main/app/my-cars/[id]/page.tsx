import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CarForm from "@/components/car-form";
import AccountShell from "@/components/account-shell";
import ReviewThread from "@/components/review-thread";
import { prisma, dbOk } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAllAssignments, getVehicleTypes } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EditMyCarPage({ params }: { params: { id: string } }): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect(`/login?next=/my-cars/${params.id}`);
  }
  if (!(await dbOk())) {
    return (
      <AccountShell active="my-cars" crumb="My cars" title="My cars" subtitle="Edit your listing.">
        <p className="text-sm text-gray-600">Database not connected.</p>
      </AccountShell>
    );
  }
  const car = await prisma.car.findUnique({ where: { id: params.id } });
  if (!car || car.ownerId !== session.id) notFound();
  const reviews = await prisma.listingReview.findMany({
    where: { carId: car.id },
    orderBy: { createdAt: "asc" }
  });
  // Opening the edit page marks admin feedback seen.
  if (reviews.some((r) => !r.seenAt && (r.decision === "REQUEST_CHANGES" || r.decision === "REJECTED"))) {
    await prisma.listingReview.updateMany({ where: { carId: car.id, seenAt: null }, data: { seenAt: new Date() } });
  }
  const [makeRows, modelRows, locationRows, vehicleTypes, assignments] = await Promise.all([
    prisma.car.groupBy({ by: ["make"], _count: { make: true } }),
    prisma.car.groupBy({ by: ["make", "model"], _count: { model: true } }),
    prisma.car.groupBy({ by: ["location"], _count: { location: true } }),
    getVehicleTypes(),
    getAllAssignments()
  ]);
  const makes = makeRows.map((r) => r.make).sort((a, b) => a.localeCompare(b));
  const modelsByMake: Record<string, string[]> = {};
  for (const r of modelRows) {
    (modelsByMake[r.make] ??= []).push(r.model);
  }
  for (const k of Object.keys(modelsByMake)) modelsByMake[k].sort((a, b) => a.localeCompare(b));
  const inventoryLocations = locationRows.map((r) => r.location).filter((l) => l.trim().length > 0).sort((a, b) => a.localeCompare(b));
  const maxPhotos = await getSetting("maxPhotos");
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
  const photos = Array.isArray(car.photos) ? (car.photos as string[]) : [];
  const features = Array.isArray(car.features) ? (car.features as string[]) : [];
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
    <AccountShell
      active="my-cars"
      crumb="My cars"
      title={`Edit ${car.year} ${car.make} ${car.model}`}
      subtitle={car.status === "PUBLISHED" ? "Changes go live immediately." : car.status === "SOLD" ? "Sold cars stay visible briefly, then leave the marketplace." : "Changes return to review before going live."}
    >
      {reviews.length > 0 ? (
        <section aria-label="Reviewer feedback" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="font-bold">Reviewer feedback</h2>
          <div className="rounded bg-white p-1">
            <ReviewThread reviews={reviews} />
          </div>
          <p className="text-xs text-gray-600">Amend your car below and save — we&apos;ll pick it up for another review automatically.</p>
        </section>
      ) : null}
      <div className="rounded-lg border border-line bg-white p-4">
        <CarForm          id={car.id}
          mode="user"
          initial={initial}
          makes={makes}
          modelsByMake={modelsByMake}
          vehicleTypes={vehicleTypes}
          assignments={assignments}
          libraryMakes={libraryMakes}
          libraryLocations={libraryLocations}
          inventoryLocations={inventoryLocations}
          maxPhotos={maxPhotos}
        />
      </div>
      <p className="mt-3 text-sm">
        <Link href="/my-cars" className="font-semibold text-trader hover:underline">← Back to my cars</Link>
      </p>
    </AccountShell>
  );
}
