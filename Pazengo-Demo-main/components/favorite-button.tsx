"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ListRow = { id: string; name: string; count: number };

export default function FavoriteButton({
  carId,
  initial,
  signedIn,
  variant,
  refreshOnToggle
}: {
  carId: string;
  initial: boolean;
  signedIn: boolean;
  variant: "icon" | "full";
  refreshOnToggle?: boolean;
}): JSX.Element {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lists, setLists] = useState<ListRow[]>([]);
  const [memberListId, setMemberListId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  // Portal target guard: the dialog renders into document.body (outside any
  // enclosing card link), which only exists after client mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  async function openDialog(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setOpen(true);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/favourite-lists?carId=${encodeURIComponent(carId)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setLists(Array.isArray(json.lists) ? json.lists : []);
        setMemberListId(typeof json.memberListId === "string" ? json.memberListId : null);
        setFav(json.memberListId !== null && json.memberListId !== undefined);
      } else {
        setError(json.error ?? "Could not load your lists.");
      }
    } catch {
      setError("Could not load your lists.");
    } finally {
      setLoading(false);
    }
  }

  function close(): void {
    setOpen(false);
    setError("");
    setNewName("");
    if (refreshOnToggle) router.refresh();
  }

  async function saveTo(listId: string): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, listId })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save favourite.");
        return;
      }
      setFav(true);
      setMemberListId(listId);
      close();
    } finally {
      setBusy(false);
    }
  }

  async function removeFav(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/favourites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId })
      });
      if (!res.ok) {
        setError("Could not remove favourite.");
        return;
      }
      setFav(false);
      setMemberListId(null);
      close();
    } finally {
      setBusy(false);
    }
  }

  async function createList(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/favourite-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.list?.id) {
        setError(json.error ?? "Could not create list.");
        return;
      }
      setLists((prev) => [...prev, { id: json.list.id, name: json.list.name, count: 0 }]);
      setNewName("");
      await saveTo(json.list.id as string);
    } finally {
      setBusy(false);
    }
  }

  const trigger =
    variant === "full" ? (
      <button
        type="button"
        onClick={openDialog}
        aria-pressed={fav}
        aria-label={fav ? "Saved to favourites. Activate to change list." : "Save to favourites"}
        className={`block w-full rounded border px-4 py-2.5 text-center text-sm font-bold ${fav ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100" : "border-line hover:bg-lot"}`}
      >
        {fav ? "♥ Saved to favourites" : "♡ Save to favourites"}
      </button>
    ) : (
      <button
        type="button"
        onClick={openDialog}
        aria-pressed={fav}
        aria-label={fav ? "Saved to favourites. Activate to change list." : "Save to favourites"}
        title={fav ? "Saved to favourites" : "Save to favourites"}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-base shadow ${fav ? "bg-red-600 text-white" : "bg-asphalt/70 text-white hover:bg-asphalt"}`}
      >
        <span aria-hidden="true">{fav ? "♥" : "♡"}</span>
      </button>
    );

  return (
    <>
      {trigger}
      {open && mounted ? createPortal(
        <span
          className="fixed inset-0 z-[60] flex items-center justify-center bg-asphalt/60 p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            close();
          }}
        >
          <span
            role="dialog"
            aria-modal="true"
            aria-label="Save to favourites"
            // NOTE: stopPropagation only — never preventDefault here. Cancelling
            // the click event on a submit button prevents form submission,
            // which is what used to silently break the Create button below.
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="block w-full max-w-sm overflow-hidden rounded-lg bg-white text-asphalt shadow-xl"
          >
            <span className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-bold">Save to favourites</span>
              <button type="button" onClick={close} aria-label="Close" className="rounded px-2 py-1 text-lg font-bold text-gray-500 hover:bg-lot">
                ✕
              </button>
            </span>
            <span className="block max-h-72 overflow-y-auto p-2">
              {loading ? (
                <span className="block px-2 py-6 text-center text-sm text-gray-500">Loading your lists…</span>
              ) : (
                <>
                  {memberListId === "__unsorted__" ? (
                    <span className="block rounded bg-lot px-3 py-2 text-xs text-gray-600">Saved without a list — pick one below to organise it.</span>
                  ) : null}
                  {lists.length === 0 && memberListId === null ? (
                    <span className="block px-2 py-4 text-center text-sm text-gray-600">No lists yet — create your first one below.</span>
                  ) : null}
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={busy || memberListId === l.id}
                      onClick={() => void saveTo(l.id)}
                      className="flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-sm font-semibold hover:bg-lot disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${memberListId === l.id ? "border-trader bg-trader text-white" : "border-gray-300"}`}>
                          {memberListId === l.id ? <span className="text-[10px]">✓</span> : null}
                        </span>
                        {l.name}
                      </span>
                      <span className="text-xs font-normal text-gray-500">{l.count}</span>
                    </button>
                  ))}
                  {memberListId !== null ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeFav()}
                      className="mt-1 block w-full rounded px-3 py-2.5 text-left text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                    >
                      Remove from favourites
                    </button>
                  ) : null}
                </>
              )}
              {error ? <span className="mx-2 mb-2 block rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</span> : null}
            </span>
            <span className="block border-t border-line p-3">
              <form onSubmit={(e) => void createList(e)} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  maxLength={40}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New list name, e.g. Bakkies"
                  aria-label="New list name"
                  className="flex-1 rounded border border-line px-3 py-2 text-sm"
                />
                <button type="submit" disabled={busy || !newName.trim()} className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  Create
                </button>
              </form>
            </span>
          </span>
        </span>,
        document.body
      ) : null}
    </>
  );
}
