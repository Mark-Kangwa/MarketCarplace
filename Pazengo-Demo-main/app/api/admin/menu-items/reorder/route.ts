import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { menuReorderSchema } from "@/lib/validators";

const HEADER_DEFAULTS = [
  { key: "buy", label: "Buy a car", href: "/", emphasized: false },
  { key: "sell", label: "Sell my car", href: "/sell-my-car", emphasized: true },
  { key: "value", label: "Value my car", href: null, emphasized: false },
  { key: "news", label: "News & reviews", href: null, emphasized: false },
  { key: "tools", label: "Tools & services", href: null, emphasized: false }
];

/** Reorder header items: ids in desired top-to-bottom order. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    if (json.reset === true) {
      await prisma.$transaction(async (tx) => {
        await tx.menuItem.deleteMany({ where: { scope: "header" } });
        let pos = 0;
        for (const m of HEADER_DEFAULTS) {
          await tx.menuItem.create({
            data: { scope: "header", key: m.key, label: m.label, href: m.href, emphasized: m.emphasized, position: pos++ }
          });
        }
      });
      await prisma.auditLog.create({ data: { actor, action: "Reset header menu to defaults", entity: "MenuItem", entityId: "header" } });
      return NextResponse.json({ ok: true });
    }
    const parsed = menuReorderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid order" }, { status: 400 });
    }
    const rows = await prisma.menuItem.findMany({ where: { scope: "header" }, select: { id: true } });
    const known = new Set(rows.map((r) => r.id));
    if (!parsed.data.ids.every((id) => known.has(id)) || new Set(parsed.data.ids).size !== rows.length) {
      return NextResponse.json({ error: "Order must contain every menu item exactly once — refresh and try again." }, { status: 400 });
    }
    await prisma.$transaction(
      parsed.data.ids.map((id, position) => prisma.menuItem.update({ where: { id }, data: { position } }))
    );
    await prisma.auditLog.create({ data: { actor, action: "Reordered header menu", entity: "MenuItem", entityId: "header" } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not save menu order." }, { status: 500 });
  }
}
