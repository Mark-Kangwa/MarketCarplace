import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const url = new URL(req.url);
    const isBlock = url.pathname.endsWith("/block");
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
    if (isBlock && (!reason || reason.trim().length < 3)) {
      return NextResponse.json({ error: "A reason is required to block." }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: params.id },
      data: isBlock
        ? { status: "BLOCKED", blockedReason: String(reason).slice(0, 300) }
        : { status: "ACTIVE", blockedReason: null }
    });
    await prisma.auditLog.create({
      data: { actor, action: isBlock ? `Blocked ${user.email}: ${reason}` : `Restored access for ${user.email}`, entity: "User", entityId: user.id }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
