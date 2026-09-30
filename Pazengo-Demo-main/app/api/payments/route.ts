import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const PAY_METHODS = ["EFT", "MOBILE_MONEY"] as const;

/**
 * Pay-first package purchase: records a PENDING listing-fee payment with no
 * car attached. An APPROVED + unused (carId null) payment is a listing
 * credit the form step consumes. Blocked while a pending payment or an
 * unused credit for the same product already exists (queue anti-spam).
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const productId = typeof json.productId === "string" ? json.productId : "";
    const product = productId ? await prisma.listingProduct.findUnique({ where: { id: productId } }) : null;
    if (!product) {
      return NextResponse.json({ error: "That package is no longer available — pick another one." }, { status: 400 });
    }
    if (product.priceZmw === 0) {
      return NextResponse.json({ error: "The free package needs no payment — continue straight to the form." }, { status: 400 });
    }
    const method = String(json.method ?? "");
    const reference = String(json.reference ?? "").trim();
    const proofUrl = String(json.proofUrl ?? "").trim();
    if (!(PAY_METHODS as readonly string[]).includes(method)) {
      return NextResponse.json({ error: "Choose a payment method: EFT or Mobile money." }, { status: 400 });
    }
    if (reference.length < 3 || reference.length > 60) {
      return NextResponse.json({ error: "Enter your payment transaction reference (3–60 characters)." }, { status: 400 });
    }
    if (proofUrl && (!proofUrl.startsWith("/uploads/") || proofUrl.length > 500)) {
      return NextResponse.json({ error: "Proof must be a file you uploaded here." }, { status: 400 });
    }
    const existing = await prisma.payment.findFirst({
      where: {
        userId: session.id,
        listingProductId: product.id,
        kind: "LISTING_FEE",
        OR: [{ status: "PENDING" }, { status: "APPROVED", carId: null }]
      },
      select: { id: true, status: true }
    });
    if (existing) {
      return NextResponse.json({
        error: existing.status === "PENDING"
          ? "You already have a payment awaiting review for this package."
          : "You already have an approved payment for this package — continue to the form from My cars."
      }, { status: 409 });
    }
    const payment = await prisma.payment.create({
      data: {
        userId: session.id,
        kind: "LISTING_FEE",
        amountZar: product.priceZmw * 100,
        currency: "ZMW",
        method,
        reference,
        proofUrl: proofUrl || null,
        carId: null,
        listingProductId: product.id
      }
    });
    return NextResponse.json({ ok: true, paymentId: payment.id });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to pay for a package." }, { status: 401 });
    return NextResponse.json({ error: "Could not record your payment." }, { status: 500 });
  }
}
