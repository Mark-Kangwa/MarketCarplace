"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { zmw } from "@/lib/format";

type Product = { id: string; name: string; description: string; priceZmw: number; durationDays: number };

export default function CheckoutFlow(): JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "missing" | "ready">("loading");
  const [draft, setDraft] = useState<{ productId: string; paymentId: string | null; body: Record<string, unknown> } | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let parsed: { productId?: string; paymentId?: string | null; body?: Record<string, unknown> } | null = null;
    try {
      parsed = JSON.parse(sessionStorage.getItem("sell-draft") ?? "null");
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed.productId !== "string" || !parsed.body || typeof parsed.body !== "object") {
      setPhase("missing");
      return;
    }
    const d = {
      productId: parsed.productId,
      paymentId: typeof parsed.paymentId === "string" ? parsed.paymentId : null,
      body: parsed.body as Record<string, unknown>
    };
    setDraft(d);
    fetch("/api/listing-products", { credentials: "same-origin" })
      .then((r) => r.json().catch(() => ({})))
      .then((j) => {
        const hit = Array.isArray(j.products)
          ? (j.products as Product[]).find((p) => p.id === d.productId)
          : undefined;
        if (!hit) {
          setGone(true);
          setPhase("ready");
          return;
        }
        setProduct(hit);
        setPhase("ready");
      })
      .catch(() => {
        setError("Could not load packages. Check your connection and try again.");
        setPhase("ready");
      });
  }, []);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!draft || !product) return;
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { productId: product.id, ...draft.body };
      if (product.priceZmw > 0) {
        if (!draft.paymentId) {
          setError("Your payment approval is missing — start again from packages.");
          return;
        }
        payload.paymentId = draft.paymentId;
      }
      const res = await fetch("/api/my-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not submit your listing.");
        return;
      }
      try {
        sessionStorage.removeItem("sell-draft");
      } catch {
        /* storage unavailable — harmless, draft is submitted */
      }
      router.push("/my-cars?submitted=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return <p className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">Loading your listing…</p>;
  }
  if (phase === "missing") {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
        <p className="font-semibold text-asphalt">No listing in progress.</p>
        <p className="mt-1">Pick a package and fill in your car first.</p>
        <Link href="/sell-my-car" className="mt-3 inline-block rounded bg-signal px-5 py-2.5 font-bold text-white">Choose a package</Link>
      </div>
    );
  }
  if (gone || !product) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
        <p className="font-semibold text-asphalt">That package is no longer available.</p>
        <p className="mt-1">Pick another package — your car details are kept in the previous step.</p>
        <Link href="/sell-my-car" className="mt-3 inline-block rounded bg-signal px-5 py-2.5 font-bold text-white">Choose a package</Link>
      </div>
    );
  }
  const body = draft?.body ?? {};
  const title = `${String(body.year ?? "")} ${String(body.make ?? "")} ${String(body.model ?? "")}`.trim() || "Your car";
  const free = product.priceZmw === 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-bold">Confirm your listing</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Car</dt>
            <dd className="font-semibold">{title}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Package</dt>
            <dd className="font-semibold">{product.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Valid for</dt>
            <dd className="font-semibold">{product.durationDays} day{product.durationDays === 1 ? "" : "s"} once published</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Payment</dt>
            <dd className="font-semibold">{free ? "Free — no payment needed" : "Paid ✓ approved"}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base">
            <dt className="font-bold">Total</dt>
            <dd className="tabular font-bold">{free ? "K 0" : zmw(product.priceZmw)}</dd>
          </div>
        </dl>
        {free ? (
          <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">
            You selected the free package — valid for {product.durationDays} days and the total cost is K 0.
          </p>
        ) : (
          <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">
            Your payment for this package is approved — submitting now attaches this listing to it (one listing per payment).
          </p>
        )}
      </section>

      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded bg-signal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Submitting…" : "Submit for review"}
        </button>
        <Link href={`/sell-my-car/list?product=${product.id}`} className="rounded border border-line px-5 py-2.5 text-sm">← Back</Link>
      </div>
    </form>
  );
}
