"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveButton({ id, label }: { id: string; label: string }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve(): Promise<void> {
    if (!window.confirm(`Publish “${label}” to the marketplace?`)) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/cars/${id}/approve`, { method: "POST", credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? "Could not publish."); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        disabled={busy}
        onClick={approve}
        title="Publish this listing to the marketplace"
        className="rounded bg-green-700 px-2.5 py-1 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "…" : "✓ Publish"}
      </button>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
