import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminUserRoleSchema } from "@/lib/validators";

async function target(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

/** Change role (General / Dealer / Administrator). Never your own row. */
export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = adminUserRoleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid role" }, { status: 400 });
    }
    const user = await target(params.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.email.toLowerCase() === actor.toLowerCase()) {
      return NextResponse.json({ error: "You cannot change your own role from here." }, { status: 403 });
    }
    if (user.role === parsed.data.role) return NextResponse.json({ ok: true });
    await prisma.user.update({ where: { id: user.id }, data: { role: parsed.data.role } });
    await prisma.auditLog.create({ data: { actor, action: `Changed ${user.name} role ${user.role} → ${parsed.data.role}`, entity: "User", entityId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not change role." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: { _count: { select: { cars: true, listings: true, payments: true } } }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.email.toLowerCase() === actor.toLowerCase()) {
      return NextResponse.json({ error: "You cannot delete your own account from here." }, { status: 403 });
    }
    const blockers: string[] = [];
    if (user._count.listings > 0) blockers.push(`${user._count.listings} listed car${user._count.listings === 1 ? "" : "s"}`);
    if (user._count.cars > 0) blockers.push(`${user._count.cars} dealer car${user._count.cars === 1 ? "" : "s"}`);
    if (user._count.payments > 0) blockers.push(`${user._count.payments} payment${user._count.payments === 1 ? "" : "s"}`);
    if (blockers.length > 0) {
      return NextResponse.json({ error: `Cannot delete ${user.name} — ${blockers.join(", ")} on record. Block instead to revoke access.` }, { status: 409 });
    }
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.auditLog.create({ data: { actor, action: `Deleted user ${user.name}`, entity: "User", entityId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete user." }, { status: 500 });
  }
}
