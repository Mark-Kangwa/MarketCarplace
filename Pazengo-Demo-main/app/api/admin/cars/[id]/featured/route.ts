import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { featuredToggleSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = featuredToggleSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid featured value" }, { status: 400 });
    const { isFeatured } = parsed.data;
    const car = await prisma.car.update({
      where: { id: params.id },
      data: { isFeatured, featuredAt: isFeatured ? new Date() : null }
    });
    await prisma.auditLog.create({
      data: { actor, action: `${isFeatured ? "Featured" : "Unfeatured"} car ${car.make} ${car.model}`, entity: "Car", entityId: car.id }
    });
    return NextResponse.json({ ok: true, isFeatured: car.isFeatured });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update featured status." }, { status: 500 });
  }
}
