"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LINKED_KIND_COMPAT, displayOption, hasOptionsKind, isCanonicalOptionCode, isCoreBinding, isStrictOptionBinding, parseDisplayOption } from "@/lib/validators";

type Kind = "TEXT" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "BOOLEAN" | "DATE" | "LONG_TEXT";
type VType = { id: string; name: string; slug: string };
type Assigned = {
  fieldId: string; key: string; label: string; kind: Kind; options: string[];
  baseOptions: string[]; optionsOverridden: boolean; dynamic: boolean;
  unit: string | null; minValue: number | null; maxValue: number | null;
  help: string | null; binding: string | null; required: boolean; position: number;
};
type LibField = { id: string; key: string; label: string; kind: Kind; options: string[]; binding: string | null; assigned: boolean };

const KINDS: { value: Kind; label: string }[] = [
  { value: "TEXT", label: "Short text" },
  { value: "LONG_TEXT", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "SELECT", label: "Dropdown" },
  { value: "MULTI_SELECT", label: "Checkboxes (tick several)" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "DATE", label: "Date" }
];

function splitOptions(raw: string): string[] {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

function allowedCodes(a: { baseOptions: string[]; options: string[] }): string[] {
  const out: string[] = [];
  for (const o of [...a.baseOptions, ...a.options]) {
    if (!out.includes(o)) out.push(o);
  }
  return out;
}

/**
 * Turns admin-typed option lines back into stored codes. Returns the
 * offending line when one maps to nothing (strict bindings only — free
 * columns pass new values through inside parseDisplayOption).
 */
function toCodes(a: Assigned, lines: string[]): { codes: string[]; bad: string } {
  const key = a.binding ?? a.key;
  const codes: string[] = [];
  for (const line of lines) {
    const code = parseDisplayOption(key, line);
    if (isStrictOptionBinding(key) && !isCanonicalOptionCode(key, code)) return { codes: [], bad: line };
    if (!codes.includes(code)) codes.push(code);
  }
  return { codes, bad: "" };
}

function labelList(a: Assigned): string {
  return allowedCodes(a).map((o) => displayOption(a.binding ?? a.key, o)).join(", ");
}

export default function VehicleFieldManager(props: {
  types: VType[]; selectedId: string; selectedName: string; assigned: Assigned[]; library: LibField[];
}): JSX.Element {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickId, setPickId] = useState("");
  const [pickRequired, setPickRequired] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Assigned | null>(null);

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Kind>("TEXT");
  const [optionsRaw, setOptionsRaw] = useState("");
  const [unit, setUnit] = useState("");
  const [minRaw, setMinRaw] = useState("");
  const [maxRaw, setMaxRaw] = useState("");
  const [help, setHelp] = useState("");
  const [newRequired, setNewRequired] = useState(false);

  const [editLabel, setEditLabel] = useState("");
  const [editKind, setEditKind] = useState<Kind>("TEXT");
  const [editOptionsRaw, setEditOptionsRaw] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editMinRaw, setEditMinRaw] = useState("");
  const [editMaxRaw, setEditMaxRaw] = useState("");
  const [editHelp, setEditHelp] = useState("");
  const [overrideFor, setOverrideFor] = useState<Assigned | null>(null);
  const [overrideRaw, setOverrideRaw] = useState("");

  function openOverride(a: Assigned): void {
    setOverrideFor(a);
    const list = a.optionsOverridden ? a.options : a.baseOptions;
    setOverrideRaw(list.map((o) => displayOption(a.binding ?? a.key, o)).join("\n"));
    setMsg("");
  }

  async function saveOverride(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!overrideFor) return;
    const lines = splitOptions(overrideRaw);
    if (lines.length === 0) {
      setMsg("Override needs at least one option — remove it instead to inherit the shared list.");
      return;
    }
    const { codes, bad } = toCodes(overrideFor, lines);
    if (bad) {
      setMsg(`“${bad}” is not a valid option for ${overrideFor.label}. Use one of: ${labelList(overrideFor)}.`);
      return;
    }
    if (await call(`/api/admin/vehicle-types/${props.selectedId}/fields/${overrideFor.fieldId}`, "PATCH", { options: codes })) {
      setOverrideFor(null);
    }
  }

  async function resetOverride(a: Assigned): Promise<void> {
    await call(`/api/admin/vehicle-types/${props.selectedId}/fields/${a.fieldId}`, "PATCH", { options: null });
    setOverrideFor(null);
  }

  function openEdit(a: Assigned): void {
    setEditing(a);
    setEditLabel(a.label);
    setEditKind(a.kind);
    // Linked option lists are shown as labels; translated back on save.
    setEditOptionsRaw(a.options.map((o) => displayOption(a.binding ?? a.key, o)).join("\n"));
    setEditUnit(a.unit ?? "");
    setEditMinRaw(a.minValue != null ? String(a.minValue) : "");
    setEditMaxRaw(a.maxValue != null ? String(a.maxValue) : "");
    setEditHelp(a.help ?? "");
    setMsg("");
  }

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
      // The data already saved server-side: never let a refresh failure trap
      // an open dialog — worst case the list updates on next navigation.
      try {
        router.refresh();
      } catch {
        /* dialogs still close; see note above */
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function assign(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!pickId) { setMsg("Choose a field from the library first."); return; }
    if (await call(`/api/admin/vehicle-types/${props.selectedId}/fields`, "POST", { fieldId: pickId, required: pickRequired })) {
      setPickId("");
      setPickRequired(false);
    }
  }

  async function toggleRequired(a: Assigned, required: boolean): Promise<void> {
    await call(`/api/admin/vehicle-types/${props.selectedId}/fields/${a.fieldId}`, "PATCH", { required });
  }

  async function unassign(a: Assigned): Promise<void> {
    if (!window.confirm(`Remove “${a.label}” from ${props.selectedName}? Existing listing values are kept.`)) return;
    await call(`/api/admin/vehicle-types/${props.selectedId}/fields/${a.fieldId}`, "DELETE");
  }

  async function createCustom(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const ok = await call("/api/admin/vehicle-fields", "POST", {
      label,
      kind,
      options: hasOptionsKind(kind) ? splitOptions(optionsRaw) : [],
      unit: unit || undefined,
      minValue: minRaw === "" ? undefined : Number(minRaw),
      maxValue: maxRaw === "" ? undefined : Number(maxRaw),
      help: help || undefined,
      assignTo: props.selectedId,
      required: newRequired
    });
    if (ok) {
      setLabel(""); setKind("TEXT"); setOptionsRaw(""); setUnit("");
      setMinRaw(""); setMaxRaw(""); setHelp(""); setNewRequired(false);
      setShowNew(false);
    }
  }

  async function saveEdit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!editing) return;
    const core = isCoreBinding(editing.binding);
    const kindChanged = !core && editKind !== editing.kind;
    const body: Record<string, unknown> = { label: editLabel, help: editHelp || "" };
    if (kindChanged) {
      if (hasOptionsKind(editing.kind) && !window.confirm(`Switch “${editing.label}” from ${KINDS.find((k) => k.value === editing.kind)?.label} to ${KINDS.find((k) => k.value === editKind)?.label}? Per-type option lists will be cleared; saved values are kept.`)) return;
      body.kind = editKind;
    }
    // Options are editable on unlinked fields, plus the one-time seeding when
    // a linked field switches to an option kind (linked lists otherwise stay shared).
    const resultKind = kindChanged ? editKind : editing.kind;
    const editableOptions = !editing.binding || (hasOptionsKind(resultKind) && !hasOptionsKind(editing.kind));
    if (editableOptions && hasOptionsKind(resultKind)) {
      const lines = splitOptions(editOptionsRaw);
      if (!editing.binding) {
        body.options = lines;
      } else {
        const { codes, bad } = toCodes(editing, lines);
        if (bad) {
          setMsg(`“${bad}” is not a valid option for ${editing.label}. Use one of: ${labelList(editing)}.`);
          return;
        }
        body.options = codes;
      }
    }
    if (!editing.binding) {
      body.unit = editUnit || "";
      body.minValue = editMinRaw === "" ? null : Number(editMinRaw);
      body.maxValue = editMaxRaw === "" ? null : Number(editMaxRaw);
    }
    if (await call(`/api/admin/vehicle-fields/${editing.fieldId}`, "PATCH", body)) setEditing(null);
  }

  async function deleteCustom(a: Assigned): Promise<void> {
    if (isCoreBinding(a.binding)) return;
    const linkedWarning = a.binding
      ? ` It syncs to listings — saved values stay on listings and in search, but new listings will no longer ask for it.`
      : "";
    if (!window.confirm(`Delete “${a.label}” from the library and all types? This cannot be undone.${linkedWarning}`)) return;
    if (await call(`/api/admin/vehicle-fields/${a.fieldId}`, "DELETE")) setEditing(null);
  }

  const unassigned = props.library.filter((f) => !props.assigned.some((a) => a.fieldId === f.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vehicle type">
        {props.types.map((t) => (
          <Link
            key={t.id}
            href={`/admin/vehicle-config/form-fields?type=${t.slug}`}
            role="tab"
            aria-selected={t.id === props.selectedId}
            className={`rounded-full border px-4 py-1.5 text-sm ${t.id === props.selectedId ? "border-trader bg-trader font-semibold text-white" : "border-line bg-white hover:bg-lot"}`}
          >
            {t.name}
          </Link>
        ))}
      </div>
      {msg ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}

      <section className="rounded border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-semibold">Fields on {props.selectedName} ({props.assigned.length})</h2>
        </div>
        <ul className="divide-y">
          {props.assigned.map((a) => (
            <li key={a.fieldId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.label}
                  {isCoreBinding(a.binding)
                    ? <span className="ml-2 rounded bg-asphalt px-1.5 py-0.5 text-[11px] font-semibold text-white">CORE</span>
                    : <span className="ml-2 rounded bg-lot px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">CUSTOM</span>}
                  {a.binding && !isCoreBinding(a.binding) ? <span className="ml-1 text-[11px] text-gray-500">· linked</span> : null}
                  {a.required ? <span className="ml-1 text-xs text-red-600">*</span> : null}
                </p>
                <p className="text-xs text-gray-500">{KINDS.find((k) => k.value === a.kind)?.label}{hasOptionsKind(a.kind) && a.options.length ? ` · ${a.options.length} options` : ""}{a.optionsOverridden ? " · this-type options" : ""}{a.dynamic ? " · live options" : ""}{a.unit ? ` · ${a.unit}` : ""}{a.help ? ` · ${a.help}` : ""}</p>
              </div>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={a.required} disabled={busy} onChange={(e) => toggleRequired(a, e.target.checked)} />
                Required
              </label>
              {hasOptionsKind(a.kind) ? (
                <button onClick={() => openOverride(a)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Options</button>
              ) : null}
              <button onClick={() => openEdit(a)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Edit</button>
              <button onClick={() => unassign(a)} disabled={busy} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">Remove</button>
            </li>
          ))}
          {props.assigned.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No fields assigned yet — add one from the library below.</li> : null}
        </ul>
      </section>

      <section className="rounded border border-line bg-white p-4">
        <h2 className="font-semibold">Add from library</h2>
        <form onSubmit={assign} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Library field</span>
            <select value={pickId} onChange={(e) => setPickId(e.target.value)} className="w-64 rounded border border-line px-2 py-1.5">
              <option value="">Choose…</option>
              {unassigned.map((f) => (
                <option key={f.id} value={f.id}>{f.label} ({KINDS.find((k) => k.value === f.kind)?.label}{f.binding ? (isCoreBinding(f.binding) ? ", core" : ", custom linked") : ", custom"})</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="checkbox" checked={pickRequired} onChange={(e) => setPickRequired(e.target.checked)} />
            Required
          </label>
          <button disabled={busy} className="rounded bg-trader px-4 py-1.5 text-sm font-semibold text-white">Assign to {props.selectedName}</button>
        </form>
      </section>

      <section className="rounded border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">New custom field</h2>
          <button onClick={() => setShowNew((v) => !v)} className="rounded border border-line px-3 py-1.5 text-sm hover:bg-lot">{showNew ? "Hide" : "Create"}</button>
        </div>
        {showNew ? (
          <form onSubmit={createCustom} className="mt-3 grid max-w-2xl gap-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="font-medium">Label *</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Engine size (cc)" className="rounded border border-line px-2 py-1.5" />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">Type</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="rounded border border-line px-2 py-1.5">
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </label>
            </div>
            {hasOptionsKind(kind) ? (
              <label className="grid gap-1">
                <span className="font-medium">Options (one per line) *</span>
                <textarea value={optionsRaw} onChange={(e) => setOptionsRaw(e.target.value)} rows={3} placeholder={"Sport\nCruiser\nOff-road"} className="rounded border border-line px-2 py-1.5" />
              </label>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1">
                <span className="font-medium">Unit</span>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. cc" className="rounded border border-line px-2 py-1.5" />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">Min</span>
                <input value={minRaw} onChange={(e) => setMinRaw(e.target.value)} inputMode="decimal" placeholder="optional" className="rounded border border-line px-2 py-1.5" />
              </label>
              <label className="grid gap-1">
                <span className="font-medium">Max</span>
                <input value={maxRaw} onChange={(e) => setMaxRaw(e.target.value)} inputMode="decimal" placeholder="optional" className="rounded border border-line px-2 py-1.5" />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="font-medium">Help text</span>
              <input value={help} onChange={(e) => setHelp(e.target.value)} placeholder="Shown under the field in the form" className="rounded border border-line px-2 py-1.5" />
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
              Required on {props.selectedName}
            </label>
            <div>
              <button disabled={busy} className="rounded bg-trader px-4 py-1.5 font-semibold text-white">Create and assign</button>
            </div>
          </form>
        ) : null}
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Edit ${editing.label}`}>
          <form onSubmit={saveEdit} className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded bg-white p-4 text-sm">
            <h2 className="font-semibold">Edit “{editing.label}” {isCoreBinding(editing.binding) ? "(core field)" : editing.binding ? "(custom, linked)" : "(custom)"}</h2>
            <label className="grid gap-1">
              <span className="font-medium">Label</span>
              <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="rounded border border-line px-2 py-1.5" />
            </label>
            {isCoreBinding(editing.binding) ? (
              <p className="text-xs text-gray-500">Core fields are universal — their type, options and limits are locked.</p>
            ) : (
              <label className="grid gap-1">
                <span className="font-medium">Field type</span>
                <select value={editKind} onChange={(e) => setEditKind(e.target.value as Kind)} className="rounded border border-line px-2 py-1.5">
                  {KINDS.filter((k) => !editing.binding || (LINKED_KIND_COMPAT[editing.binding] ?? []).includes(k.value)).map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </label>
            )}
            {(() => {
              const resultKind = !isCoreBinding(editing.binding) && editKind !== editing.kind ? editKind : editing.kind;
              const editableOptions = !editing.binding || (hasOptionsKind(resultKind) && !hasOptionsKind(editing.kind));
              if (!editableOptions || !hasOptionsKind(resultKind)) return null;
              return (
                <label className="grid gap-1">
                  <span className="font-medium">Options (one per line){editing.binding ? " — seeds the shared list" : ""}</span>
                  <textarea value={editOptionsRaw} onChange={(e) => setEditOptionsRaw(e.target.value)} rows={4} className="rounded border border-line px-2 py-1.5" />
                </label>
              );
            })()}
            {!editing.binding ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1">
                  <span className="font-medium">Unit</span>
                  <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="rounded border border-line px-2 py-1.5" />
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Min</span>
                  <input value={editMinRaw} onChange={(e) => setEditMinRaw(e.target.value)} inputMode="decimal" className="rounded border border-line px-2 py-1.5" />
                </label>
                <label className="grid gap-1">
                  <span className="font-medium">Max</span>
                  <input value={editMaxRaw} onChange={(e) => setEditMaxRaw(e.target.value)} inputMode="decimal" className="rounded border border-line px-2 py-1.5" />
                </label>
              </div>
            ) : !isCoreBinding(editing.binding) ? (
              <p className="text-xs text-gray-500">Linked fields keep their shared list, units and limits — use the Options button on an assigned row to give {props.selectedName} its own list.</p>
            ) : null}
            <label className="grid gap-1">
              <span className="font-medium">Help text</span>
              <input value={editHelp} onChange={(e) => setEditHelp(e.target.value)} className="rounded border border-line px-2 py-1.5" />
            </label>
            <div className="flex items-center justify-between gap-2">
              {!isCoreBinding(editing.binding) ? (
                <button type="button" onClick={() => deleteCustom(editing)} disabled={busy} className="rounded border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50">Delete</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded border border-line px-3 py-1.5">Cancel</button>
                <button disabled={busy} className="rounded bg-trader px-3 py-1.5 font-semibold text-white">Save</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
      {overrideFor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Options for ${overrideFor.label} on ${props.selectedName}`}>
          <form onSubmit={saveOverride} className="w-full max-w-md space-y-3 rounded bg-white p-4 text-sm">
            <h2 className="font-semibold">Options for “{overrideFor.label}” on {props.selectedName}</h2>
            <p className="text-xs text-gray-500">
              Shared list ({overrideFor.baseOptions.length}): {overrideFor.baseOptions.map((o) => displayOption(overrideFor.binding ?? overrideFor.key, o)).join(", ") || "—"}.
              {overrideFor.optionsOverridden ? " This type currently uses its own list below." : " Saving replaces it for this type only — one per line, using the same words as above."}
              {" "}Prefer a searchable table? <Link href={`/admin/vehicle-config/form-fields/options/${overrideFor.key}`} className="font-semibold text-trader hover:underline">Manage options →</Link>
            </p>
            <label className="grid gap-1">
              <span className="font-medium">This type’s options (one per line)</span>
              <textarea value={overrideRaw} onChange={(e) => setOverrideRaw(e.target.value)} rows={5} className="rounded border border-line px-2 py-1.5" />
            </label>
            <div className="flex items-center justify-between gap-2">
              {overrideFor.optionsOverridden ? (
                <button type="button" onClick={() => resetOverride(overrideFor)} disabled={busy} className="rounded border border-line px-3 py-1.5 hover:bg-lot">Reset to library</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setOverrideFor(null)} className="rounded border border-line px-3 py-1.5">Cancel</button>
                <button disabled={busy} className="rounded bg-trader px-3 py-1.5 font-semibold text-white">Save</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
