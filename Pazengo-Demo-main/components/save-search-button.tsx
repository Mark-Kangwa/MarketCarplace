"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SaveSearchButton({
  defaultName,
  search,
  signedIn
}: {
  defaultName: string;
  search: Record<string, string>;
  signedIn: boolean;
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function onOpen(): void {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setName(defaultName);
    setError("");
    setSaved(false);
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), search })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save search.");
        return;
      }
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="rounded border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-lot"
      >
        🔔 Save search
      </button>
      {open ? (
        <span
          className="fixed inset-0 z-[60] flex items-center justify-center bg-asphalt/60 p-4"
          onClick={() => setOpen(false)}
        >
          <span
            role="dialog"
            aria-modal="true"
            aria-label="Save search"
            onClick={(e) => e.stopPropagation()}
            className="block w-full max-w-sm overflow-hidden rounded-lg bg-white p-4 text-asphalt shadow-xl"
          >
            {saved ? (
              <>
                <p className="text-sm font-bold">Search saved.</p>
                <p className="mt-1 text-sm text-gray-600">We’ll highlight new matches here. Turn on email alerts anytime from your Alerts page.</p>
                <span className="mt-4 flex gap-2">
                  <Link href="/alerts" className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">
                    View alerts
                  </Link>
                  <button type="button" onClick={() => setOpen(false)} className="rounded border border-line px-4 py-2 text-sm font-semibold hover:bg-lot">
                    Keep browsing
                  </button>
                </span>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <label htmlFor="save-search-name" className="block text-sm font-bold">Save this search</label>
                <p className="mt-1 text-xs text-gray-500">Get back to these results anytime and see new matches first.</p>
                <input
                  id="save-search-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Saved search name"
                  className="mt-3 w-full rounded border border-line px-3 py-2 text-sm"
                />
                {error ? <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
                <span className="mt-3 flex gap-2">
                  <button disabled={busy} className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? "Saving…" : "Save search"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="rounded border border-line px-4 py-2 text-sm font-semibold hover:bg-lot">
                    Cancel
                  </button>
                </span>
              </form>
            )}
          </span>
        </span>
      ) : null}
    </>
  );
}
