import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hasOptionsKind, isCoreBinding } from "@/lib/validators";

export const dynamic = "force-dynamic";

function toStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FieldOptionsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const q = (toStr(searchParams.q) ?? "").trim().toLowerCase();
  const [fields, links] = await Promise.all([
    prisma.formField.findMany({ orderBy: { label: "asc" } }),
    prisma.vehicleTypeField.findMany({
      select: { fieldId: true, options: true, vehicleType: { select: { name: true } } }
    })
  ]);
  const overridesByField = new Map<string, string[]>();
  for (const l of links) {
    const opts = (l.options as unknown as string[]) ?? [];
    if (opts.length === 0) continue;
    const arr = overridesByField.get(l.fieldId) ?? [];
    arr.push(l.vehicleType.name);
    overridesByField.set(l.fieldId, arr);
  }
  const rows = fields
    .filter((f) => hasOptionsKind(f.kind))
    .map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      binding: f.binding,
      dynamic: f.dynamic,
      count: ((f.options as unknown as string[]) ?? []).length,
      overrides: overridesByField.get(f.id) ?? []
    }))
    .filter((r) => !q || r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  return (
    <div className="space-y-4">
      <div>
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/admin/vehicle-config/form-fields" className="hover:text-trader">Form fields</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">Field options</span>
        </nav>
        <h1 className="mt-1 text-2xl font-bold">Field options</h1>
        <p className="text-sm text-gray-600">Every dropdown list in one place. Search a field, open it to add, rename or remove options — duplicates are blocked automatically.</p>
      </div>
      <form method="get" className="flex gap-2">
        <input name="q" defaultValue={toStr(searchParams.q) ?? ""} placeholder="Search fields, e.g. make…" aria-label="Search fields" className="w-full max-w-sm rounded border border-line px-3 py-2 text-sm" />
        <button className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Search</button>
        {q ? <Link href="/admin/vehicle-config/form-fields/options" className="rounded border border-line px-4 py-2 text-sm font-semibold hover:bg-lot">Clear</Link> : null}
      </form>
      <ul className="divide-y rounded border border-line bg-white">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/vehicle-config/form-fields/options/${r.key}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-lot/60">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{r.label}</span>
                {r.binding ? (
                  isCoreBinding(r.binding)
                    ? <span className="ml-2 rounded bg-asphalt px-1.5 py-0.5 text-[11px] font-semibold text-white">CORE</span>
                    : <span className="ml-2 rounded bg-lot px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">CUSTOM</span>
                ) : (
                  <span className="ml-2 rounded bg-lot px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">CUSTOM</span>
                )}
                {r.dynamic ? <span className="ml-1 text-[11px] text-gray-500">· live options</span> : null}
                <span className="block text-xs text-gray-500">
                  {r.count} option{r.count === 1 ? "" : "s"}
                  {r.overrides.length > 0 ? ` · overridden on ${r.overrides.join(", ")}` : ""}
                </span>
              </span>
              <span className="text-sm font-semibold text-trader">Manage →</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No fields match “{toStr(searchParams.q) ?? ""}”.</li> : null}
      </ul>
    </div>
  );
}
