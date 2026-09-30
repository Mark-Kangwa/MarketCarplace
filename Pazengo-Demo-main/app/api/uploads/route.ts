import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

/** Photo uploads for signed-in frontend users (Sell my car). Same rules as admin uploads. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireUser();
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    if (files.length > 10) return NextResponse.json({ error: "Upload at most 10 files at a time." }, { status: 400 });
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    // Validate every file before writing any, so a rejected batch leaves nothing behind.
    for (const file of files) {
      if (!ALLOWED[file.type]) return NextResponse.json({ error: `"${file.name}" must be a JPG, PNG or WebP image.` }, { status: 400 });
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `"${file.name}" is too large — maximum 5MB per photo.` }, { status: 400 });
      }
    }
    const urls: string[] = [];
    for (const file of files) {
      const ext = ALLOWED[file.type] as string;
      const name = `${randomUUID()}${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(dir, name), bytes);
      urls.push(`/uploads/${name}`);
    }
    return NextResponse.json({ ok: true, urls });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in to upload photos." }, { status: 401 });
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
