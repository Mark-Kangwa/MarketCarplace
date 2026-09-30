import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import PayForm from "@/components/pay-form";
import { prisma, dbOk } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { zmw } from "@/lib/format";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PayPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<JSX.Element> {
  try {
    await requireUser();
  } catch {
    redirect("/login?next=/sell-my-car");
  }
  const productId = first(searchParams.product) ?? "";
  const product = productId && (await dbOk())
    ? await prisma.listingProduct.findUnique({ where: { id: productId } })
    : null;
  if (!product) redirect("/sell-my-car");
  if (product.priceZmw === 0) redirect(`/sell-my-car/list?product=${product.id}`);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/sell-my-car" className="hover:text-trader">Sell my car</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">Payment</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">{product.name} — {zmw(product.priceZmw)}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {product.description ? <>{product.description} </> : null}
            Pay now — once we approve your payment you&apos;ll unlock the car form for {product.durationDays} days live.
          </p>
        </div>
        <PayForm productId={product.id} />
      </main>
    </div>
  );
}
