import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { clearUserSessionCookie, getUserSession, verifyPassword } from "@/lib/auth";
import { deleteAccountSchema } from "@/lib/validators";

export async function DELETE(req: Request): Promise<NextResponse> {
  try {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const json = await req.json().catch(() => ({}));
    const parsed = deleteAccountSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Password confirmation required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Your password is incorrect." }, { status: 401 });
    }
    const avatarPath = user.avatarUrl?.startsWith("/avatars/") ? path.join(process.cwd(), "public", user.avatarUrl) : null;
    await prisma.$transaction([
      prisma.car.updateMany({ where: { dealerId: session.id }, data: { dealerId: null } }),
      prisma.auditLog.updateMany({ where: { actorId: session.id }, data: { actorId: null } }),
      prisma.user.delete({ where: { id: session.id } })
    ]);
    if (avatarPath) {
      await unlink(avatarPath).catch(() => undefined);
    }
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", clearUserSessionCookie());
    return res;
  } catch {
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 });
  }
}
