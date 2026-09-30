import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await requireUser();
    await prisma.$transaction([
      prisma.recentView.deleteMany({ where: { userId: session.id } }),
      prisma.searchHistory.deleteMany({ where: { userId: session.id } })
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not clear history." }, { status: 500 });
  }
}
