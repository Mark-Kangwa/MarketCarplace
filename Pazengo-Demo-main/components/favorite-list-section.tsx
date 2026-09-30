"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FavoriteListSection({
  id,
  name,
  children
}: {
  id: string;
  name: string;
  children: React.ReactNode;
}): JSX.Element {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onRename(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const next = value.trim();
    if (!next || next === name) {
      setRenaming(false);
      setValue(name);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/favourite-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not rename list.");
        return;
      }
      setRenaming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (!confirm(`Delete the list "${name}"? Its cars move to Unsorted.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/favourite-lists/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not delete list.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`List ${name}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <form onSubmit={onRename} className="flex flex-1 gap-2">
            <input
              type="text"
              value={value}
              required
              maxLength={40}
              onChange={(e) => setValue(e.target.value)}
              aria-label="List name"
              className="flex-1 rounded border border-line px-3 py-1.5 text-sm font-bold"
            />
            <button disabled={busy} className="rounded bg-asphalt px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setValue(name);
                setError("");
              }}
              className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h2 className="text-xl font-bold">{name}</h2>
            <span className="flex gap-2">
              <button type="button" onClick={() => setRenaming(true)} className="rounded border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-lot">
                Rename
              </button>
              <button type="button" disabled={busy} onClick={onDelete} className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60">
                Delete
              </button>
            </span>
          </>
        )}
      </div>
      {error ? <p role="alert" className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
      {children}
    </section>
  );
}
