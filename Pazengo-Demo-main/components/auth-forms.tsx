"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export function UserLoginForm({ next }: { next?: string }): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.push(safeNext(next));
      router.refresh();
    } else {
      setError(json.error ?? "That email or password did not match. Check caps lock and try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="you@example.co.zm" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="w-full rounded border border-line px-3 py-2 text-sm" />
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <button disabled={busy} className="w-full rounded bg-signal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirm") ?? "")) {
      setError("Passwords do not match. Please re-enter them.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone") || "",
        password
      })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.push(safeNext(next));
      router.refresh();
    } else {
      setError(json.error ?? "Could not create your account. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">Full name *</label>
        <input id="name" name="name" type="text" required minLength={2} maxLength={60} autoComplete="name" className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="e.g. Mutinta Banda" />
      </div>
      <div>
        <label htmlFor="reg-email" className="mb-1 block text-sm font-medium">Email *</label>
        <input id="reg-email" name="email" type="email" required autoComplete="username" className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="you@example.co.zm" />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="e.g. 097 123 4567" />
      </div>
      <div>
        <label htmlFor="reg-password" className="mb-1 block text-sm font-medium">Password *</label>
        <input id="reg-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="At least 8 characters" />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium">Confirm password *</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="w-full rounded border border-line px-3 py-2 text-sm" />
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <button disabled={busy} className="w-full rounded bg-signal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
