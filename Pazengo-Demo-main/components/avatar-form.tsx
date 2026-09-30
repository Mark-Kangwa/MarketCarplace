"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { avatarInitial } from "@/lib/avatar";

export default function AvatarForm({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string }): JSX.Element {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function onPick(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const file = files[0];
    setError("");
    setMessage("");
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  async function onUpload(): Promise<void> {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      setError("Choose a photo first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("avatar", files[0]);
      const res = await fetch("/api/account/avatar", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Upload failed. Please try again.");
        return;
      }
      setPreview(String(json.url ?? preview));
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Profile photo updated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(): Promise<void> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not remove your photo.");
        return;
      }
      setPreview("");
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Profile photo removed — showing your initial.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Profile photo of ${name}`} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-white text-3xl font-bold text-asphalt">
            {avatarInitial(name)}
          </span>
        )}
        <div>
          <p className="font-bold">{name}</p>
          <p className="text-sm text-gray-600">{email}</p>
        </div>
      </div>
      <div>
        <label htmlFor="avatar-file" className="mb-1 block text-sm font-medium">Profile photo</label>
        <p className="mb-2 text-xs text-gray-500">JPG, PNG or WebP up to 2MB. Shown in the header instead of your initial.</p>
        <input
          ref={fileRef}
          id="avatar-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => onPick(e.target.files)}
          aria-label="Choose profile photo"
          className="block w-full text-sm file:mr-3 file:rounded file:border file:border-line file:bg-lot file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-line"
        />
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      {message ? <p role="status" className="rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">{message}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={onUpload} className="rounded bg-signal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save photo"}
        </button>
        {preview ? (
          <button type="button" disabled={busy} onClick={onRemove} className="rounded border border-line px-5 py-2.5 text-sm font-semibold hover:bg-lot disabled:opacity-60">
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
