"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteCarButton({ id, label }: { id: string; label: string }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onDelete(): Promise<void> {
    if (!confirm(`Remove ${label} from inventory? This cannot be undone.`)) return;
    setBusy(true);
    await fetch(`/api/admin/cars/${id}`, { method: "DELETE" });
    router.push("/admin/inventory/published");
    router.refresh();
  }
  return (
    <button onClick={onDelete} disabled={busy} className="rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
      {busy ? "Removing…" : "Remove car"}
    </button>
  );
}
