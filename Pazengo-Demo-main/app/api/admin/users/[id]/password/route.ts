import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { adminUserPasswordSchema } from "@/lib/validators";

/** Set a user's password directly. Takes effect immediately. */
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = adminUserPasswordSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid password" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
    await prisma.auditLog.create({ data: { actor, action: `Set password for ${user.name}`, entity: "User", entityId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not set password." }, { status: 500 });
  }
}
