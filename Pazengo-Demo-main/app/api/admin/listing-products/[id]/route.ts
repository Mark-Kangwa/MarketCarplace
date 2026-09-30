import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { listingProductSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = listingProductSchema.partial().safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid product" }, { status: 400 });
    }
    const product = await prisma.listingProduct.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const d = parsed.data;
    if (d.name) {
      const dupe = await prisma.listingProduct.findFirst({
        where: { name: { equals: d.name.trim(), mode: "insensitive" }, NOT: { id: product.id } }
      });
      if (dupe) return NextResponse.json({ error: `“${dupe.name}” already exists.` }, { status: 409 });
    }
    await prisma.listingProduct.update({
      where: { id: product.id },
      data: {
        ...(d.name ? { name: d.name.trim() } : {}),
        ...(d.description !== undefined ? { description: d.description?.trim() || "" } : {}),
        ...(d.priceZmw !== undefined ? { priceZmw: d.priceZmw } : {}),
        ...(d.durationDays !== undefined ? { durationDays: d.durationDays } : {})
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Edited listing product ${product.name}`, entity: "ListingProduct", entityId: product.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update product." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const product = await prisma.listingProduct.findUnique({
      where: { id: params.id },
      include: { _count: { select: { cars: true } } }
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    // History survives via the per-listing name snapshot — backfill any rows
    // that predate snapshots, then delete freely.
    await prisma.car.updateMany({
      where: { listingProductId: product.id, productName: null },
      data: { productName: product.name }
    });
    await prisma.listingProduct.delete({ where: { id: product.id } });
    await prisma.auditLog.create({
      data: { actor, action: `Deleted listing product ${product.name}${product._count.cars ? ` (${product._count.cars} past listings keep its name)` : ""}`, entity: "ListingProduct", entityId: product.id }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete product." }, { status: 500 });
  }
}
