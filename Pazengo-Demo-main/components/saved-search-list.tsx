"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SERVICE_HISTORY_OPTIONS, displayOption } from "@/lib/validators";
import { SORT_OPTIONS } from "@/lib/search";

export type SavedRow = {
  id: string;
  name: string;
  params: string;
  emailAlerts: boolean;
  matchCount: number;
  newCount: number;
  updatedAt: string;
  createdAt: string;
};

const CRITERION_LABELS: Record<string, string> = {
  q: "Keywords",
  make: "Make",
  model: "Model",
  body: "Body type",
  condition: "Condition",
  gearbox: "Gearbox",
  fuel: "Fuel",
  location: "Location",
  province: "Province",
  serviceHistory: "Service history",
  drivetrain: "Drivetrain",
  color: "Colour",
  minSeats: "Seats",
  minPrice: "Min price",
  maxPrice: "Max price",
  minYear: "Min year",
  maxYear: "Max year",
  maxMileage: "Max mileage",
  sort: "Sort"
};

function prettyValue(key: string, value: string): string {
  if (key === "serviceHistory") {
    return SERVICE_HISTORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }
  if (key === "gearbox") return displayOption("transmission", value);
  if (key === "fuel") return displayOption("fuel", value);
  if (key === "condition") return displayOption("condition", value);
  if (key === "sort") {
    return SORT_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }
  if (key === "minSeats") return `${value}+ seats`;
  if (key === "minPrice" || key === "maxPrice") {
    const n = Number(value.replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? `K ${n.toLocaleString("en-ZA")}` : value;
  }
  if (key === "maxMileage") {
    const n = Number(value.replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? `Under ${n.toLocaleString("en-ZA")} km` : value;
  }
  if (key === "province") return `${value} Province`;
  return value;
}

/** Human-readable criteria from a stored query string; unknown keys shown raw, never dropped. Exported for testing. */
export function describeParams(params: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  try {
    const sp = new URLSearchParams(params.startsWith("?") ? params : `?${params}`);
    sp.forEach((value, key) => {
      if (key === "page" || value === "") return;
      // Custom-field filters (`cf_engine_size`) get a readable label.
      const label = key.startsWith("cf_")
        ? key.slice(3).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
        : (CRITERION_LABELS[key] ?? key);
      out.push({ label, value: prettyValue(key, value) });
    });
  } catch {
    /* malformed params: fall through to empty list */
  }
  return out;
}

function viewResults(id: string, href: string): void {
  fetch(`/api/saved-searches/${id}/viewed`, { method: "POST", keepalive: true }).catch(() => undefined);
  window.location.href = href;
}

function Row({ row, onChanged }: { row: SavedRow; onChanged: () => void }): JSX.Element {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [name, setName] = useState(row.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const href = `/${row.params}#listings`;
  const criteria = describeParams(row.params);
  const savedOn = (() => {
    const d = new Date(row.createdAt);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
      : "";
  })();

  async function rename(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === row.name) {
      setRenaming(false);
      setName(row.name);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/saved-searches/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not rename.");
        return;
      }
      setRenaming(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEmail(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/saved-searches/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAlerts: !row.emailAlerts })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not update.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!confirm(`Delete the saved search "${row.name}"?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/saved-searches/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not delete.");
        return;
      }
      onChanged();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {renaming ? (
            <form onSubmit={rename} className="flex gap-2">
              <input
                type="text"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                aria-label="Saved search name"
                className="rounded border border-line px-3 py-1.5 text-sm font-bold"
              />
              <button disabled={busy} className="rounded bg-asphalt px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                Save
              </button>
            </form>
          ) : (
            <p className="truncate text-sm font-bold" title={row.name}>
              {row.name}
              {row.newCount > 0 ? (
                <span className="ml-2 rounded-full bg-signal px-2 py-0.5 text-xs font-bold text-white">
                  {row.newCount} NEW
                </span>
              ) : null}
            </p>
          )}
          <p className="mt-0.5 text-xs text-gray-500">
            {row.matchCount} match{row.matchCount === 1 ? "" : "es"}
            {savedOn ? ` · Saved on ${savedOn}` : ""}
          </p>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="mt-1 text-xs font-semibold text-trader hover:underline"
          >
            {detailsOpen ? "Hide details ▴" : "View details ▸"}
          </button>
        </div>
        <span className="flex gap-2">
          <button type="button" onClick={() => { setRenaming((v) => !v); setName(row.name); setError(""); }} className="rounded border border-line px-3 py-1.5 text-xs font-semibold hover:bg-lot">
            {renaming ? "Cancel" : "Rename"}
          </button>
          <button type="button" disabled={busy} onClick={remove} className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60">
            Delete
          </button>
        </span>
      </div>
      {error ? <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
      {detailsOpen ? (
        <div className="mt-3 rounded-lg bg-lot/60 p-3">
          <p className="text-xs font-bold text-gray-600">Search details</p>
          {criteria.length === 0 ? (
            <p className="mt-1 text-xs text-gray-600">All cars — no filters set.</p>
          ) : (
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {criteria.map((c) => (
                <div key={`${c.label}-${c.value}`} className="flex gap-2 text-xs">
                  <dt className="shrink-0 text-gray-500">{c.label}:</dt>
                  <dd className="font-semibold">{c.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={row.emailAlerts} disabled={busy} onChange={toggleEmail} className="h-4 w-4 accent-trader" />
          <span>
            Notify me by email
            <span className="block text-[11px] text-gray-400">Email delivery launching soon — new matches show here meanwhile.</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => viewResults(row.id, href)}
          className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          View results →
        </button>
      </div>
    </li>
  );
}

export default function SavedSearchList({ initial }: { initial: SavedRow[] }): JSX.Element {
  const [rows, setRows] = useState(initial);

  async function reload(): Promise<void> {
    try {
      const res = await fetch("/api/saved-searches", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.searches)) setRows(json.searches);
    } catch {
      /* keep stale rows on failure */
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
        <p className="font-semibold text-asphalt">No saved searches yet.</p>
        <p className="mt-1">Run a search, then tap “Save search” to get back to it anytime and spot new matches first.</p>
        <Link href="/#listings" className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Browse cars</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <Row key={r.id} row={r} onChanged={() => void reload()} />
      ))}
    </ul>
  );
}
