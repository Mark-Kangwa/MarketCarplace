import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { LINKED_KIND_COMPAT, findOptionDuplicate, formFieldUpdateSchema, hasOptionsKind, isCanonicalOptionCode, isCoreBinding, isStrictOptionBinding, parseDisplayOption } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = formFieldUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid field" }, { status: 400 });
    }
    const field = await prisma.formField.findUnique({ where: { id: params.id } });
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });
    const d = parsed.data;
    // Kind changes: core fields are locked; linked fields stay within kinds
    // their listing column supports; stored values are never rewritten.
    if (d.kind && d.kind !== field.kind) {
      if (isCoreBinding(field.binding)) {
        return NextResponse.json({ error: `“${field.label}” is a core field — its type is locked.` }, { status: 409 });
      }
      if (field.binding) {
        const allowed = LINKED_KIND_COMPAT[field.binding] ?? [];
        if (!allowed.includes(d.kind)) {
          return NextResponse.json({ error: `“${field.label}” syncs to listings, so it can only be ${allowed.join(" / ")}.` }, { status: 400 });
        }
      }
      const nextOptions = d.options ?? ((field.options as unknown as string[]) ?? []);
      if (hasOptionsKind(d.kind) && nextOptions.length < 2) {
        return NextResponse.json({ error: "Switching to a dropdown or checkbox group needs at least two options — add them in the same edit." }, { status: 400 });
      }
      if (hasOptionsKind(field.kind) && !hasOptionsKind(d.kind)) {
        // Stale per-type lists would otherwise linger unseen.
        await prisma.vehicleTypeField.updateMany({ where: { fieldId: field.id }, data: { options: [] } });
      }
    }
    if (d.label) {
      const dupe = await prisma.formField.findFirst({
        where: { label: { equals: d.label.trim(), mode: "insensitive" }, NOT: { id: field.id } }
      });
      if (dupe) return NextResponse.json({ error: `“${dupe.label}” already exists in the library.` }, { status: 409 });
    }
    // Resulting-state rules: static dropdowns need at least two unique options
    // (codes and labels count as one — "FULL" and "Full service history" collide).
    // Dynamic fields render from the union with stock, so any size works.
    // Submitted labels are translated to codes first, so the library can
    // never hold a label on strict bindings.
    const resultKind = d.kind && d.kind !== field.kind ? d.kind : field.kind;
    const rawOptions: string[] | undefined = d.options;
    const submitted = rawOptions?.map((o) => parseDisplayOption(field.binding ?? field.key, o));
    if (submitted !== undefined && rawOptions !== undefined) {
      if (isStrictOptionBinding(field.binding ?? field.key)) {
        const badIdx = submitted.findIndex((c) => !isCanonicalOptionCode(field.binding ?? field.key, c));
        if (badIdx !== -1) {
          return NextResponse.json({ error: `“${rawOptions[badIdx]}” is not valid for ${field.label}.` }, { status: 400 });
        }
      }
      const dup = findOptionDuplicate(field.binding ?? field.key, submitted);
      if (dup) {
        return NextResponse.json({ error: `“${dup}” is already on this list (codes and labels count as one).` }, { status: 409 });
      }
      d.options = submitted;
    }
    const resultOptions = submitted ?? ((field.options as unknown as string[]) ?? []);
    if (hasOptionsKind(resultKind) && !field.dynamic && resultOptions.length < 2) {
      return NextResponse.json({ error: "Dropdown and checkbox fields need at least two options." }, { status: 400 });
    }
    const min = d.minValue === null ? null : d.minValue ?? undefined;
    const max = d.maxValue === null ? null : d.maxValue ?? undefined;
    const effMin = min === undefined ? field.minValue : min;
    const effMax = max === undefined ? field.maxValue : max;
    if (effMin != null && effMax != null && effMin > effMax) {
      return NextResponse.json({ error: "Minimum cannot be greater than maximum." }, { status: 400 });
    }
    await prisma.formField.update({
      where: { id: field.id },
      data: {
        ...(d.label ? { label: d.label.trim() } : {}),
        ...(d.kind && d.kind !== field.kind ? { kind: d.kind } : {}),
        ...(d.options !== undefined ? { options: d.options } : {}),
        ...(d.unit !== undefined ? { unit: d.unit?.trim() ? d.unit.trim() : null } : {}),
        ...(min !== undefined ? { minValue: min } : {}),
        ...(max !== undefined ? { maxValue: max } : {}),
        ...(d.help !== undefined ? { help: d.help?.trim() ? d.help.trim() : null } : {})
      }
    });
    await prisma.auditLog.create({ data: { actor, action: `Edited form field ${field.label}${d.kind && d.kind !== field.kind ? ` (${field.kind} → ${d.kind})` : ""}`, entity: "FormField", entityId: field.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not update form field." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const field = await prisma.formField.findUnique({ where: { id: params.id }, include: { types: { select: { vehicleTypeId: true } } } });
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });
    // Core fields are never deletable. Linked custom fields can go, but their
    // listing-column values stay behind (search keeps working off them).
    if (isCoreBinding(field.binding)) {
      return NextResponse.json({ error: "Core fields cannot be deleted — unassign them instead." }, { status: 409 });
    }
    const usedTypes = field.types.length;
    await prisma.vehicleTypeField.deleteMany({ where: { fieldId: field.id } });
    await prisma.formField.delete({ where: { id: field.id } });
    await prisma.auditLog.create({
      data: { actor, action: `Deleted form field ${field.label}${usedTypes ? ` (was on ${usedTypes} type${usedTypes === 1 ? "" : "s"})` : ""}`, entity: "FormField", entityId: field.id }
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete form field." }, { status: 500 });
  }
}
