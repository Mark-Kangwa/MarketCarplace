import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { favoriteListSchema } from "@/lib/validators";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const { searchParams } = new URL(req.url);
    const carId = searchParams.get("carId") ?? "";
    const lists = await prisma.favoriteList.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { favorites: true } } }
    });
    let memberListId: string | null = null;
    if (carId) {
      const fav = await prisma.favorite.findUnique({
        where: { userId_carId: { userId: session.id, carId } },
        select: { listId: true }
      });
      // Presence of a row (even with null listId) means favourited.
      memberListId = fav ? (fav.listId ?? "__unsorted__") : null;
    }
    return NextResponse.json({
      lists: lists.map((l) => ({ id: l.id, name: l.name, count: l._count.favorites })),
      memberListId
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load lists." }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = favoriteListSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid list name" }, { status: 400 });
    }
    const existing = await prisma.favoriteList.findUnique({
      where: { userId_name: { userId: session.id, name: parsed.data.name } }
    });
    if (existing) return NextResponse.json({ error: "You already have a list with that name." }, { status: 409 });
    const list = await prisma.favoriteList.create({
      data: { userId: session.id, name: parsed.data.name }
    });
    return NextResponse.json({ ok: true, list: { id: list.id, name: list.name, count: 0 } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not create list." }, { status: 500 });
  }
}
