import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { articleSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = articleSchema.partial().safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid article" }, { status: 400 });
    }
    const prev = await prisma.article.findUnique({ where: { id: params.id } });
    if (!prev) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    const d = parsed.data;
    const cover = d.coverUrl !== undefined ? (d.coverUrl?.trim() || null) : undefined;
    if (cover && !(cover.startsWith("/") || cover.startsWith("http://") || cover.startsWith("https://"))) {
      return NextResponse.json({ error: "Cover must be an uploaded image or URL." }, { status: 400 });
    }
    // First publish stamps the moment; edits never move it.
    const status = d.status ?? prev.status;
    const publishedAt = status === "PUBLISHED" ? (prev.publishedAt ?? new Date()) : null;
    const article = await prisma.article.update({
      where: { id: prev.id },
      data: {
        ...(d.title ? { title: d.title.trim() } : {}),
        ...(d.kind ? { kind: d.kind } : {}),
        ...(d.excerpt !== undefined ? { excerpt: d.excerpt?.trim() || "" } : {}),
        ...(cover !== undefined ? { coverUrl: cover } : {}),
        ...(d.body ? { body: d.body.trim() } : {}),
        status,
        publishedAt
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Edited article ${article.title} → ${article.status}`, entity: "Article", entityId: article.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update article." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const article = await prisma.article.findUnique({ where: { id: params.id } });
    if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    await prisma.article.delete({ where: { id: article.id } });
    await prisma.auditLog.create({ data: { actor, action: `Removed article ${article.title}`, entity: "Article", entityId: article.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete article." }, { status: 500 });
  }
}
