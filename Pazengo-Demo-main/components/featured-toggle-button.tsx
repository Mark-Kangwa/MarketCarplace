"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FeaturedToggleButton({ id, featured }: { id: string; featured: boolean }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      await fetch(`/api/admin/cars/${id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: !featured })
      });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  if (featured) {
    return (
      <button
        disabled={busy}
        onClick={toggle}
        title="Remove from featured — moves to regular listings"
        className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
      >
        {busy ? "…" : "★ Unfeature"}
      </button>
    );
  }
  return (
    <button
      disabled={busy}
      onClick={toggle}
      title="Feature this listing — pins to top of homepage"
      className="rounded border border-line bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-lot disabled:opacity-60"
    >
      {busy ? "…" : "☆ Feature"}
    </button>
  );
}
