import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { favoriteSaveSchema, favoriteToggleSchema } from "@/lib/validators";

async function publishedCar(carId: string) {
  return prisma.car.findUnique({ where: { id: carId }, select: { id: true, status: true } });
}

/** Save (or move) a car into a list. The list must belong to the caller. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = favoriteSaveSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Choose a list" }, { status: 400 });
    const car = await publishedCar(parsed.data.carId);
    if (!car || car.status !== "PUBLISHED") return NextResponse.json({ error: "Listing not available" }, { status: 404 });
    const list = await prisma.favoriteList.findFirst({ where: { id: parsed.data.listId, userId: session.id } });
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    await prisma.favorite.upsert({
      where: { userId_carId: { userId: session.id, carId: car.id } },
      update: { listId: list.id },
      create: { userId: session.id, carId: car.id, listId: list.id }
    });
    return NextResponse.json({ ok: true, favorited: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not save favourite." }, { status: 500 });
  }
}

/** Remove a car from favourites entirely (whatever list holds it). */
export async function DELETE(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = favoriteToggleSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Missing car" }, { status: 400 });
    await prisma.favorite.deleteMany({ where: { userId: session.id, carId: parsed.data.carId } });
    return NextResponse.json({ ok: true, favorited: false });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not remove favourite." }, { status: 500 });
  }
}
