import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword, generateTempPassword } from "@/lib/auth";
import { adminUserCreateSchema } from "@/lib/validators";

/** WordPress-style create: any role incl. Administrator, temp password shown once. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = adminUserCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid user" }, { status: 400 });
    }
    const email = parsed.data.email;
    const dupe = await prisma.user.findUnique({ where: { email } });
    if (dupe) return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    const tempPassword = generateTempPassword();
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        phone: parsed.data.phone?.trim() || null,
        role: parsed.data.role,
        status: "ACTIVE",
        passwordHash: await hashPassword(tempPassword)
      },
      select: { id: true, name: true, email: true, role: true, status: true }
    });
    await prisma.auditLog.create({ data: { actor, action: `Created user ${user.name} (${user.role})`, entity: "User", entityId: user.id } });
    // Shown once — never stored or emailed. Share it with the user manually.
    return NextResponse.json({ ok: true, user, tempPassword });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not create user." }, { status: 500 });
  }
}

