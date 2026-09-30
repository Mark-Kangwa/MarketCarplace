import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createUserSession, getUserSession, userSessionCookie } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validators";

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const json = await req.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid details" }, { status: 400 });
    }
    const data: { name?: string; phone?: string | null } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone.trim() || null;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const user = await prisma.user.update({ where: { id: session.id }, data });
    const token = await createUserSession({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", userSessionCookie(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Could not update your profile. Please try again." }, { status: 500 });
  }
}
