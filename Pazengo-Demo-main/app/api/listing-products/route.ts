import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Public product catalog for the sell flow (prices always re-verified server-side at submit). */
export async function GET(): Promise<NextResponse> {
  try {
    const products = await prisma.listingProduct.findMany({
      orderBy: { priceZmw: "asc" },
      select: { id: true, name: true, description: true, priceZmw: true, durationDays: true }
    });
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Could not load packages." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
