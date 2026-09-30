"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { slugifyName } from "@/lib/validators";

export default function ArticleForm({ id, initial }: {
  id?: string;
  initial?: { title: string; kind: string; excerpt: string; coverUrl: string; body: string; status: string };
}): JSX.Element {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "NEWS");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onCover(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", files[0]);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Cover upload failed. Use JPG, PNG or WebP under 5MB.");
        return;
      }
      const urls = Array.isArray(json.urls) ? (json.urls as string[]) : [];
      if (urls[0]) setCoverUrl(urls[0]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(id ? `/api/admin/articles/${id}` : "/api/admin/articles", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind, excerpt: excerpt.trim(), coverUrl: coverUrl.trim(), body: body.trim(), status })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save article.");
        return;
      }
      router.push("/admin/news");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!id) return;
    if (!window.confirm(`Delete “${title || "this article"}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not delete article.");
        return;
      }
      router.push("/admin/news");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium">Title *</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={120} placeholder="e.g. 2025 Toyota Hilux review: still the one to beat" className="w-full rounded border border-line px-3 py-2 text-sm" />
          {title.trim() ? <p className="mt-1 text-xs text-gray-500">Link: /news/{slugifyName(title.trim())}</p> : null}
        </div>
        <div>
          <label htmlFor="kind" className="mb-1 block text-sm font-medium">Type</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="NEWS">News</option>
            <option value="REVIEW">Review</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="excerpt" className="mb-1 block text-sm font-medium">Excerpt</label>
          <input id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={300} placeholder="One-line summary for cards and search results" className="w-full rounded border border-line px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label htmlFor="cover" className="mb-1 block text-sm font-medium">Cover image (optional)</label>
        <input ref={fileRef} id="cover" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => onCover(e.target.files)} className="block w-full text-sm file:mr-3 file:rounded file:border file:border-line file:bg-lot file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-line disabled:opacity-50" />
        {uploading ? <p role="status" className="mt-1 text-xs text-gray-500">Uploading…</p> : null}
        {coverUrl ? (
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="Cover preview" className="h-20 w-32 rounded border border-line object-cover" />
            <button type="button" onClick={() => setCoverUrl("")} className="rounded border border-line px-2 py-1 text-xs hover:bg-lot">Remove</button>
          </div>
        ) : null}
      </div>
      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium">Body *</label>
        <p className="mb-2 text-xs text-gray-500">Plain text — blank lines separate paragraphs.</p>
        <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={12} placeholder="Write the article…" className="w-full rounded border border-line px-3 py-2 text-sm" />
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy || uploading} className="rounded bg-signal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving…" : id ? "Save changes" : "Add article"}</button>
        <a href="/admin/news" className="rounded border border-line px-5 py-2.5 text-sm">Cancel</a>
        {id ? (
          <button type="button" onClick={remove} disabled={busy} className="ml-auto rounded border border-red-200 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">Delete</button>
        ) : null}
      </div>
    </form>
  );
}
