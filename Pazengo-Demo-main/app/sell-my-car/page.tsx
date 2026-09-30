import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { prisma, dbOk } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { zmw } from "@/lib/format";

export const dynamic = "force-dynamic";

function perks(durationDays: number): string[] {
  return [
    `Live on the marketplace for ${durationDays} day${durationDays === 1 ? "" : "s"}`,
    "Shows in search, filters and buyer alerts",
    "Free review by our team before going live"
  ];
}

export default async function SellMyCarPage(): Promise<JSX.Element> {
  try {
    await requireUser();
  } catch {
    redirect("/login?next=/sell-my-car");
  }
  let products: { id: string; name: string; description: string; priceZmw: number; durationDays: number }[] = [];
  if (await dbOk()) {
    products = await prisma.listingProduct.findMany({ orderBy: { priceZmw: "asc" } });
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">Sell my car</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Sell my car</h1>
          <p className="mt-1 text-sm text-gray-600">Pick a package first — your car details come next, and every listing stays attached to the package you chose.</p>
        </div>
        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-gray-600">
            <p className="text-base font-bold text-asphalt">Listing is paused right now.</p>
            <p className="mt-1">No packages are on sale — check back soon, or contact us.</p>
            <Link href="/my-cars" className="mt-4 inline-block rounded border border-line px-5 py-2.5 text-sm font-semibold hover:bg-lot">View my cars</Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {products.map((p) => (
              <article key={p.id} className="flex flex-col rounded-lg border border-line bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">{p.name}</h2>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${p.priceZmw === 0 ? "bg-green-100 text-green-800" : "bg-asphalt text-white"}`}>
                    {p.priceZmw === 0 ? "FREE" : zmw(p.priceZmw)}
                  </span>
                </div>
                {p.description ? <p className="mt-1 text-sm text-gray-600">{p.description}</p> : null}
                <ul className="mt-3 space-y-1.5 text-sm">
                  {perks(p.durationDays).map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800">✓</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.priceZmw === 0 ? `/sell-my-car/list?product=${p.id}` : `/sell-my-car/pay?product=${p.id}`}
                  className="mt-4 rounded bg-signal px-5 py-2.5 text-center text-sm font-bold text-white hover:brightness-110"
                >
                  {p.priceZmw === 0 ? `Continue with ${p.name}` : `Pay ${zmw(p.priceZmw)} & continue`}
                </Link>
              </article>
            ))}
          </div>
        )}
        <p className="text-center text-sm text-gray-600">
          Already listed? <Link href="/my-cars" className="font-semibold text-trader hover:underline">View my cars</Link>
        </p>
      </main>
    </div>
  );
}
