import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const DECISIONS = ["REQUEST_CHANGES", "REJECTED"] as const;

/**
 * Send review feedback to the seller: free-text message plus a decision.
 * Both decisions keep the car as Draft so the seller can amend and resubmit.
 */
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const decision = String(json.decision ?? "");
    const message = typeof json.message === "string" ? json.message.trim() : "";
    if (!(DECISIONS as readonly string[]).includes(decision)) {
      return NextResponse.json({ error: "Choose request changes or reject." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Write a message — the seller needs to know what to fix." }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Keep feedback under 2000 characters." }, { status: 400 });
    }
    const car = await prisma.car.findUnique({
      where: { id: params.id },
      select: { id: true, make: true, model: true, ownerId: true }
    });
    if (!car) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    if (!car.ownerId) {
      return NextResponse.json({ error: "Feedback is for user listings — admin stock needs no review." }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await tx.listingReview.create({
        data: { carId: car.id, actor, decision: decision as (typeof DECISIONS)[number], message }
      });
      await tx.car.update({ where: { id: car.id }, data: { status: "DRAFT" } });
    });
    await prisma.auditLog.create({
      data: { actor, action: `${decision === "REJECTED" ? "Rejected" : "Requested changes on"} ${car.make} ${car.model}: ${message.slice(0, 120)}`, entity: "Car", entityId: car.id }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not send feedback." }, { status: 500 });
  }
}
