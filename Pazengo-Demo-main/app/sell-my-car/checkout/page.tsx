import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import CheckoutFlow from "@/components/checkout-flow";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CheckoutPage(): Promise<JSX.Element> {
  try {
    await requireUser();
  } catch {
    redirect("/login?next=/sell-my-car");
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/sell-my-car" className="hover:text-trader">Sell my car</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">Price to pay</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold">Almost done</h1>
          <p className="mt-1 text-sm text-gray-600">Confirm the price, then your car goes in for review.</p>
        </div>
        <CheckoutFlow />
      </main>
    </div>
  );
}
