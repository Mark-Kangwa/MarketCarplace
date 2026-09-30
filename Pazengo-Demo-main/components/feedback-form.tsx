"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FeedbackForm({ carId }: { carId: string }): JSX.Element {
  const router = useRouter();
  const [decision, setDecision] = useState("REQUEST_CHANGES");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!message.trim()) {
      setError("Write a message — the seller needs to know what to fix.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cars/${carId}/feedback`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, message: message.trim() })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not send feedback.");
        return;
      }
      setMessage("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-2 rounded border border-line bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Decision</span>
          <select value={decision} onChange={(e) => setDecision(e.target.value)} className="rounded border border-line px-2 py-1.5">
            <option value="REQUEST_CHANGES">Request changes</option>
            <option value="REJECTED">Reject</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Message to seller (open text)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Rejected — we don't allow illegal images. / You submitted only one photo, we need at least four."
            className="rounded border border-line px-2 py-1.5"
          />
        </label>
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
      <div>
        <button disabled={busy} className="rounded bg-asphalt px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </form>
  );
}
