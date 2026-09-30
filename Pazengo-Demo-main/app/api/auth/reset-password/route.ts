import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validators";

const GENERIC = "That reset link is invalid or has expired. Ask an admin for a new one.";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function lookup(token: string) {
  if (!token || token.length > 200) return null;
  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, status: true } } }
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.user || row.user.status !== "ACTIVE") return null;
  return row;
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const row = await lookup(token);
  if (!row) return NextResponse.json({ error: GENERIC }, { status: 404 });
  return NextResponse.json({ ok: true, name: row.user.name });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? GENERIC }, { status: 400 });
    }
    const row = await lookup(parsed.data.token);
    if (!row) return NextResponse.json({ error: GENERIC }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
      await tx.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: GENERIC }, { status: 400 });
  }
}
