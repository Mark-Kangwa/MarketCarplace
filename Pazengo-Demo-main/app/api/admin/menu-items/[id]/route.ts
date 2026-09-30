import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { menuItemUpdateSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = menuItemUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid menu item" }, { status: 400 });
    }
    if (parsed.data.label === undefined && parsed.data.visible === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    await prisma.menuItem.update({
      where: { id: item.id },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label.trim() } : {}),
        ...(parsed.data.visible !== undefined ? { visible: parsed.data.visible } : {})
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Edited menu item ${item.label}`, entity: "MenuItem", entityId: item.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update menu item." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    // Routes survive deletion — only the nav entry goes.
    await prisma.menuItem.delete({ where: { id: item.id } });
    await prisma.auditLog.create({ data: { actor, action: `Deleted menu item ${item.label}`, entity: "MenuItem", entityId: item.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete menu item." }, { status: 500 });
  }
}
