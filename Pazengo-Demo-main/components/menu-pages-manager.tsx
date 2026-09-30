"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type MenuRow = {
  id: string; key: string; label: string; href: string | null; emphasized: boolean; position: number; visible: boolean;
};

export default function MenuPagesManager({ initial }: { initial: MenuRow[] }): JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<MenuRow[]>([...initial].sort((a, b) => a.position - b.position));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(url, {
        method, credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error ?? "Something went wrong."); return false; }
      try {
        router.refresh();
      } catch {
        /* data saved; list updates on next navigation */
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: MenuRow): Promise<void> {
    if (await call(`/api/admin/menu-items/${m.id}`, "PATCH", { visible: !m.visible })) {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, visible: !x.visible } : x)));
    }
  }

  async function move(id: string, dir: -1 | 1): Promise<void> {
    const order = [...items].sort((a, b) => a.position - b.position);
    const i = order.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    const ok = await call("/api/admin/menu-items/reorder", "POST", { ids: next.map((x) => x.id) });
    if (!ok) setItems(order);
  }

  async function saveRename(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const m = items.find((x) => x.id === renaming);
    if (!m) return;
    const label = renameText.trim();
    if (!label) { setMsg("Label cannot be empty."); return; }
    if (await call(`/api/admin/menu-items/${m.id}`, "PATCH", { label })) {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, label } : x)));
      setRenaming(null);
    }
  }

  async function remove(m: MenuRow): Promise<void> {
    if (!window.confirm(`Remove “${m.label}” from the header? Its page (if any) stays live at its address.`)) return;
    if (await call(`/api/admin/menu-items/${m.id}`, "DELETE")) {
      setItems((prev) => prev.filter((x) => x.id !== m.id));
    }
  }

  async function reset(): Promise<void> {
    if (!window.confirm("Reset the header menu to the five defaults? Your renames and order will be replaced.")) return;
    if (await call("/api/admin/menu-items/reorder", "POST", { reset: true })) {
      const r = await fetch("/api/admin/menu-items", { credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.items)) setItems(j.items);
      else router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {msg ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}
      <ul className="divide-y rounded border border-line bg-white">
        {items.map((m, i) => (
          <li key={m.id} className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${m.visible ? "" : "opacity-60"}`}>
            <span className="flex gap-1">
              <button onClick={() => move(m.id, -1)} disabled={busy || i === 0} aria-label={`Move ${m.label} up`} title="Move up" className="rounded border border-line px-2 py-1 text-xs hover:bg-lot disabled:opacity-40">▲</button>
              <button onClick={() => move(m.id, 1)} disabled={busy || i === items.length - 1} aria-label={`Move ${m.label} down`} title="Move down" className="rounded border border-line px-2 py-1 text-xs hover:bg-lot disabled:opacity-40">▼</button>
            </span>
            <span className="min-w-0 flex-1">
              {renaming === m.id ? (
                <form onSubmit={saveRename} className="flex gap-2">
                  <input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} aria-label="New label" className="w-full max-w-xs rounded border border-line px-2 py-1 text-sm" />
                  <button disabled={busy} className="rounded bg-trader px-3 py-1 text-sm font-semibold text-white">Save</button>
                  <button type="button" onClick={() => setRenaming(null)} className="rounded border border-line px-3 py-1 text-sm">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="font-medium">{m.label}</span>
                  <span className="ml-2 text-xs text-gray-500">{m.href ?? "text only"}{m.emphasized ? " · button" : ""}{m.visible ? "" : " · hidden"}</span>
                </>
              )}
            </span>
            {renaming !== m.id ? (
              <>
                <button onClick={() => { setRenaming(m.id); setRenameText(m.label); setMsg(""); }} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Rename</button>
                <button onClick={() => toggle(m)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">{m.visible ? "Hide" : "Show"}</button>
                <button onClick={() => remove(m)} disabled={busy} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">Delete</button>
              </>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">Menu is empty — the header shows just the logo. Reset below to restore defaults.</li> : null}
      </ul>
      <div>
        <button onClick={reset} disabled={busy} className="rounded border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-lot">Reset to defaults</button>
      </div>
    </div>
  );
}
