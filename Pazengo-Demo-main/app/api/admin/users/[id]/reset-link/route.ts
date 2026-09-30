import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

function baseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Mint a single-use reset link, shown once for manual sharing (no email
 * infrastructure). Invalidates older unused tokens for the same user.
 */
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.$transaction(async (tx) => {
      await tx.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      await tx.passwordReset.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) }
      });
    });
    await prisma.auditLog.create({ data: { actor, action: `Issued password reset link for ${user.name}`, entity: "User", entityId: user.id } });
    return NextResponse.json({ ok: true, url: `${baseUrl(req)}/reset-password?token=${token}` });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not issue reset link." }, { status: 500 });
  }
}
