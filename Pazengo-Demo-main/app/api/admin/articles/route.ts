import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { articleSchema, slugifyName } from "@/lib/validators";

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "article";
  let n = 2;
  for (;;) {
    const hit = await prisma.article.findUnique({ where: { slug } });
    if (!hit) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = articleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid article" }, { status: 400 });
    }
    const d = parsed.data;
    const cover = d.coverUrl?.trim() || null;
    if (cover && !(cover.startsWith("/") || cover.startsWith("http://") || cover.startsWith("https://"))) {
      return NextResponse.json({ error: "Cover must be an uploaded image or URL." }, { status: 400 });
    }
    const now = new Date();
    const article = await prisma.article.create({
      data: {
        title: d.title.trim(),
        slug: await uniqueSlug(slugifyName(d.title)),
        kind: d.kind,
        excerpt: d.excerpt?.trim() || "",
        coverUrl: cover,
        body: d.body.trim(),
        status: d.status,
        publishedAt: d.status === "PUBLISHED" ? now : null,
        createdBy: actor
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Added article ${article.title}`, entity: "Article", entityId: article.id } });
    return NextResponse.json({ ok: true, id: article.id });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not save article." }, { status: 500 });
  }
}
