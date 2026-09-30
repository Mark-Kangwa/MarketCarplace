import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const items = await prisma.menuItem.findMany({
      where: { scope: "header" },
      orderBy: { position: "asc" }
    });
    return NextResponse.json({ items });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load menu." }, { status: 500 });
  }
}
