"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PaymentActions({ id, reference }: { id: string; reference: string }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function decide(path: "approve" | "reject"): Promise<void> {
    let note = "";
    if (path === "reject") {
      note = prompt(`Reject payment ${reference}? Tell the user what to fix:`, "EFT slip unclear — resubmit with visible reference") ?? "";
      if (!note.trim()) return;
    } else if (!confirm(`Approve payment ${reference}? Only approve after money reflects in the bank.`)) {
      return;
    }
    setBusy(path);
    const res = await fetch(`/api/admin/payments/${id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    });
    setBusy(null);
    if (!res.ok) alert("Decision failed. Try again.");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button disabled={busy !== null} onClick={() => decide("approve")} className="rounded bg-success px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
        {busy === "approve" ? "Approving…" : "Approve"}
      </button>
      <button disabled={busy !== null} onClick={() => decide("reject")} className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </button>
    </div>
  );
}
