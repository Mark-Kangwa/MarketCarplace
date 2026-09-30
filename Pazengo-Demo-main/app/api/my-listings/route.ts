import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { duplicateCarMessage } from "@/lib/prisma-errors";
import { getAssignments, validateListing, absorbObservedOptions } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";
/**
 * Checkout submit: creates the car (always DRAFT = in review) attached to a
 * product. Free products submit directly; paid ones consume an approved,
 * unused payment credit (paymentId) — verified and attached atomically, so
 * one payment can never list twice. Prices always come from the product row.
 * One live free listing per user.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let chassisNo = "";
  try {
    const session = await requireUser();
    const json = await req.json();
    const productId = typeof json.productId === "string" ? json.productId : "";
    const product = productId ? await prisma.listingProduct.findUnique({ where: { id: productId } }) : null;
    if (!product) {
      return NextResponse.json({ error: "That package is no longer available — pick another one." }, { status: 400 });
    }
    const vehicleTypeId = typeof json.vehicleTypeId === "string" ? json.vehicleTypeId : "";
    const vtype = vehicleTypeId ? await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId } }) : null;
    if (!vtype) return NextResponse.json({ error: "Choose a vehicle type for your listing." }, { status: 400 });
    const assigned = await getAssignments(vtype.id);
    const checked = validateListing({ ...(json as Record<string, unknown>) }, vtype.name, assigned, {}, await getSetting("maxPhotos"));
    if (!checked.data) return NextResponse.json({ error: checked.error ?? "Invalid listing data" }, { status: 400 });
    const d = checked.data.system;
    chassisNo = d.chassisNo?.trim() ?? "";
    const isFree = product.priceZmw === 0;
    if (isFree) {
      // Fair use: capped simultaneous live free listings per user —
      // non-sold, non-expired, non-blocked.
      const freeLiveLimit = await getSetting("freeLiveLimit");
      const liveFree = await prisma.car.count({
        where: {
          ownerId: session.id,
          listingProductId: product.id,
          status: { in: ["DRAFT", "PUBLISHED"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        }
      });
      if (liveFree >= freeLiveLimit) {
        return NextResponse.json({ error: freeLiveLimit === 1
          ? "You already have a live free listing — it must sell or expire before you list another one free."
          : `You already hold ${freeLiveLimit} live free listings — one must sell or expire first.` }, { status: 409 });
      }
    }
    let creditId: string | null = null;
    if (!isFree) {
      const paymentId = typeof json.paymentId === "string" ? json.paymentId : "";
      const credit = paymentId
        ? await prisma.payment.findUnique({
            where: { id: paymentId },
            select: { id: true, userId: true, status: true, carId: true, listingProductId: true }
          })
        : null;
      if (
        !credit ||
        credit.userId !== session.id ||
        credit.status !== "APPROVED" ||
        credit.carId !== null ||
        credit.listingProductId !== product.id
      ) {
        return NextResponse.json({ error: "That payment can't be used — it may be spent, pending, or for another package. Pay again from packages." }, { status: 400 });
      }
      creditId = credit.id;
    }
    const carData = {
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
      status: "DRAFT" as const,
      soldAt: null,
      isFeatured: false,
      featuredAt: null,
      photos: d.photos,
      features: d.features,
      vehicleTypeId: vtype.id,
      attributes: checked.data.attributes,
      ownerId: session.id,
      createdBy: session.email,
      listingProductId: product.id,
      productName: product.name,
      expiresAt: null
    };
    let carId = "";
    if (creditId) {
      // Consume the credit atomically with car creation: re-check unused
      // inside the transaction so a double submit can't list twice.
      const result = await prisma.$transaction(async (tx) => {
        const fresh = await tx.payment.findUnique({ where: { id: creditId as string }, select: { carId: true, status: true } });
        if (!fresh || fresh.status !== "APPROVED" || fresh.carId !== null) {
          throw new Error("CREDIT_SPENT");
        }
        const car = await tx.car.create({ data: carData });
        await tx.payment.update({ where: { id: creditId as string }, data: { carId: car.id } });
        return car.id;
      });
      carId = result;
    } else {
      const car = await prisma.car.create({ data: carData });
      carId = car.id;
    }
    try {
      await absorbObservedOptions(assigned, d, checked.data.attributes);
    } catch (e: unknown) {
      console.error("absorbObservedOptions failed:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true, id: carId });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to list your car." }, { status: 401 });
    if (e instanceof Error && e.message === "CREDIT_SPENT") {
      return NextResponse.json({ error: "That payment was already used for another listing." }, { status: 409 });
    }
    const dup = duplicateCarMessage(e, chassisNo);
    if (dup) return NextResponse.json({ error: dup }, { status: 409 });
    return NextResponse.json({ error: "Could not submit your listing." }, { status: 500 });
  }
}
