import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, clearUserSessionCookie, sessionCookie, verifyAdminCredentials, verifyPassword } from "@/lib/auth";

export async function POST(req: Request): Promise<NextResponse> {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  const address = String(email).toLowerCase().trim();
  // DB admins first (bcrypt row + ADMIN + ACTIVE), env credentials fallback.
  // Either way the same admin cookie is issued — downstream guards unchanged.
  const row = await prisma.user.findUnique({ where: { email: address } });
  if (row && row.passwordHash && row.role === "ADMIN" && row.status === "ACTIVE") {
    if (!(await verifyPassword(String(password), row.passwordHash))) {
      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }
  } else if (!(await verifyAdminCredentials(String(email), String(password)))) {
    return NextResponse.json({ error: "Invalid login" }, { status: 401 });
  }
  const token = await createSession(address);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie(token));
  // Single active identity: signing in as admin ends any user session.
  res.headers.append("Set-Cookie", clearUserSessionCookie());
  return res;
}
