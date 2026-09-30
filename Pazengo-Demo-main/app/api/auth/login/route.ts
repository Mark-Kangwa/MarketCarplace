import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createUserSession, clearSessionCookie, userSessionCookie, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

const GENERIC_ERROR = "That email or password did not match. Check caps lock and try again.";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // ADMIN rows belong on the admin door — their user cookie would be unusable.
    if (!user || !user.passwordHash || user.status !== "ACTIVE" || user.role === "ADMIN") {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }
    const token = await createUserSession({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", userSessionCookie(token));
    // Single active identity: signing in as a user ends any admin session.
    res.headers.append("Set-Cookie", clearSessionCookie());
    return res;
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }
}
