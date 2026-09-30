import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createUserSession, clearSessionCookie, hashPassword, userSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid registration details" }, { status: 400 });
    }
    const d = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: {
        name: d.name.trim(),
        email: d.email,
        phone: d.phone?.trim() || null,
        passwordHash: await hashPassword(d.password),
        // Public registration is buyer-only; dealer accounts are out of scope.
        role: "BUYER",
        status: "ACTIVE"
      }
    });
    const token = await createUserSession({ id: user.id, email: user.email, name: user.name, role: user.role });
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", userSessionCookie(token));
    // Single active identity: signing in as a user ends any admin session.
    res.headers.append("Set-Cookie", clearSessionCookie());
    return res;
  } catch {
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
