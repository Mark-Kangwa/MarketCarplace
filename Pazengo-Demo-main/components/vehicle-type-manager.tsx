"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type VType = { id: string; name: string; slug: string; _count: { fields: number; cars: number } };

export default function VehicleTypeManager({ initial }: { initial: VType[] }): JSX.Element {
  const router = useRouter();
  const [types, setTypes] = useState<VType[]>(initial);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<VType | null>(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");

  async function refresh(): Promise<void> {
    router.refresh();
    const r = await fetch("/api/admin/vehicle-types", { credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.types) setTypes(j.types);
  }

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setMsg("");
    const r = await fetch("/api/admin/vehicle-types", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not create type."); return; }
    setName("");
    await refresh();
  }

  async function rename(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!editing) return;
    setMsg("");
    const r = await fetch(`/api/admin/vehicle-types/${editing.id}`, {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not rename type."); return; }
    setEditing(null);
    await refresh();
  }

  async function remove(t: VType): Promise<void> {
    setMsg("");
    if (!window.confirm(`Delete vehicle type “${t.name}”? Its field assignments will be removed.`)) return;
    const r = await fetch(`/api/admin/vehicle-types/${t.id}`, { method: "DELETE", credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not delete type."); return; }
    await refresh();
  }

  return (
    <div className="space-y-4">
      {msg ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}
      <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded border border-line bg-white p-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">New vehicle type</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Motorbike" className="w-64 rounded border border-line px-2 py-1.5" />
        </label>
        <button className="rounded bg-trader px-4 py-1.5 text-sm font-semibold text-white">Add type</button>
      </form>
      <ul className="divide-y rounded border border-line bg-white">
        {types.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-gray-500">{t._count.fields} fields · {t._count.cars} listings</p>
            </div>
            <div className="flex gap-2 text-sm">
              <a href={`/admin/vehicle-config/form-fields?type=${t.slug}`} className="rounded border border-line px-3 py-1.5 hover:bg-lot">Fields</a>
              <button
                onClick={() => { setEditing(t); setEditName(t.name); setMsg(""); }}
                className="rounded border border-line px-3 py-1.5 hover:bg-lot"
              >
                Rename
              </button>
              <button onClick={() => remove(t)} className="rounded border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </li>
        ))}
        {types.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No vehicle types yet.</li> : null}
      </ul>
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Rename vehicle type">
          <form onSubmit={rename} className="w-full max-w-sm space-y-3 rounded bg-white p-4">
            <h2 className="font-semibold">Rename “{editing.name}”</h2>
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded border border-line px-2 py-1.5" />
            <div className="flex justify-end gap-2 text-sm">
              <button type="button" onClick={() => setEditing(null)} className="rounded border border-line px-3 py-1.5">Cancel</button>
              <button className="rounded bg-trader px-3 py-1.5 font-semibold text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
