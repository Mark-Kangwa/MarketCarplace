import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { assignmentSchema, hasOptionsKind } from "@/lib/validators";

export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireAdmin();
    const owner = await prisma.vehicleType.findUnique({ where: { id: params.id } });
    if (!owner) return NextResponse.json({ error: "Vehicle type not found" }, { status: 404 });
    const raw = await prisma.vehicleTypeField.findMany({
      where: { vehicleTypeId: owner.id },
      orderBy: { position: "asc" },
      include: { field: true }
    });
    const assigned = raw.map((a) => {
      const base = (a.field.options as unknown as string[]) ?? [];
      const override = (a.options as unknown as string[]) ?? [];
      const effective = hasOptionsKind(a.field.kind) ? (override.length > 0 ? override : base) : [];
      return {
        ...a.field,
        options: effective,
        baseOptions: base,
        optionsOverridden: hasOptionsKind(a.field.kind) && override.length > 0,
        required: a.required,
        position: a.position
      };
    });
    return NextResponse.json({ assigned });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load assigned fields." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = assignmentSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid assignment" }, { status: 400 });
    }
    const owner = await prisma.vehicleType.findUnique({ where: { id: params.id } });
    if (!owner) return NextResponse.json({ error: "Vehicle type not found" }, { status: 404 });
    const field = await prisma.formField.findUnique({ where: { id: parsed.data.fieldId } });
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });
    const existing = await prisma.vehicleTypeField.findUnique({
      where: { vehicleTypeId_fieldId: { vehicleTypeId: owner.id, fieldId: field.id } }
    });
    if (existing) return NextResponse.json({ error: `“${field.label}” is already on ${owner.name}.` }, { status: 409 });
    const maxPos = await prisma.vehicleTypeField.aggregate({ where: { vehicleTypeId: owner.id }, _max: { position: true } });
    await prisma.vehicleTypeField.create({
      data: {
        vehicleTypeId: owner.id,
        fieldId: field.id,
        required: parsed.data.required,
        position: parsed.data.position ?? (maxPos._max.position ?? -1) + 1
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Added ${field.label} to ${owner.name}`, entity: "VehicleType", entityId: owner.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not assign field." }, { status: 500 });
  }
}
