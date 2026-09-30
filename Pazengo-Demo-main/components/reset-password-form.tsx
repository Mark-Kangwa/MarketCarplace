"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ResetPasswordForm(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"checking" | "ready" | "bad" | "done">("checking");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("bad");
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`, { credentials: "same-origin" })
      .then((r) => r.json().catch(() => ({})))
      .then((j) => {
        if (j.ok) {
          setName(typeof j.name === "string" ? j.name : "");
          setState("ready");
        } else {
          setState("bad");
        }
      })
      .catch(() => setState("bad"));
  }, [token]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match. Please re-enter them.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not reset your password.");
        if (res.status === 404) setState("bad");
        return;
      }
      setState("done");
      setTimeout(() => router.push("/login"), 2500);
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return <p role="status" className="text-sm text-gray-600">Checking your link…</p>;
  }
  if (state === "bad") {
    return (
      <div className="text-sm text-gray-600">
        <p className="font-semibold text-asphalt">That reset link is invalid or has expired.</p>
        <p className="mt-1">Links work once and last 24 hours. Ask an admin for a new one.</p>
        <Link href="/login" className="mt-3 inline-block font-semibold text-trader hover:underline">Back to sign in</Link>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="text-sm text-gray-600">
        <p className="font-semibold text-asphalt">Password updated.</p>
        <p className="mt-1">Taking you to sign in…</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-gray-600">Setting a new password{name ? <> for <span className="font-semibold">{name}</span></> : null}. This link works once.</p>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm font-medium">New password *</label>
        <input id="new-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="At least 8 characters" />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">Confirm password *</label>
        <input id="confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <button disabled={busy} className="w-full rounded bg-signal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
