import type { Payment, User, Car, ListingProduct } from "@prisma/client";
import { prisma, dbOk } from "@/lib/db";
import { zar, timeAgo } from "@/lib/format";
import { Pill, paymentTone } from "@/components/pills";
import { PaymentActions } from "@/components/payment-actions";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: { status?: string } }): Promise<JSX.Element> {
  await guard();
  const status = searchParams.status || "PENDING";
  let payments: (Payment & { user: User; car: Pick<Car, "id" | "make" | "model" | "year"> | null; listingProduct: Pick<ListingProduct, "name"> | null })[] = [];
  if (await dbOk()) {
    payments = await prisma.payment.findMany({
      where: status === "ALL" ? {} : { status: status as never },
      include: {
        user: true,
        car: { select: { id: true, make: true, model: true, year: true } },
        listingProduct: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
  const pending = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-gray-600">Manual EFT approvals for general users and dealers. {pending} waiting.</p>
        </div>
        <form method="get" className="flex gap-2">
          <select name="status" defaultValue={status} aria-label="Payment status" className="rounded border border-line bg-white px-3 py-2 text-sm">
            <option value="PENDING">Pending first</option>
            <option value="ALL">All</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Filter</button>
        </form>
      </div>

      <div className="space-y-3">
        {payments.map((p) => (
          <article key={p.id} className="grid gap-3 rounded-lg border border-line bg-white p-4 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="tabular text-lg font-bold">{zar(p.amountZar)}</p>
                <Pill tone={paymentTone(p.status)}>{p.status}</Pill>
                <span className="text-xs text-gray-500">{p.kind.replace("_", " ")} · {p.method} · Ref {p.reference}</span>
              </div>
              <p className="mt-1 text-sm"><span className="font-semibold">{p.user.name}</span> <span className="text-gray-500">{p.user.email} · {p.user.role}</span></p>
              {p.car || p.listingProduct ? (
                <p className="mt-1 text-xs text-gray-600">
                  📦 {p.listingProduct?.name ?? "Listing"}{p.car ? <> for <a href={`/admin/inventory/${p.car.id}`} className="font-semibold text-trader hover:underline">{p.car.year} {p.car.make} {p.car.model}</a> <span className="text-gray-400">(credit used)</span></> : p.status === "APPROVED" ? <> <span className="font-semibold text-green-800">(unused credit — unlocks the form)</span></> : null}
                  <span className="text-gray-400"> — approving the money does not publish the car; publish it from the review queue.</span>
                </p>
              ) : null}
              <p className="text-xs text-gray-500">Submitted {timeAgo(p.createdAt)}{p.decidedAt ? ` · decided ${timeAgo(p.decidedAt)}` : ""}{p.reviewNote ? ` — ${p.reviewNote}` : ""}</p>
              {p.proofUrl ? (
                <a href={p.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-trader underline">Open EFT proof</a>
              ) : (
                <p className="mt-2 text-xs text-amber-800">No proof file attached — ask the user to resubmit or verify in bank statements before approving.</p>
              )}
            </div>
            <div className="flex items-start justify-start lg:justify-end">
              {p.status === "PENDING" ? <PaymentActions id={p.id} reference={p.reference} /> : <span className="text-xs text-gray-500">Reviewed by {p.reviewedBy ?? "admin"}</span>}
            </div>
          </article>
        ))}
        {payments.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-gray-500">
            <p className="font-semibold text-asphalt">Queue is clear.</p>
            <p>New EFT submissions from buyers and dealers will land here as Pending.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
