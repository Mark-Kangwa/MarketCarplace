import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hasOptionsKind } from "@/lib/validators";
import VehicleFieldManager from "@/components/vehicle-field-manager";

export const dynamic = "force-dynamic";

function toStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FormFieldsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const types = await prisma.vehicleType.findMany({ orderBy: { createdAt: "asc" } });
  if (types.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Form fields</h1>
        <p className="text-sm text-gray-600">
          Create a <a href="/admin/vehicle-config/vehicle-types" className="text-trader underline">vehicle type</a> first, then assign fields to it.
        </p>
      </div>
    );
  }
  const slug = toStr(searchParams.type);
  const selected = types.find((t) => t.slug === slug) ?? types[0];
  const [assignedRaw, libraryRaw] = await Promise.all([
    prisma.vehicleTypeField.findMany({
      where: { vehicleTypeId: selected.id },
      orderBy: { position: "asc" },
      include: { field: true }
    }),
    prisma.formField.findMany({ orderBy: { label: "asc" } })
  ]);
  const assigned = assignedRaw.map((a) => {
    const base = (a.field.options as unknown as string[]) ?? [];
    const override = (a.options as unknown as string[]) ?? [];
    const effective = hasOptionsKind(a.field.kind) ? (override.length > 0 ? override : base) : [];
    return {
      fieldId: a.field.id,
      key: a.field.key,
      label: a.field.label,
      kind: a.field.kind,
      options: effective,
      baseOptions: base,
      optionsOverridden: hasOptionsKind(a.field.kind) && override.length > 0,
      dynamic: a.field.dynamic,
      unit: a.field.unit,
      minValue: a.field.minValue,
      maxValue: a.field.maxValue,
      help: a.field.help,
      binding: a.field.binding,
      required: a.required,
      position: a.position
    };
  });
  const assignedIds = new Set(assignedRaw.map((a) => a.fieldId));
  const library = libraryRaw.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    kind: f.kind,
    options: (f.options as unknown as string[]) ?? [],
    binding: f.binding,
    assigned: assignedIds.has(f.id)
  }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Form fields</h1>
          <p className="text-sm text-gray-600">Pick which fields each vehicle type asks for. Core fields are universal and locked; custom fields are fully editable and may stay linked to the listing so search keeps working.</p>
        </div>
        <Link href="/admin/vehicle-config/form-fields/options" className="rounded border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-lot">Manage options →</Link>
      </div>
      <VehicleFieldManager
        types={types.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
        selectedId={selected.id}
        selectedName={selected.name}
        assigned={assigned}
        library={library}
      />
    </div>
  );
}
