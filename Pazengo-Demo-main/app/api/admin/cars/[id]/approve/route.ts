import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** One-click approval: DRAFT → PUBLISHED. Everything else goes through the edit page. */
export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const car = await prisma.car.findUnique({
      where: { id: params.id },
      select: { id: true, make: true, model: true, status: true, listingProductId: true }
    });
    if (!car) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (car.status !== "DRAFT") {
      return NextResponse.json({ error: `Only drafts can be published this way — this one is ${car.status}.` }, { status: 409 });
    }
    let expiresAt: Date | null = null;
    if (car.listingProductId) {
      const prod = await prisma.listingProduct.findUnique({ where: { id: car.listingProductId }, select: { durationDays: true } });
      expiresAt = prod ? new Date(Date.now() + prod.durationDays * 86_400_000) : null;
    }
    await prisma.car.update({ where: { id: car.id }, data: { status: "PUBLISHED", expiresAt } });
    await prisma.auditLog.create({ data: { actor, action: `Published ${car.make} ${car.model} from review queue`, entity: "Car", entityId: car.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not publish listing." }, { status: 500 });
  }
}
