import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const saved = await prisma.savedSearch.findFirst({ where: { id: params.id, userId: session.id } });
    if (!saved) return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    await prisma.savedSearch.update({ where: { id: saved.id }, data: { lastSeenAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update saved search." }, { status: 500 });
  }
}
