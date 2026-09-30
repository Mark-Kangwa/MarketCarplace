import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { duplicateCarMessage } from "@/lib/prisma-errors";
import { getAssignments, validateListing, absorbObservedOptions } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

export async function POST(req: Request): Promise<NextResponse> {
  let chassisNo = "";
  try {
    const actor = await requireAdmin();
    const json = await req.json();
    const vehicleTypeId = typeof json.vehicleTypeId === "string" ? json.vehicleTypeId : "";
    const vtype = vehicleTypeId ? await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId } }) : null;
    if (!vtype) return NextResponse.json({ error: "Choose a vehicle type for this listing." }, { status: 400 });
    const assigned = await getAssignments(vtype.id);
    const checked = validateListing({ ...(json as Record<string, unknown>) }, vtype.name, assigned, {}, await getSetting("maxPhotos"));
    if (!checked.data) return NextResponse.json({ error: checked.error ?? "Invalid listing data" }, { status: 400 });
    const d = checked.data.system;
    chassisNo = d.chassisNo?.trim() ?? "";
    const car = await prisma.car.create({
      data: {
        make: d.make.trim(),
        model: d.model.trim(),
        variant: d.variant?.trim() || null,
        year: d.year,
        priceZmw: d.priceZmw,
        mileageKm: d.mileageKm,
        transmission: d.transmission,
        fuel: d.fuel,
        bodyType: d.bodyType,
        drivetrain: d.drivetrain,
        condition: d.condition,
        chassisNo: d.chassisNo?.trim() || null,
        color: d.color?.trim() || null,
        location: d.location.trim(),
        seats: d.seats,
        serviceHistory: d.serviceHistory,
        status: d.status,
        soldAt: d.status === "SOLD" ? new Date() : null,
        isFeatured: d.isFeatured,
        featuredAt: d.isFeatured ? new Date() : null,
        photos: d.photos,
        features: d.features,
        vehicleTypeId: vtype.id,
        attributes: checked.data.attributes,
        createdBy: actor
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Added ${vtype.name.toLowerCase()} ${car.make} ${car.model}${car.isFeatured ? " ★ featured" : ""}`, entity: "Car", entityId: car.id } });
    try {
      await absorbObservedOptions(assigned, d, checked.data.attributes);
    } catch (e: unknown) {
      console.error("absorbObservedOptions failed:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true, id: car.id });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const dup = duplicateCarMessage(e, chassisNo);
    if (dup) return NextResponse.json({ error: dup }, { status: 409 });
    return NextResponse.json({ error: "Could not save listing." }, { status: 500 });
  }
}
