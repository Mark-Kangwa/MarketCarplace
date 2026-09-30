"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function BlockButton({ id, name, blocked }: { id: string; name: string; blocked: boolean }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(path: "block" | "unblock"): Promise<void> {
    let reason = "";
    if (path === "block") {
      reason = prompt(`Block ${name}? Give a reason (shown in audit log):`, "Abuse of marketplace") ?? "";
      if (!reason.trim()) return;
      if (!confirm(`Block ${name} and revoke access immediately?`)) return;
    }
    setBusy(true);
    await fetch(`/api/admin/users/${id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setBusy(false);
    router.refresh();
  }

  if (blocked) {
    return <button disabled={busy} onClick={() => act("unblock")} className="rounded border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-lot">Restore access</button>;
  }
  return <button disabled={busy} onClick={() => act("block")} className="rounded bg-signal px-3 py-1.5 text-xs font-bold text-white">Block</button>;
}
