"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { zmw } from "@/lib/format";

const METHOD_INSTRUCTIONS: Record<string, { label: string; body: string }> = {
  EFT: {
    label: "EFT / bank transfer",
    body: "Transfer the total to Pazengo from your bank app, then enter the bank transaction reference below. A proof screenshot is optional but speeds up approval — you can fill your car form as soon as we approve."
  },
  MOBILE_MONEY: {
    label: "Mobile money",
    body: "Send the total via Airtel Money or MTN MoMo, then enter the mobile-money transaction ID below. A receipt screenshot is optional but speeds up approval — you can fill your car form as soon as we approve."
  }
};

export default function PayForm({ productId }: { productId: string }): JSX.Element {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState("EFT");
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onProof(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", files[0]);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Proof upload failed. Use JPG, PNG or WebP under 5MB.");
        return;
      }
      const urls = Array.isArray(json.urls) ? (json.urls as string[]) : [];
      if (urls[0]) setProofUrl(urls[0]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, method, reference: reference.trim(), proofUrl })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not record your payment.");
        return;
      }
      router.push("/my-cars?paid=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="space-y-3 rounded-lg border border-line bg-white p-4">
        <h2 className="font-bold">Select a payment option</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
          {Object.entries(METHOD_INSTRUCTIONS).map(([value, info]) => (
            <label key={value} className={`cursor-pointer rounded border px-3 py-2.5 text-sm ${method === value ? "border-trader bg-blue-50 font-semibold" : "border-line hover:bg-lot"}`}>
              <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="mr-2" />
              {info.label}
            </label>
          ))}
        </div>
        <p className="rounded bg-lot p-3 text-xs text-gray-600">{METHOD_INSTRUCTIONS[method]?.body}</p>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Payment transaction reference *</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} required minLength={3} maxLength={60} placeholder="e.g. EFT 88231 / MoMo ID" className="rounded border border-line px-3 py-2" />
        </label>
        <div>
          <label htmlFor="pay-proof" className="mb-1 block text-sm font-medium">Proof of payment (optional)</label>
          <input ref={fileRef} id="pay-proof" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => onProof(e.target.files)} className="block w-full text-sm file:mr-3 file:rounded file:border file:border-line file:bg-lot file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-line disabled:opacity-50" />
          {uploading ? <p role="status" className="mt-1 text-xs text-gray-500">Uploading…</p> : null}
          {proofUrl ? <p className="mt-1 text-xs font-semibold text-green-800">✓ Proof attached.</p> : null}
        </div>
      </section>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy || uploading} className="rounded bg-signal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Recording…" : "Submit payment for review"}
        </button>
        <Link href="/sell-my-car" className="rounded border border-line px-5 py-2.5 text-sm">← Packages</Link>
      </div>
    </form>
  );
}
