"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BlockButton } from "@/components/block-button";
import { timeAgo } from "@/lib/format";

export type AdminUserRow = {
  id: string; name: string; email: string; phone: string | null;
  role: "BUYER" | "DEALER" | "ADMIN"; status: "ACTIVE" | "BLOCKED";
  blockedReason: string | null; createdAt: string;
};

const ROLE_LABELS: Record<AdminUserRow["role"], string> = {
  BUYER: "General",
  DEALER: "Dealer",
  ADMIN: "Administrator"
};

function RoleSelect({ user }: { user: AdminUserRow }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(role: string): Promise<void> {
    if (role === user.role) return;
    if (!window.confirm(`Change ${user.name} to ${ROLE_LABELS[role as AdminUserRow["role"]]}?`)) {
      router.refresh();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Could not change role.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <select
        defaultValue={user.role}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        aria-label={`Role for ${user.name}`}
        className="rounded border border-line px-2 py-1 text-xs disabled:opacity-60"
      >
        {(Object.keys(ROLE_LABELS) as AdminUserRow["role"][]).map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      {error ? <span role="alert" className="mt-0.5 block text-xs text-red-700">{error}</span> : null}
    </span>
  );
}

function PasswordActions({ user }: { user: AdminUserRow }): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "set" | "link">("none");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function setNew(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult("");
    try {
      const r = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Could not set password.");
        return;
      }
      setPassword("");
      setMode("none");
      setResult("Password updated — takes effect immediately.");
    } finally {
      setBusy(false);
    }
  }

  async function mintLink(): Promise<void> {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const r = await fetch(`/api/admin/users/${user.id}/reset-link`, { method: "POST", credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Could not issue reset link.");
        return;
      }
      setResult(`Reset link (shown once — copy and share manually): ${j.url}`);
      setMode("none");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="block">
      <span className="flex justify-end gap-1">
        <button onClick={() => { setMode(mode === "set" ? "none" : "set"); setError(""); setResult(""); }} className="rounded border border-line px-2 py-1 text-xs hover:bg-lot">Set password</button>
        <button onClick={() => { setMode(mode === "link" ? "none" : "link"); setError(""); setResult(""); }} className="rounded border border-line px-2 py-1 text-xs hover:bg-lot">Reset link</button>
      </span>
      {mode === "set" ? (
        <form onSubmit={setNew} className="mt-1 flex justify-end gap-1">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} placeholder="Min 8 chars" aria-label={`New password for ${user.name}`} className="w-32 rounded border border-line px-2 py-1 text-xs" />
          <button disabled={busy} className="rounded bg-asphalt px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Save</button>
        </form>
      ) : null}
      {mode === "link" ? (
        <span className="mt-1 flex justify-end gap-1 text-xs">
          <span className="self-center text-gray-500">Single-use, 24h.</span>
          <button onClick={mintLink} disabled={busy} className="rounded bg-asphalt px-2 py-1 font-semibold text-white disabled:opacity-60">Issue link</button>
        </span>
      ) : null}
      {error ? <span role="alert" className="mt-0.5 block text-right text-xs text-red-700">{error}</span> : null}
      {result ? (
        <span className="mt-0.5 block break-all rounded bg-green-50 p-1.5 text-right text-xs text-green-800" role="status">
          {result.startsWith("Reset link") ? (
            <>
              Reset link (shown once — copy and share manually):<br />
              <span className="font-mono">{result.slice(result.indexOf("http"))}</span>
            </>
          ) : result}
        </span>
      ) : null}
    </span>
  );
}

function DeleteUser({ user, onDeleted }: { user: AdminUserRow; onDeleted: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(): Promise<void> {
    if (!window.confirm(`Delete ${user.name} (${user.email})? Their activity is removed with them. Blocked instead if they have cars or payments.`)) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Could not delete user.");
        return;
      }
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="block">
      <span className="flex justify-end">
        <button onClick={remove} disabled={busy} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60">Delete</button>
      </span>
      {error ? <span role="alert" className="mt-0.5 block text-right text-xs text-red-700">{error}</span> : null}
    </span>
  );
}

function CreateUser({ onCreated }: { onCreated: () => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AdminUserRow["role"]>("BUYER");
  const [result, setResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), role })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Could not create user.");
        return;
      }
      setResult({ name: j.user.name, tempPassword: j.tempPassword });
      setName("");
      setEmail("");
      setPhone("");
      setRole("BUYER");
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!open && !result ? (
        <button onClick={() => { setOpen(true); setError(""); }} className="rounded bg-signal px-3 py-2 text-sm font-bold text-white">+ New user</button>
      ) : null}
      {result ? (
        <div role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p className="font-bold">{result.name} created.</p>
          <p className="mt-1">Temporary password (shown once — copy and share it manually, e.g. WhatsApp):</p>
          <p className="mt-1 font-mono text-base font-bold tracking-wider">{result.tempPassword}</p>
          <button onClick={() => setResult(null)} className="mt-2 rounded border border-line bg-white px-3 py-1.5 text-xs font-semibold text-asphalt hover:bg-lot">Done</button>
        </div>
      ) : null}
      {open && !result ? (
        <form onSubmit={create} className="grid gap-3 rounded border border-line bg-white p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Full name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} className="rounded border border-line px-2 py-1.5" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email *</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" maxLength={120} className="rounded border border-line px-2 py-1.5" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Phone (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="rounded border border-line px-2 py-1.5" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as AdminUserRow["role"])} className="rounded border border-line px-2 py-1.5">
              <option value="BUYER">General user</option>
              <option value="DEALER">Dealer</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </label>
          {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={busy} className="rounded bg-signal px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Creating…" : "Create user"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-line px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default function UserManager({ initial }: { initial: AdminUserRow[] }): JSX.Element {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <CreateUser onCreated={() => router.refresh()} />
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line bg-lot text-xs text-gray-600">
            <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2 text-right">Access</th></tr>
          </thead>
          <tbody>
            {initial.map((u) => (
              <tr key={u.id} className="border-b border-line/60 align-top last:border-0">
                <td className="px-3 py-2"><p className="font-semibold">{u.name}</p><p className="text-xs text-gray-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}{u.blockedReason ? ` — ${u.blockedReason}` : ""}</p></td>
                <td className="px-3 py-2"><RoleSelect user={u} /></td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${u.status === "BLOCKED" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{u.status}</span></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{timeAgo(new Date(u.createdAt))}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-col items-end gap-1.5">
                    <BlockButton id={u.id} name={u.name} blocked={u.status === "BLOCKED"} />
                    <PasswordActions user={u} />
                    <DeleteUser user={u} onDeleted={() => router.refresh()} />
                  </span>
                </td>
              </tr>
            ))}
            {initial.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">No users match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
