import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { enquiryRecordSchema } from "@/lib/validators";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = enquiryRecordSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid enquiry" }, { status: 400 });
    const car = await prisma.car.findUnique({ where: { id: parsed.data.carId }, select: { id: true, status: true } });
    if (!car || car.status !== "PUBLISHED") return NextResponse.json({ error: "Listing not available" }, { status: 404 });
    const message = parsed.data.message?.trim() || null;
    await prisma.enquiry.upsert({
      where: { userId_carId_channel: { userId: session.id, carId: car.id, channel: parsed.data.channel } },
      update: { ...(message ? { message } : {}), updatedAt: new Date() },
      create: { userId: session.id, carId: car.id, channel: parsed.data.channel, message }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not record enquiry." }, { status: 500 });
  }
}
