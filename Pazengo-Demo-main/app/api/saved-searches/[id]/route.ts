import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { savedSearchUpdateSchema } from "@/lib/validators";

async function ownSearch(userId: string, id: string) {
  return prisma.savedSearch.findFirst({ where: { id, userId } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = savedSearchUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid details" }, { status: 400 });
    }
    const data: { name?: string; emailAlerts?: boolean } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.emailAlerts !== undefined) data.emailAlerts = parsed.data.emailAlerts;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const saved = await ownSearch(session.id, params.id);
    if (!saved) return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    await prisma.savedSearch.update({ where: { id: saved.id }, data });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update saved search." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const saved = await ownSearch(session.id, params.id);
    if (!saved) return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    await prisma.savedSearch.delete({ where: { id: saved.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete saved search." }, { status: 500 });
  }
}
