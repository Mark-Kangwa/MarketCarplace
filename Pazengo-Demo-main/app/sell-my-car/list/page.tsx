import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import SellListFlow from "@/components/sell-list-flow";
import { prisma, dbOk } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAllAssignments, getVehicleTypes } from "@/lib/vehicle-validation";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SellListPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login?next=/sell-my-car");
  }
  const productId = first(searchParams.product) ?? "";
  const product = productId && (await dbOk())
    ? await prisma.listingProduct.findUnique({ where: { id: productId } })
    : null;
  if (!product) redirect("/sell-my-car");
  // Paid packages unlock the form only on an approved, unused payment.
  let creditId: string | null = null;
  if (product.priceZmw > 0) {
    const credit = await prisma.payment.findFirst({
      where: {
        userId: session.id,
        listingProductId: product.id,
        kind: "LISTING_FEE",
        status: "APPROVED",
        carId: null
      },
      orderBy: { createdAt: "asc" },
      select: { id: true }
    });
    if (!credit) redirect(`/sell-my-car/pay?product=${product.id}`);
    creditId = credit.id;
  }
  let makes: string[] = [];
  let modelsByMake: Record<string, string[]> = {};
  let vehicleTypes: Awaited<ReturnType<typeof getVehicleTypes>> = [];
  let assignments: Awaited<ReturnType<typeof getAllAssignments>> = {};
  let libraryMakes: string[] = [];
  let libraryLocations: string[] = [];
  let inventoryLocations: string[] = [];
  let maxPhotos = 10;
  if (await dbOk()) {
    const [makeRows, modelRows, locationRows] = await Promise.all([
      prisma.car.groupBy({ by: ["make"], _count: { make: true } }),
      prisma.car.groupBy({ by: ["make", "model"], _count: { model: true } }),
      prisma.car.groupBy({ by: ["location"], _count: { location: true } })
    ]);
    makes = makeRows.map((r) => r.make).sort((a, b) => a.localeCompare(b));
    for (const r of modelRows) {
      (modelsByMake[r.make] ??= []).push(r.model);
    }
    for (const k of Object.keys(modelsByMake)) modelsByMake[k].sort((a, b) => a.localeCompare(b));
    inventoryLocations = locationRows.map((r) => r.location).filter((l) => l.trim().length > 0).sort((a, b) => a.localeCompare(b));
    vehicleTypes = await getVehicleTypes();
    assignments = await getAllAssignments();
    maxPhotos = await getSetting("maxPhotos");
    const seenMake = new Set<string>();
    const seenLoc = new Set<string>();
    for (const fields of Object.values(assignments)) {
      for (const f of fields) {
        if (f.binding === "make") for (const o of f.options) { if (!seenMake.has(o.toLowerCase())) { seenMake.add(o.toLowerCase()); libraryMakes.push(o); } }
        if (f.binding === "location") for (const o of f.options) { if (!seenLoc.has(o.toLowerCase())) { seenLoc.add(o.toLowerCase()); libraryLocations.push(o); } }
      }
    }
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/sell-my-car" className="hover:text-trader">Sell my car</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">Your car</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Your car <span className="text-sm font-semibold text-gray-500">· {product.name} package</span></h1>
          <p className="mt-1 text-sm text-gray-600">
            {product.priceZmw === 0
              ? "Fill in your vehicle below and submit it for review — our team checks every listing before it goes live."
              : `Your ${product.name} payment is approved — fill in your vehicle below and submit it for review.`}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <SellListFlow
            productId={product.id}
            productName={product.name}
            creditId={creditId}
            makes={makes}
            modelsByMake={modelsByMake}
            vehicleTypes={vehicleTypes}
            assignments={assignments}
            libraryMakes={libraryMakes}
            libraryLocations={libraryLocations}
            inventoryLocations={inventoryLocations}
            maxPhotos={maxPhotos}
          />
        </div>
      </main>
    </div>
  );
}
