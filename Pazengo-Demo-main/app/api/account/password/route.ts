import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession, hashPassword, verifyPassword } from "@/lib/auth";
import { passwordChangeSchema } from "@/lib/validators";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const json = await req.json().catch(() => ({}));
    const parsed = passwordChangeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid passwords" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
    }
    await prisma.user.update({
      where: { id: session.id },
      data: { passwordHash: await hashPassword(parsed.data.next) }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not change your password. Please try again." }, { status: 500 });
  }
}
