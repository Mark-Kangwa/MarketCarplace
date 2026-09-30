"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Preview = { ok: number; bad: { line: number; error: string }[]; errors: string[] };

export default function ImportForm(): JSX.Element {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const res = await fetch("/api/admin/cars/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, dryRun: true })
    });
    setPreview(await res.json());
  }

  async function onConfirm(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    const f = input?.files?.[0];
    if (!f) return;
    setBusy(true);
    const text = await f.text();
    const res = await fetch("/api/admin/cars/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, dryRun: false })
    });
    const json = await res.json();
    setBusy(false);
    setResult(`Imported ${json.imported ?? 0} cars. ${json.failed ?? 0} failed.`);
    if ((json.imported ?? 0) > 0) {
      router.push("/admin/inventory/pending-review");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <input type="file" accept=".csv" onChange={onFile} aria-label="Choose CSV file" className="block text-sm" />
      {preview ? (
        <div className="rounded border border-line bg-lot p-3 text-sm">
          <p><strong>{preview.ok}</strong> rows look valid.</p>
          {preview.errors.map((er) => <p key={er} className="text-amber-800">{er}</p>)}
          {preview.bad.slice(0, 5).map((b) => <p key={b.line} className="text-red-700">Line {b.line}: {b.error}</p>)}
        </div>
      ) : null}
      <form onSubmit={onConfirm}>
        <button disabled={busy || !preview || preview.ok === 0} className="rounded bg-asphalt px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "Importing…" : "Confirm import as drafts"}
        </button>
      </form>
      {result ? <p role="status" className="text-sm font-semibold">{result}</p> : null}
    </div>
  );
}
