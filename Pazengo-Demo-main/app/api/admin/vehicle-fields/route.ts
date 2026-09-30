import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formFieldCreateSchema, hasOptionsKind } from "@/lib/validators";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const raw = await prisma.formField.findMany({
      orderBy: { label: "asc" },
      include: { types: { select: { vehicleTypeId: true } } }
    });
    const fields = raw.map((f) => ({
      ...f,
      options: (f.options as unknown as string[]) ?? [],
      typeIds: f.types.map((t) => t.vehicleTypeId)
    }));
    return NextResponse.json({ fields });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load form fields." }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = formFieldCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid field" }, { status: 400 });
    }
    const d = parsed.data;
    const key = d.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "field";
    const dupe = await prisma.formField.findFirst({ where: { OR: [{ key }, { label: { equals: d.label.trim(), mode: "insensitive" } }] } });
    if (dupe) return NextResponse.json({ error: `“${dupe.label}” already exists in the library.` }, { status: 409 });
    if (hasOptionsKind(d.kind) && d.options.length < 2) {
      return NextResponse.json({ error: "Dropdown and checkbox fields need at least two options." }, { status: 400 });
    }
    if (d.minValue != null && d.maxValue != null && d.minValue > d.maxValue) {
      return NextResponse.json({ error: "Minimum cannot be greater than maximum." }, { status: 400 });
    }
    const field = await prisma.formField.create({
      data: {
        key,
        label: d.label.trim(),
        kind: d.kind,
        options: d.options,
        unit: d.unit?.trim() ? d.unit.trim() : null,
        minValue: d.minValue ?? null,
        maxValue: d.maxValue ?? null,
        help: d.help?.trim() ? d.help.trim() : null,
        binding: null
      }
    });
    if (d.assignTo) {
      const owner = await prisma.vehicleType.findUnique({ where: { id: d.assignTo } });
      if (!owner) return NextResponse.json({ error: "Vehicle type not found" }, { status: 404 });
      const maxPos = await prisma.vehicleTypeField.aggregate({ where: { vehicleTypeId: owner.id }, _max: { position: true } });
      await prisma.vehicleTypeField.create({
        data: { vehicleTypeId: owner.id, fieldId: field.id, required: d.required, position: (maxPos._max.position ?? -1) + 1 }
      });
    }
    await prisma.auditLog.create({ data: { actor, action: `Added form field ${field.label}`, entity: "FormField", entityId: field.id } });
    return NextResponse.json({ ok: true, field: { ...field, options: (field.options as unknown as string[]) ?? [] } });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not create form field." }, { status: 500 });
  }
}
