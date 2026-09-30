import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { duplicateCarMessage } from "@/lib/prisma-errors";
import { getAssignments, validateListing, absorbObservedOptions } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

async function ownListing(userId: string, id: string) {
  return prisma.car.findUnique({
    where: { id },
    select: { id: true, ownerId: true, status: true, soldAt: true, attributes: true }
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  let chassisNo = "";
  try {
    const session = await requireUser();
    const prev = await ownListing(session.id, params.id);
    if (!prev || prev.ownerId !== session.id) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (prev.status === "BLOCKED") {
      return NextResponse.json({ error: "This listing is blocked — contact us to resolve it." }, { status: 403 });
    }
    const json = await req.json();
    const vehicleTypeId = typeof json.vehicleTypeId === "string" ? json.vehicleTypeId : "";
    const vtype = vehicleTypeId ? await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId } }) : null;
    if (!vtype) return NextResponse.json({ error: "Choose a vehicle type for your listing." }, { status: 400 });
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
    // Users can take a car back to draft or mark it sold — publishing stays
    // admin-only, so a requested PUBLISHED is coerced to DRAFT.
    const status = d.status === "SOLD" ? "SOLD" : "DRAFT";
    const soldAt = status === "SOLD" ? (prev.soldAt ?? new Date()) : null;
    await prisma.car.update({
      where: { id: prev.id },
      data: {
        make: d.make.trim(), model: d.model.trim(),
        variant: d.variant?.trim() || null, year: d.year, priceZmw: d.priceZmw, mileageKm: d.mileageKm,
        transmission: d.transmission, fuel: d.fuel, bodyType: d.bodyType, drivetrain: d.drivetrain, condition: d.condition,
        chassisNo: d.chassisNo?.trim() || null, color: d.color?.trim() || null,
        location: d.location.trim(), seats: d.seats, serviceHistory: d.serviceHistory,
        status, soldAt,
        photos: d.photos, features: d.features,
        vehicleTypeId: vtype.id, attributes: checked.data.attributes
      }
    });
    // Resubmit signal: one RESUBMITTED row per feedback round — an edit after
    // request-changes/reject tells the admin the seller amended the car.
    const latest = await prisma.listingReview.findFirst({
      where: { carId: prev.id },
      orderBy: { createdAt: "desc" },
      select: { decision: true }
    });
    if (latest && (latest.decision === "REQUEST_CHANGES" || latest.decision === "REJECTED")) {
      await prisma.listingReview.create({
        data: { carId: prev.id, actor: session.email, decision: "RESUBMITTED", message: "Seller amended the listing and resubmitted for review." }
      });
    }
    try {
      await absorbObservedOptions(assigned, d, checked.data.attributes);
    } catch (e: unknown) {
      console.error("absorbObservedOptions failed:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to edit your listing." }, { status: 401 });
    const dup = duplicateCarMessage(e, chassisNo);
    if (dup) return NextResponse.json({ error: dup }, { status: 409 });
    return NextResponse.json({ error: "Could not update your listing." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const prev = await ownListing(session.id, params.id);
    if (!prev || prev.ownerId !== session.id) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    await prisma.car.delete({ where: { id: prev.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to delete your listing." }, { status: 401 });
    return NextResponse.json({ error: "Could not delete your listing." }, { status: 500 });
  }
}
