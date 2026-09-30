"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm(): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") })
    });
    setBusy(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else setError("That email or password did not match. Check caps lock and try again.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Work email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="admin@carmarketplace.co.za" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="w-full rounded border border-line px-3 py-2 text-sm" />
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <button disabled={busy} className="w-full rounded bg-trader px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in to admin"}
      </button>
    </form>
  );
}
