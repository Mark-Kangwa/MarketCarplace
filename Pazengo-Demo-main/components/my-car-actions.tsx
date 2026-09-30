"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MyCarActions({ id, status }: { id: string; status: string }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(next: "SOLD" | "DRAFT"): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/my-listings/${id}/status`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? "Could not update."); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/my-listings/${id}`, { method: "DELETE", credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? "Could not delete."); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {status !== "SOLD" && status !== "BLOCKED" ? (
        <button onClick={() => setStatus("SOLD")} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot disabled:opacity-50">
          Mark as sold
        </button>
      ) : null}
      {status === "SOLD" ? (
        <button onClick={() => setStatus("DRAFT")} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot disabled:opacity-50">
          Relist for review
        </button>
      ) : null}
      <button onClick={remove} disabled={busy} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
        Delete
      </button>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
