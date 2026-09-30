import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { listingProductSchema } from "@/lib/validators";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const products = await prisma.listingProduct.findMany({
      orderBy: { priceZmw: "asc" },
      include: { _count: { select: { cars: true } } }
    });
    return NextResponse.json({ products });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = listingProductSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid product" }, { status: 400 });
    }
    const dupe = await prisma.listingProduct.findFirst({
      where: { name: { equals: parsed.data.name.trim(), mode: "insensitive" } }
    });
    if (dupe) return NextResponse.json({ error: `“${dupe.name}” already exists.` }, { status: 409 });
    const product = await prisma.listingProduct.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || "",
        priceZmw: parsed.data.priceZmw,
        durationDays: parsed.data.durationDays
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Added listing product ${product.name}`, entity: "ListingProduct", entityId: product.id } });
    return NextResponse.json({ ok: true, product });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not create product." }, { status: 500 });
  }
}
