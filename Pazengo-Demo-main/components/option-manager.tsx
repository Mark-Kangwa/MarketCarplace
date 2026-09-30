"use client";
import Link from "next/link";
import { useState } from "react";
import { displayOption, isCanonicalOptionCode, isStrictOptionBinding, optionIdentity, parseDisplayOption } from "@/lib/validators";

type Override = { typeName: string; typeSlug: string; options: string[] };

function splitLines(raw: string): string[] {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

export default function OptionManager(props: {
  fieldId: string;
  fieldLabel: string;
  binding: string | null;
  inventoryMode: boolean;
  baseOptions: string[];
  overrides: Override[];
  usage: Record<string, number>;
  canPropagate: boolean;
}): JSX.Element {
  const key = props.binding ?? "";
  const [base, setBase] = useState<string[]>(props.baseOptions);
  const [usage, setUsage] = useState<Record<string, number>>(props.usage);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [single, setSingle] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [propagate, setPropagate] = useState(false);

  // Identity-aware like absorption: "CHERY" is covered by shared "Chery".
  const extras = Object.entries(usage)
    .filter(([v]) => !base.some((b) => optionIdentity(key, b) === optionIdentity(key, v)))
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  const allValues = [...base, ...extras.map((e) => e.value)];
  const q = query.trim().toLowerCase();
  const matchRow = (v: string): boolean =>
    !q || v.toLowerCase().includes(q) || displayOption(key, v).toLowerCase().includes(q);
  const libRows = base.filter(matchRow);
  const extraRows = extras.filter((e) => matchRow(e.value));

  async function patchOptions(next: string[]): Promise<boolean> {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/vehicle-fields/${props.fieldId}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: next })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error ?? "Could not save options."); return false; }
      setBase(next);
      return true;
    } finally {
      setBusy(false);
    }
  }

  function dupOf(text: string, ignore?: string): string | null {
    const id = optionIdentity(key, text);
    const hit = allValues.find((v) => v !== ignore && optionIdentity(key, v) === id);
    return hit ?? null;
  }

  function toCode(text: string): string | null {
    const code = parseDisplayOption(key, text);
    if (isStrictOptionBinding(key) && !isCanonicalOptionCode(key, code)) return null;
    return code;
  }

  async function addSingle(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const dup = dupOf(single);
    if (dup) { setMsg(`“${single.trim()}” already exists as “${displayOption(key, dup)}”.`); return; }
    const code = toCode(single);
    if (code === null) { setMsg(`“${single.trim()}” is not valid for ${props.fieldLabel}.`); return; }
    if (await patchOptions([...base, code])) setSingle("");
  }

  async function addBulk(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const lines = splitLines(bulk);
    if (lines.length === 0) { setMsg("Type at least one option."); return; }
    const next = [...base];
    const skipped: string[] = [];
    for (const line of lines) {
      const code = toCode(line);
      if (code === null || next.some((v) => optionIdentity(key, v) === optionIdentity(key, code))) {
        skipped.push(line);
        continue;
      }
      next.push(code);
    }
    if (next.length === base.length) {
      setMsg(skipped.length > 0 ? `Nothing added — skipped duplicates/invalid: ${skipped.join(", ")}.` : "Nothing added.");
      return;
    }
    const added = next.length - base.length;
    if (await patchOptions(next)) {
      setBulk("");
      setShowBulk(false);
      if (skipped.length > 0) setMsg(`Added ${added} option${added === 1 ? "" : "s"}. Skipped: ${skipped.join(", ")}.`);
    }
  }

  async function removeOption(value: string): Promise<void> {
    const count = usage[value] ?? 0;
    const extra = count > 0
      ? ` ${count} listing${count === 1 ? " keeps" : "s keep"} the value — and it will rejoin this list on its next save unless those cars change.`
      : "";
    if (!window.confirm(`Remove “${displayOption(key, value)}” from the shared list?${extra}`)) return;
    await patchOptions(base.filter((o) => o !== value));
  }

  function openRename(value: string): void {
    setRenaming(value);
    setRenameText(displayOption(key, value));
    setPropagate(false);
    setMsg("");
  }

  async function saveRename(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!renaming) return;
    const inBase = base.includes(renaming);
    const code = toCode(renameText);
    if (code === null) {
      setMsg(`“${renameText.trim()}” is not valid for ${props.fieldLabel}.`);
      return;
    }
    if (code === renaming) { setRenaming(null); return; }
    const others = allValues.filter((v) => v !== renaming);
    if (others.some((v) => optionIdentity(key, v) === optionIdentity(key, code))) {
      setMsg(`“${renameText.trim()}” already exists.`);
      return;
    }
    if (!inBase && !propagate) {
      setMsg("This value only exists on listings — tick “update listings too” to rename it there.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/vehicle-fields/${props.fieldId}/rename`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: renaming, to: code, propagate: props.canPropagate && propagate })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error ?? "Could not rename."); return; }
      if (inBase) setBase((prev) => prev.map((o) => (o === renaming ? code : o)));
      if (j.propagated) {
        setUsage((prev) => {
          const next = { ...prev };
          const moved = next[renaming] ?? 0;
          delete next[renaming];
          next[code] = (next[code] ?? 0) + moved;
          return next;
        });
      }
      setRenaming(null);
      setRenameText("");
      setPropagate(false);
      if (j.propagated) setMsg(`Renamed and updated ${j.count} listing${j.count === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  }

  function rowLabel(v: string): JSX.Element {
    const label = displayOption(key, v);
    return (
      <span>
        <span className="font-medium">{label}</span>
        {label !== v ? <span className="ml-2 font-mono text-xs text-gray-400">{v}</span> : null}
      </span>
    );
  }

  function usageCell(v: string): JSX.Element {
    const n = usage[v] ?? 0;
    if (n === 0) return <span className="text-xs text-gray-400">—</span>;
    const text = `${n} listing${n === 1 ? "" : "s"}`;
    if (props.binding === "make" || props.binding === "model") {
      return <Link href={`/admin/inventory?q=${encodeURIComponent(v)}`} className="text-xs font-semibold text-trader hover:underline">{text}</Link>;
    }
    return <span className="text-xs text-gray-600">{text}</span>;
  }

  return (
    <div className="space-y-4">
      {msg ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}

      {!props.inventoryMode ? (
        <section className="rounded border border-line bg-white p-4">
          <h2 className="font-semibold">Add an option</h2>
          <form onSubmit={addSingle} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">New option</span>
              <input
                value={single}
                onChange={(e) => setSingle(e.target.value)}
                placeholder="e.g. GWM"
                className="w-64 rounded border border-line px-2 py-1.5"
              />
            </label>
            <button disabled={busy || !single.trim()} className="rounded bg-trader px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setShowBulk((v) => !v)} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">
              {showBulk ? "Hide bulk add" : "Bulk add"}
            </button>
          </form>
          {single.trim() && dupOf(single) ? (
            <p className="mt-1 text-xs text-amber-700">Already exists as “{displayOption(key, dupOf(single) as string)}” — search the list instead.</p>
          ) : null}
          {showBulk ? (
            <form onSubmit={addBulk} className="mt-3 grid max-w-xl gap-2 text-sm">
              <label className="grid gap-1">
                <span className="font-medium">One per line (duplicates and invalid lines are skipped)</span>
                <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={4} placeholder={"GWM\nChery\nBYD"} className="rounded border border-line px-2 py-1.5" />
              </label>
              <div>
                <button disabled={busy} className="rounded bg-trader px-4 py-1.5 font-semibold text-white disabled:opacity-50">Add all</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="rounded border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">Options ({libRows.length}{q ? ` of ${base.length}` : ""})</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search options…" aria-label="Search options" className="w-56 rounded border border-line px-3 py-1.5 text-sm" />
        </div>
        <ul className="divide-y">
          {libRows.map((v) => (
            <li key={v} className="px-4 py-2.5">
              {renaming === v ? (
                <form onSubmit={saveRename} className="flex flex-wrap items-center gap-2 text-sm">
                  <input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} aria-label={`New name for ${displayOption(key, v)}`} className="w-56 rounded border border-line px-2 py-1.5" />
                  {props.canPropagate && (usage[v] ?? 0) > 0 ? (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input type="checkbox" checked={propagate} onChange={(e) => setPropagate(e.target.checked)} />
                      Update {usage[v]} listing{(usage[v] ?? 0) === 1 ? "" : "s"} too
                    </label>
                  ) : null}
                  <button disabled={busy} className="rounded bg-trader px-3 py-1.5 font-semibold text-white disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setRenaming(null)} className="rounded border border-line px-3 py-1.5 hover:bg-lot">Cancel</button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">{rowLabel(v)}</span>
                  <span className="w-24 text-right">{usageCell(v)}</span>
                  <button onClick={() => openRename(v)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Rename</button>
                  {!props.inventoryMode ? (
                    <button onClick={() => removeOption(v)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Remove</button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
          {libRows.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">{q ? `No options match “${query}”.` : "No options yet — add the first one above."}</li> : null}
        </ul>
        {extraRows.length > 0 ? (
          <>
            <h3 className="border-t border-line bg-lot/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              On listings, not in the shared list ({extraRows.length})
            </h3>
            <p className="border-b border-line bg-lot/60 px-4 pb-2 text-xs text-gray-500">
              New values join the shared list automatically when listings save — this section is normally empty.
            </p>
            <ul className="divide-y">
              {extraRows.map((e) => (
                <li key={e.value} className="px-4 py-2.5">
                  {renaming === e.value ? (
                    <form onSubmit={saveRename} className="flex flex-wrap items-center gap-2 text-sm">
                      <input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} aria-label={`New name for ${e.value}`} className="w-56 rounded border border-line px-2 py-1.5" />
                      {props.canPropagate ? (
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input type="checkbox" checked={propagate} onChange={(ev) => setPropagate(ev.target.checked)} />
                          Update {e.count} listing{e.count === 1 ? "" : "s"} too (required here)
                        </label>
                      ) : null}
                      <button disabled={busy} className="rounded bg-trader px-3 py-1.5 font-semibold text-white disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => setRenaming(null)} className="rounded border border-line px-3 py-1.5 hover:bg-lot">Cancel</button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1">{rowLabel(e.value)}</span>
                      <span className="w-24 text-right">{usageCell(e.value)}</span>
                      <button onClick={() => openRename(e.value)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Rename</button>
                      <Link href={`/admin/inventory?q=${encodeURIComponent(e.value)}`} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Stock</Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {props.overrides.length > 0 ? (
        <section className="rounded border border-line bg-white p-4">
          <h2 className="font-semibold">Per-type lists ({props.overrides.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {props.overrides.map((o) => (
              <li key={o.typeSlug} className="flex flex-wrap items-center justify-between gap-2">
                <span>{o.typeName}: {o.options.length} option{o.options.length === 1 ? "" : "s"}</span>
                <Link href={`/admin/vehicle-config/form-fields?type=${o.typeSlug}`} className="font-semibold text-trader hover:underline">Manage →</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
