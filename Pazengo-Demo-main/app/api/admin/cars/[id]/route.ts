import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { duplicateCarMessage } from "@/lib/prisma-errors";
import { getAssignments, validateListing, absorbObservedOptions } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  let chassisNo = "";
  try {
    const actor = await requireAdmin();
    const json = await req.json();
    const prev = await prisma.car.findUnique({ where: { id: params.id }, select: { status: true, soldAt: true, expiresAt: true, attributes: true, listingProductId: true } });
    if (!prev) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    const vehicleTypeId = typeof json.vehicleTypeId === "string" ? json.vehicleTypeId : "";
    const vtype = vehicleTypeId ? await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId } }) : null;
    if (!vtype) return NextResponse.json({ error: "Choose a vehicle type for this listing." }, { status: 400 });
    const assigned = await getAssignments(vtype.id);
    const checked = validateListing(
      { ...(json as Record<string, unknown>) },
      vtype.name,
      assigned,
      (prev.attributes ?? {}) as Record<string, unknown>,
      await getSetting("maxPhotos")
    );
    if (!checked.data) return NextResponse.json({ error: checked.error ?? "Invalid listing data" }, { status: 400 });
    const d = checked.data.system;
    chassisNo = d.chassisNo?.trim() ?? "";
    // Stamp the sale moment once (edits to an already-sold car must not
    // restart the 5-day grace window); clear it when leaving SOLD.
    const soldAt = d.status === "SOLD" ? (prev.soldAt ?? new Date()) : null;
    // Package clock starts on publish: fresh publishes stamp expiresAt from
    // the product duration; live cars keep theirs; leaving PUBLISHED clears.
    let expiresAt: Date | null = null;
    if (d.status === "PUBLISHED") {
      if (prev.status === "PUBLISHED") {
        expiresAt = prev.expiresAt;
      } else if (prev.listingProductId) {
        const prod = await prisma.listingProduct.findUnique({ where: { id: prev.listingProductId }, select: { durationDays: true } });
        expiresAt = prod ? new Date(Date.now() + prod.durationDays * 86_400_000) : null;
      }
    }
    const car = await prisma.car.update({
      where: { id: params.id },
      data: {
        make: d.make.trim(), model: d.model.trim(),
        variant: d.variant?.trim() || null, year: d.year, priceZmw: d.priceZmw, mileageKm: d.mileageKm,
        transmission: d.transmission, fuel: d.fuel, bodyType: d.bodyType, drivetrain: d.drivetrain, condition: d.condition,
        chassisNo: d.chassisNo?.trim() || null, color: d.color?.trim() || null,
        location: d.location.trim(), seats: d.seats, serviceHistory: d.serviceHistory,
        status: d.status, soldAt, expiresAt, isFeatured: d.isFeatured,
        featuredAt: d.isFeatured ? new Date() : null,
        photos: d.photos, features: d.features,
        vehicleTypeId: vtype.id, attributes: checked.data.attributes
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Edited ${vtype.name.toLowerCase()} ${car.make} ${car.model} → ${car.status}${car.isFeatured ? " ★ featured" : " ☆ regular"}`, entity: "Car", entityId: car.id } });
    try {
      await absorbObservedOptions(assigned, d, checked.data.attributes);
    } catch (e: unknown) {
      console.error("absorbObservedOptions failed:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const dup = duplicateCarMessage(e, chassisNo);
    if (dup) return NextResponse.json({ error: dup }, { status: 409 });
    return NextResponse.json({ error: "Could not update listing." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const car = await prisma.car.findUnique({ where: { id: params.id } });
    await prisma.car.delete({ where: { id: params.id } });
    await prisma.auditLog.create({ data: { actor, action: `Removed listing ${car ? `${car.make} ${car.model}` : params.id}`, entity: "Car", entityId: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete listing." }, { status: 500 });
  }
}
