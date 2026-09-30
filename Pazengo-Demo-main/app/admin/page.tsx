import Link from "next/link";
import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AdminDashboard(): Promise<JSX.Element> {
  await guard();
  const connected = await dbOk();
  let stats = { stock: 0, published: 0, blocked: 0, featured: 0 };
  if (connected) {
    const [stock, published, blocked, featured] = await Promise.all([
      prisma.car.count(),
      prisma.car.count({ where: { status: "PUBLISHED" } }),
      prisma.user.count({ where: { status: "BLOCKED" } }),
      prisma.car.count({ where: { status: "PUBLISHED", isFeatured: true } })
    ]);
    stats = { stock, published, blocked, featured };
  }

  const cards = [
    { label: "Cars in inventory", value: stats.stock, href: "/admin/inventory/published", hint: `${stats.published} published · ★ ${stats.featured} featured` },
    { label: "Blocked users", value: stats.blocked, href: "/admin/users", hint: "Access revoked" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good day — here is the lot today</h1>
        <p className="mt-1 text-sm text-gray-600">Add stock and keep access safe. Public site mirrors published stock.</p>
      </div>

      {!connected ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-bold">Database not connected.</p>
          <p className="mt-1">Set <code>DATABASE_URL</code> to Postgres, then run <code>npm run db:push && npm run db:seed</code>. The console renders empty until then so builds never fail.</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border border-line bg-white p-4 hover:border-trader">
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className="tabular mt-1 text-3xl font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-gray-500">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-bold">Next actions</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li><Link className="text-trader underline" href="/admin/inventory/new">Add a car to inventory</Link> — capture VIN, mileage, price, photos.</li>
          <li><Link className="text-trader underline" href="/admin/inventory/import">Import stock from CSV</Link> — dry-run first, then publish.</li>
        </ul>
      </div>
    </div>
  );
}
