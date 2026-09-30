import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { favoriteListSchema } from "@/lib/validators";

async function ownList(userId: string, id: string) {
  return prisma.favoriteList.findFirst({ where: { id, userId } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = favoriteListSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid list name" }, { status: 400 });
    }
    const list = await ownList(session.id, params.id);
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    const clash = await prisma.favoriteList.findUnique({
      where: { userId_name: { userId: session.id, name: parsed.data.name } }
    });
    if (clash && clash.id !== list.id) {
      return NextResponse.json({ error: "You already have a list with that name." }, { status: 409 });
    }
    await prisma.favoriteList.update({ where: { id: list.id }, data: { name: parsed.data.name } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not rename list." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const list = await ownList(session.id, params.id);
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    // Members fall back to Unsorted — cars are never deleted with a list.
    await prisma.$transaction([
      prisma.favorite.updateMany({ where: { listId: list.id }, data: { listId: null } }),
      prisma.favoriteList.delete({ where: { id: list.id } })
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete list." }, { status: 500 });
  }
}
