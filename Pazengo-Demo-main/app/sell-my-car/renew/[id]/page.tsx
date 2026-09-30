import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import RenewForm from "@/components/renew-form";
import { prisma, dbOk } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RenewPage({ params }: { params: { id: string } }): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect(`/login?next=/my-cars`);
  }
  if (!(await dbOk())) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <p className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">Database not connected.</p>
        </main>
      </div>
    );
  }
  const car = await prisma.car.findUnique({
    where: { id: params.id },
    select: { id: true, make: true, model: true, year: true, variant: true, ownerId: true, status: true, expiresAt: true }
  });
  if (!car || car.ownerId !== session.id) notFound();
  const products = await prisma.listingProduct.findMany({ orderBy: { priceZmw: "asc" } });
  const credits = await prisma.payment.findMany({
    where: { userId: session.id, kind: "LISTING_FEE", status: "APPROVED", carId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, listingProductId: true, createdAt: true }
  });
  const title = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/my-cars" className="hover:text-trader">My cars</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">Renew</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Renew {title}</h1>
          <p className="mt-1 text-sm text-gray-600">Pick a package — your car returns to review, then goes live for the full duration once published.</p>
        </div>
        <RenewForm
          carId={car.id}
          products={products}
          credits={credits.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        />
      </main>
    </div>
  );
}
