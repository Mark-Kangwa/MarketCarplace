import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Owner status flips: mark sold, or send back to review. Publishing stays admin-only. */
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const status = String(json.status ?? "");
    if (status !== "SOLD" && status !== "DRAFT") {
      return NextResponse.json({ error: "You can only mark a car sold or send it back to review." }, { status: 400 });
    }
    const car = await prisma.car.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, status: true, soldAt: true }
    });
    if (!car || car.ownerId !== session.id) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (car.status === "BLOCKED") {
      return NextResponse.json({ error: "This listing is blocked — contact us to resolve it." }, { status: 403 });
    }
    await prisma.car.update({
      where: { id: car.id },
      data: status === "SOLD"
        ? { status: "SOLD", soldAt: car.soldAt ?? new Date() }
        : { status: "DRAFT", soldAt: null }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to manage your listing." }, { status: 401 });
    return NextResponse.json({ error: "Could not update your listing." }, { status: 500 });
  }
}
