import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { createUserSession, getUserSession, userSessionCookie } from "@/lib/auth";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const form = await req.formData();
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
    }
    if (!ALLOWED[file.type]) {
      return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: "Photo is too large — maximum 2MB." }, { status: 400 });
    }
    const dir = path.join(process.cwd(), "public", "avatars");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}${ALLOWED[file.type] as string}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const url = `/avatars/${name}`;
    const user = await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: url }
    });
    const token = await createUserSession({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
    const res = NextResponse.json({ ok: true, url });
    res.headers.set("Set-Cookie", userSessionCookie(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await getUserSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const user = await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: null }
    });
    const token = await createUserSession({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", userSessionCookie(token));
    return res;
  } catch {
    return NextResponse.json({ error: "Could not remove your photo. Please try again." }, { status: 500 });
  }
}
