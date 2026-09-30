"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import { zmw } from "@/lib/format";

export type RenewProduct = { id: string; name: string; description: string; priceZmw: number; durationDays: number };
export type RenewCredit = { id: string; listingProductId: string | null; createdAt: string };

export default function RenewForm({ carId, products, credits }: { carId: string; products: RenewProduct[]; credits: RenewCredit[] }): JSX.Element {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [creditId, setCreditId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const product = products.find((p) => p.id === productId) ?? null;
  const paid = !!product && product.priceZmw > 0;
  const usable = credits.filter((c) => c.listingProductId === productId);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!product) return;
    if (paid && !creditId) {
      setError("Pick an approved payment below — or pay for this package first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { productId: product.id };
      if (paid) body.paymentId = creditId;
      const res = await fetch(`/api/my-listings/${carId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not renew your listing.");
        return;
      }
      router.push("/my-cars?submitted=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
        <p className="font-semibold text-asphalt">No packages on sale right now.</p>
        <p className="mt-1">Renewal will be possible once packages return.</p>
        <Link href="/my-cars" className="mt-3 inline-block rounded border border-line px-5 py-2 text-sm font-semibold hover:bg-lot">Back to my cars</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-bold">Pick a package</h2>
        <div className="mt-2 grid gap-2">
          {products.map((p) => (
            <label key={p.id} className={`cursor-pointer rounded border px-3 py-2.5 text-sm ${productId === p.id ? "border-trader bg-blue-50" : "border-line hover:bg-lot"}`}>
              <input type="radio" name="product" value={p.id} checked={productId === p.id} onChange={() => { setProductId(p.id); setCreditId(""); }} className="mr-2" />
              <span className="font-semibold">{p.name}</span>
              <span className="ml-2 text-gray-600">{p.priceZmw === 0 ? "FREE" : zmw(p.priceZmw)} · {p.durationDays} days</span>
              {p.description ? <span className="mt-0.5 block text-xs text-gray-500">{p.description}</span> : null}
            </label>
          ))}
        </div>
      </section>
      {paid ? (
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-bold">Approved payment</h2>
          {usable.length === 0 ? (
            <div className="mt-2 text-sm text-gray-600">
              <p>No approved payment for this package yet.</p>
              <Link href={`/sell-my-car/pay?product=${product.id}`} className="mt-2 inline-block rounded bg-signal px-4 py-2 text-sm font-bold text-white">Pay {zmw(product.priceZmw)} now</Link>
            </div>
          ) : (
            <div className="mt-2 grid gap-2">
              {usable.map((c) => (
                <label key={c.id} className={`cursor-pointer rounded border px-3 py-2.5 text-sm ${creditId === c.id ? "border-trader bg-blue-50 font-semibold" : "border-line hover:bg-lot"}`}>
                  <input type="radio" name="credit" value={c.id} checked={creditId === c.id} onChange={() => setCreditId(c.id)} className="mr-2" />
                  Approved {timeAgo(c.createdAt)} — one listing
                </label>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy || (paid && !creditId)} className="rounded bg-signal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Renewing…" : paid ? "Renew with payment" : "Renew for free"}
        </button>
        <Link href="/my-cars" className="rounded border border-line px-5 py-2.5 text-sm">Cancel</Link>
      </div>
    </form>
  );
}
