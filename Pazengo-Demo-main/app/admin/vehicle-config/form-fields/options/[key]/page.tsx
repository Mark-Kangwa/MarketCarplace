import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import OptionManager from "@/components/option-manager";
import { hasOptionsKind } from "@/lib/validators";
import { renameableColumn } from "@/lib/vehicle-validation";

export const dynamic = "force-dynamic";

export default async function OptionDetailPage({ params }: { params: { key: string } }): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const field = await prisma.formField.findUnique({ where: { key: params.key } });
  if (!field || !hasOptionsKind(field.kind)) notFound();
  const baseOptions = (field.options as unknown as string[]) ?? [];
  const links = await prisma.vehicleTypeField.findMany({
    where: { fieldId: field.id },
    select: { options: true, vehicleType: { select: { name: true, slug: true } } }
  });
  const overrides = links
    .map((l) => ({
      typeName: l.vehicleType.name,
      typeSlug: l.vehicleType.slug,
      options: (l.options as unknown as string[]) ?? []
    }))
    .filter((o) => o.options.length > 0);

  // Usage per value from listings (linked fields only, one grouped query).
  const usage: Record<string, number> = {};
  const col = renameableColumn(field.binding);
  if (col) {
    const groupBy = prisma.car.groupBy as unknown as (args: {
      by: string[];
      _count: Record<string, true>;
    }) => Promise<Record<string, unknown>[]>;
    const groups = await groupBy({ by: [col], _count: { [col]: true } });
    for (const g of groups) {
      const v = String(g[col] ?? "");
      if (!v) continue;
      usage[v] = Number((g._count as Record<string, number> | undefined)?.[col] ?? 0);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/admin/vehicle-config/form-fields" className="hover:text-trader">Form fields</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/admin/vehicle-config/form-fields/options" className="hover:text-trader">Field options</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">{field.label}</span>
        </nav>
        <h1 className="mt-1 text-2xl font-bold">{field.label} options</h1>
        <p className="text-sm text-gray-600">
          {field.binding === "model"
            ? "Models come from your listings — search below, fix typos with rename, and follow a row to its stock."
            : "Search the list before adding — duplicates are blocked. Renaming can update existing listings too."}
        </p>
      </div>
      <OptionManager
        fieldId={field.id}
        fieldLabel={field.label}
        binding={field.binding}
        inventoryMode={field.binding === "model"}
        baseOptions={baseOptions}
        overrides={overrides}
        usage={usage}
        canPropagate={col !== null}
      />
    </div>
  );
}
