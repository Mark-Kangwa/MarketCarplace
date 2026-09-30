import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

/** Renew a listing under a (possibly new) package. Paid renewals consume an approved credit. */
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const productId = typeof json.productId === "string" ? json.productId : "";
    const product = productId ? await prisma.listingProduct.findUnique({ where: { id: productId } }) : null;
    if (!product) {
      return NextResponse.json({ error: "That package is no longer available — pick another one." }, { status: 400 });
    }
    const car = await prisma.car.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, status: true, expiresAt: true }
    });
    if (!car || car.ownerId !== session.id) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (car.status === "BLOCKED") {
      return NextResponse.json({ error: "This listing is blocked — contact us to resolve it." }, { status: 403 });
    }
    const isFree = product.priceZmw === 0;
    if (isFree) {
      const freeLiveLimit = await getSetting("freeLiveLimit");
      const liveFree = await prisma.car.count({
        where: {
          ownerId: session.id,
          NOT: { id: car.id },
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
      await prisma.car.update({
        where: { id: car.id },
        data: {
          listingProductId: product.id,
          productName: product.name,
          expiresAt: null,
          status: "DRAFT",
          soldAt: null
        }
      });
      return NextResponse.json({ ok: true });
    }
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
      return NextResponse.json({ error: "Pay for this package first — an approved payment unlocks renewal." }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.payment.findUnique({ where: { id: credit.id }, select: { carId: true, status: true } });
      if (!fresh || fresh.status !== "APPROVED" || fresh.carId !== null) {
        throw new Error("CREDIT_SPENT");
      }
      await tx.car.update({
        where: { id: car.id },
        data: {
          listingProductId: product.id,
          productName: product.name,
          expiresAt: null,
          status: "DRAFT",
          soldAt: null
        }
      });
      await tx.payment.update({ where: { id: credit.id }, data: { carId: car.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to renew your listing." }, { status: 401 });
    if (e instanceof Error && e.message === "CREDIT_SPENT") {
      return NextResponse.json({ error: "That payment was already used for another listing." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not renew your listing." }, { status: 500 });
  }
}
