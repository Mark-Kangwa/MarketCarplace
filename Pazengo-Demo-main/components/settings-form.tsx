"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingDef } from "@/lib/validators";

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Sold visibility", keys: ["soldGraceDays"] },
  { title: "Homepage", keys: ["featuredTake", "landingTake"] },
  { title: "Uploads", keys: ["maxPhotos"] },
  { title: "Fair use", keys: ["freeLiveLimit", "maxSavedSearches"] }
];

export default function SettingsForm({ defs, initial }: { defs: SettingDef[]; initial: Record<string, number> }): JSX.Element {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(defs.map((d) => [d.key, String(initial[d.key] ?? d.fallback)]))
  );
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const byKey = new Map(defs.map((d) => [d.key, d]));

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setOk("");
    try {
      const payload: Record<string, number> = {};
      for (const d of defs) {
        const n = Number((values[d.key] ?? "").trim());
        if (!Number.isInteger(n)) {
          setMsg(`“${d.label}” must be a whole number.`);
          return;
        }
        payload[d.key] = n;
      }
      const r = await fetch("/api/admin/settings", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j.error ?? "Could not save settings.");
        return;
      }
      setOk("Settings saved — they apply immediately.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {msg ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{msg}</p> : null}
      {ok ? <p role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}
      {GROUPS.map((g) => (
        <section key={g.title} className="rounded border border-line bg-white p-4">
          <h2 className="font-semibold">{g.title}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.keys.map((k) => {
              const d = byKey.get(k);
              if (!d) return null;
              return (
                <label key={k} className="grid gap-1 text-sm">
                  <span className="font-medium">{d.label} <span className="font-normal text-gray-500">({d.min}–{d.max})</span></span>
                  <input
                    value={values[d.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    inputMode="numeric"
                    className="max-w-40 rounded border border-line px-2 py-1.5"
                  />
                  <span className="text-xs text-gray-500">{d.hint}</span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
      <div>
        <button disabled={busy} className="rounded bg-trader px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
