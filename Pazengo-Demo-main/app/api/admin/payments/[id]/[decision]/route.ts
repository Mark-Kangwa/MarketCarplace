import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const url = new URL(req.url);
    const approve = url.pathname.endsWith("/approve");
    const { note } = (await req.json().catch(() => ({}))) as { note?: string };
    if (!approve && (!note || !note.trim())) {
      return NextResponse.json({ error: "Rejections need a reason so the user knows what to fix." }, { status: 400 });
    }
    const payment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewNote: approve ? null : String(note).slice(0, 300),
        reviewedBy: actor,
        decidedAt: new Date()
      },
      include: { user: true }
    });
    await prisma.auditLog.create({
      data: {
        actor,
        action: approve ? `Approved ${payment.reference} (${payment.amountZar} ZAR)` : `Rejected ${payment.reference}: ${note}`,
        entity: "Payment",
        entityId: payment.id
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Decision failed." }, { status: 500 });
  }
}
