import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { displayOption, findOptionDuplicate, hasOptionsKind, isCanonicalOptionCode, isStrictOptionBinding, parseDisplayOption } from "@/lib/validators";
import { countOptionUsage, renameOptionEverywhere, renameableColumn } from "@/lib/vehicle-validation";

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const from = typeof json.from === "string" ? json.from : "";
    const to = typeof json.to === "string" ? json.to.trim() : "";
    const propagate = json.propagate === true;
    if (!from) return NextResponse.json({ error: "Nothing to rename." }, { status: 400 });
    if (!to || to.length > 60) {
      return NextResponse.json({ error: "The new name must be 1–60 characters." }, { status: 400 });
    }
    const field = await prisma.formField.findUnique({ where: { id: params.id } });
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });
    if (!hasOptionsKind(field.kind)) return NextResponse.json({ error: "Only dropdown and checkbox fields have renameable options." }, { status: 400 });
    const options = (field.options as unknown as string[]) ?? [];
    const inLibrary = options.includes(from);
    // Extras rows (values only on listings) rename via propagation alone.
    if (!inLibrary && !(propagate && renameableColumn(field.binding))) {
      return NextResponse.json({ error: `“${from}” is not on the shared list — tick “update listings too” to rename it on stock.` }, { status: 404 });
    }
    // Translate labels to codes first: renaming FULL to "Full service history"
    // resolves to the same value (a rejected no-op), never stores the label.
    const translated = parseDisplayOption(field.binding ?? field.key, to);
    if (isStrictOptionBinding(field.binding ?? field.key) && !isCanonicalOptionCode(field.binding ?? field.key, translated)) {
      return NextResponse.json({ error: `“${to}” is not valid for ${field.label}.` }, { status: 400 });
    }
    // Renaming to the same canonical value (e.g. FULL → "Full service
    // history") is a no-op, not a rename.
    if (translated === from) {
      return NextResponse.json({ error: `“${to}” is already on this list${translated !== to ? ` as ${translated}` : ""}.` }, { status: 409 });
    }
    const rest = inLibrary ? options.filter((o) => o !== from) : options;
    const dup = findOptionDuplicate(field.binding ?? field.key, [...rest, translated]);
    if (dup) {
      return NextResponse.json({ error: `“${to}” already exists as ${displayOption(field.binding ?? field.key, dup)}.` }, { status: 409 });
    }
    const col = renameableColumn(field.binding);
    let count = 0;
    let propagated = false;
    if (col) {
      count = await countOptionUsage(field.binding as string, from);
      if (propagate && count > 0) {
        await renameOptionEverywhere(field.binding as string, from, translated);
        propagated = true;
      }
    }
    await prisma.formField.update({
      where: { id: field.id },
      data: { options: inLibrary ? options.map((o) => (o === from ? translated : o)) : options }
    });
    await prisma.auditLog.create({
      data: {
        actor,
        action: `Renamed option ${from} → ${translated} on ${field.label}${inLibrary ? "" : " (stock only)"}${propagated ? ` (${count} listings updated)` : ""}`,
        entity: "FormField",
        entityId: field.id
      }
    });
    return NextResponse.json({ ok: true, propagated, count });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not rename option." }, { status: 500 });
  }
}
