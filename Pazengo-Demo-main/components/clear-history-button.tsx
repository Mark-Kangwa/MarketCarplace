"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClearHistoryButton(): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(): Promise<void> {
    if (!confirm("Clear your recent activity?")) return;
    setBusy(true);
    try {
      await fetch("/api/recent-activity", { method: "DELETE" });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-lot disabled:opacity-60"
    >
      {busy ? "Clearing…" : "Clear history"}
    </button>
  );
}
