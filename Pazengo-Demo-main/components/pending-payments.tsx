import { prisma, dbOk } from "@/lib/db";
import { zmw, timeAgo } from "@/lib/format";
import { Pill, paymentTone } from "@/components/pills";
import { PaymentActions } from "@/components/payment-actions";

/**
 * Money half of the review queue: listing-fee payments waiting for a
 * decision, then recently decided ones. Approving money unlocks the
 * seller's form — it does NOT publish the car (that happens below).
 */
export default async function PendingPayments(): Promise<JSX.Element> {
  type Row = {
    id: string;
    amountZar: number;
    method: string;
    reference: string;
    proofUrl: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote: string | null;
    reviewedBy: string | null;
    createdAt: Date;
    decidedAt: Date | null;
    user: { name: string; email: string; role: string };
    car: { id: string; make: string; model: string; year: number } | null;
    listingProduct: { name: string } | null;
  };
  let pending: Row[] = [];
  let decided: Row[] = [];
  if (await dbOk()) {
    [pending, decided] = await Promise.all([
      prisma.payment.findMany({
        where: { status: "PENDING" },
        include: {
          user: true,
          car: { select: { id: true, make: true, model: true, year: true } },
          listingProduct: { select: { name: true } }
        },
        orderBy: { createdAt: "asc" },
        take: 100
      }) as Promise<Row[]>,
      prisma.payment.findMany({
        where: { status: { in: ["APPROVED", "REJECTED"] } },
        include: {
          user: true,
          car: { select: { id: true, make: true, model: true, year: true } },
          listingProduct: { select: { name: true } }
        },
        orderBy: { decidedAt: "desc" },
        take: 10
      }) as Promise<Row[]>
    ]);
  }
  return (
    <section aria-label="Payments waiting" className="space-y-3 rounded-lg border border-line bg-white p-4">
      <div>
        <h2 className="text-base font-bold">1. Payments waiting ({pending.length})</h2>
        <p className="text-xs text-gray-600">Approve the money to unlock the seller&apos;s form — approving money does not publish the car.</p>
      </div>
      {pending.length === 0 ? (
        <p className="rounded bg-lot p-3 text-sm text-gray-600">No payments waiting. New EFT and mobile-money submissions land here.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((p) => (
            <li key={p.id} className="grid gap-3 rounded border border-line p-3 lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="tabular text-lg font-bold">{zmw(p.amountZar)}</p>
                  <Pill tone={paymentTone(p.status)}>{p.status}</Pill>
                  <span className="text-xs text-gray-500">{p.method === "MOBILE_MONEY" ? "Mobile money" : p.method} · Ref {p.reference}</span>
                </div>
                <p className="mt-1 text-sm"><span className="font-semibold">{p.user.name}</span> <span className="text-gray-500">{p.user.email}</span></p>
                <p className="mt-0.5 text-xs text-gray-600">
                  📦 {p.listingProduct?.name ?? "Listing"}{p.car ? <> for {p.car.year} {p.car.make} {p.car.model}</> : <> <span className="font-semibold text-green-800">(unused credit — unlocks the form)</span></>}
                </p>
                <p className="text-xs text-gray-500">Submitted {timeAgo(p.createdAt)}</p>
                {p.proofUrl ? (
                  <a href={p.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-trader underline">Open proof</a>
                ) : (
                  <p className="mt-2 text-xs text-amber-800">No proof attached — verify in bank statements before approving.</p>
                )}
              </div>
              <div className="flex items-start justify-start lg:justify-end">
                <PaymentActions id={p.id} reference={p.reference} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 ? (
        <details className="rounded border border-line">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-gray-600">
            Recently decided ({decided.length})
          </summary>
          <ul className="divide-y border-t border-line">
            {decided.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-gray-600">
                <Pill tone={paymentTone(p.status)}>{p.status}</Pill>
                <span className="tabular font-semibold text-asphalt">{zmw(p.amountZar)}</span>
                <span>{p.user.name}</span>
                <span>📦 {p.listingProduct?.name ?? "Listing"}</span>
                {p.car ? <span>→ {p.car.year} {p.car.make} {p.car.model}</span> : null}
                <span className="text-gray-400">{p.decidedAt ? timeAgo(p.decidedAt) : ""}{p.reviewNote ? ` — ${p.reviewNote}` : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
