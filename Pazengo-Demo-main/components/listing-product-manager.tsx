"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type Product = {
  id: string; name: string; description: string; priceZmw: number; durationDays: number;
  _count: { cars: number };
};

function emptyForm(): { name: string; description: string; price: string; duration: string } {
  return { name: "", description: "", price: "", duration: "" };
}

export default function ListingProductManager({ initial }: { initial: Product[] }): JSX.Element {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initial);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState<Product | null>(null);
  const [msg, setMsg] = useState("");

  async function refresh(): Promise<void> {
    router.refresh();
    const r = await fetch("/api/admin/listing-products", { credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.products) setProducts(j.products);
  }

  function payload(f: typeof form) {
    return {
      name: f.name.trim(),
      description: f.description.trim(),
      priceZmw: f.price === "" ? undefined : Number(f.price),
      durationDays: f.duration === "" ? undefined : Number(f.duration)
    };
  }

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setMsg("");
    const r = await fetch("/api/admin/listing-products", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(form))
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not create product."); return; }
    setForm(emptyForm());
    await refresh();
  }

  function openEdit(p: Product): void {
    setEditing(p);
    setForm({ name: p.name, description: p.description, price: String(p.priceZmw), duration: String(p.durationDays) });
    setMsg("");
  }

  async function saveEdit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!editing) return;
    setMsg("");
    const r = await fetch(`/api/admin/listing-products/${editing.id}`, {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(form))
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not update product."); return; }
    setEditing(null);
    setForm(emptyForm());
    await refresh();
  }

  async function remove(p: Product): Promise<void> {
    setMsg("");
    const extra = p._count.cars > 0
      ? ` ${p._count.cars} past listing${p._count.cars === 1 ? " keeps" : "s keep"} its name and stays untouched.`
      : "";
    if (!window.confirm(`Delete “${p.name}”?${extra}`)) return;
    const r = await fetch(`/api/admin/listing-products/${p.id}`, { method: "DELETE", credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not delete product."); return; }
    await refresh();
  }

  return (
    <div className="space-y-4">
      {msg ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}
      {!editing ? (
        <form onSubmit={create} className="grid gap-3 rounded border border-line bg-white p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Name *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Special listing" className="rounded border border-line px-2 py-1.5" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Price (K) *</span>
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} inputMode="numeric" placeholder="0 = free" className="rounded border border-line px-2 py-1.5" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Duration (days) *</span>
              <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} inputMode="numeric" placeholder="e.g. 14" className="rounded border border-line px-2 py-1.5" />
            </label>
          </div>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Description</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What the buyer gets…" className="rounded border border-line px-2 py-1.5" />
          </label>
          <div className="sm:col-span-2">
            <button className="rounded bg-trader px-4 py-1.5 text-sm font-semibold text-white">Add product</button>
          </div>
        </form>
      ) : null}
      <ul className="divide-y rounded border border-line bg-white">
        {products.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.name}
                <span className="ml-2 rounded bg-lot px-1.5 py-0.5 text-[11px] font-bold text-gray-600">
                  {p.priceZmw === 0 ? "FREE" : `K ${p.priceZmw.toLocaleString("en-ZM")}`} · {p.durationDays} days
                </span>
              </p>
              {p.description ? <p className="mt-0.5 text-xs text-gray-500">{p.description}</p> : null}
              <p className="text-xs text-gray-400">On {p._count.cars} listing{p._count.cars === 1 ? "" : "s"}</p>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => openEdit(p)} className="rounded border border-line px-3 py-1.5 hover:bg-lot">Edit</button>
              <button onClick={() => remove(p)} className="rounded border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </li>
        ))}
        {products.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No products yet — add the first one above. Until then nobody can list a car.</li> : null}
      </ul>
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Edit ${editing.name}`}>
          <form onSubmit={saveEdit} className="w-full max-w-md space-y-3 rounded bg-white p-4 text-sm">
            <h2 className="font-semibold">Edit “{editing.name}”</h2>
            <label className="grid gap-1">
              <span className="font-medium">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-line px-2 py-1.5" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="font-medium">Price (K)</span>
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} inputMode="numeric" className="rounded border border-line px-2 py-1.5" />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">Duration (days)</span>
                <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} inputMode="numeric" className="rounded border border-line px-2 py-1.5" />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="font-medium">Description</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="rounded border border-line px-2 py-1.5" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()); }} className="rounded border border-line px-3 py-1.5">Cancel</button>
              <button className="rounded bg-trader px-3 py-1.5 font-semibold text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
