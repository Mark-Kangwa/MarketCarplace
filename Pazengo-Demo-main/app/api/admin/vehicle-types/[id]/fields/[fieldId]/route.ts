import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { assignmentSchema, findOptionDuplicate, hasOptionsKind, isCanonicalOptionCode, isStrictOptionBinding, parseDisplayOption } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: { id: string; fieldId: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = assignmentSchema.partial().safeParse(json);
    if (!parsed.success || (parsed.data.required === undefined && parsed.data.position === undefined && parsed.data.options === undefined)) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const link = await prisma.vehicleTypeField.findUnique({
      where: { vehicleTypeId_fieldId: { vehicleTypeId: params.id, fieldId: params.fieldId } },
      include: { field: true, vehicleType: true }
    });
    if (!link) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    if (parsed.data.options !== undefined && parsed.data.options !== null) {
      if (!hasOptionsKind(link.field.kind)) {
        return NextResponse.json({ error: "Only dropdown and checkbox fields can override options." }, { status: 400 });
      }
      if (parsed.data.options.length === 0) {
        return NextResponse.json({ error: "Override needs at least one option — or reset to inherit the library list." }, { status: 400 });
      }
      const key = link.field.binding ?? link.field.key;
      const translated = parsed.data.options.map((o) => parseDisplayOption(key, o));
      if (isStrictOptionBinding(key)) {
        const badIdx = translated.findIndex((c) => !isCanonicalOptionCode(key, c));
        if (badIdx !== -1) {
          return NextResponse.json({ error: `“${parsed.data.options[badIdx]}” is not valid for ${link.field.label}.` }, { status: 400 });
        }
      }
      const dup = findOptionDuplicate(key, translated);
      if (dup) {
        return NextResponse.json({ error: `“${dup}” is already on this list (codes and labels count as one).` }, { status: 409 });
      }
      parsed.data.options = translated;
    }
    await prisma.vehicleTypeField.update({
      where: { vehicleTypeId_fieldId: { vehicleTypeId: params.id, fieldId: params.fieldId } },
      data: {
        ...(parsed.data.required !== undefined ? { required: parsed.data.required } : {}),
        ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
        ...(parsed.data.options !== undefined ? { options: parsed.data.options ?? [] } : {})
      }
    });
    await prisma.auditLog.create({
      data: { actor, action: `Updated ${link.field.label} on ${link.vehicleType.name}`, entity: "VehicleType", entityId: params.id }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update assignment." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; fieldId: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const link = await prisma.vehicleTypeField.findUnique({
      where: { vehicleTypeId_fieldId: { vehicleTypeId: params.id, fieldId: params.fieldId } },
      include: { field: true, vehicleType: true }
    });
    if (!link) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    await prisma.vehicleTypeField.delete({
      where: { vehicleTypeId_fieldId: { vehicleTypeId: params.id, fieldId: params.fieldId } }
    });
    await prisma.auditLog.create({
      data: { actor, action: `Removed ${link.field.label} from ${link.vehicleType.name}`, entity: "VehicleType", entityId: params.id }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not unassign field." }, { status: 500 });
  }
}
