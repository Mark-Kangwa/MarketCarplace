import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ListingProductManager from "@/components/listing-product-manager";

export const dynamic = "force-dynamic";

export default async function ListingProductsPage(): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const products = await prisma.listingProduct.findMany({
    orderBy: { priceZmw: "asc" },
    include: { _count: { select: { cars: true } } }
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Listing products</h1>
        <p className="text-sm text-gray-600">Packages sellers pick before listing — free or paid, each with its own live duration. Nothing is hardcoded: edit, delete and recreate freely.</p>
      </div>
      <ListingProductManager initial={products} />
    </div>
  );
}
