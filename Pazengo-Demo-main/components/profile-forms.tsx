"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function Row({
  label,
  display,
  actionLabel,
  editing,
  onToggle,
  children
}: {
  label: string;
  display: string;
  actionLabel: string;
  editing: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border-b border-line/60 px-4 py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="truncate text-sm font-semibold">{display}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 rounded border border-line px-3 py-1.5 text-xs font-semibold hover:bg-lot"
        >
          {editing ? "Cancel" : actionLabel}
        </button>
      </div>
      {editing && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function usePatch() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function patch(body: Record<string, unknown>, onOk: () => void): Promise<void> {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not save. Please try again.");
        return;
      }
      setSaved(true);
      onOk();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, saved, setError, patch };
}

export function NameRow({ initial }: { initial: string }): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const { busy, error, patch } = usePatch();

  return (
    <Row label="Name" display={value || "—"} actionLabel="Edit" editing={editing} onToggle={() => setEditing((v) => !v)}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void patch({ name: value }, () => setEditing(false));
        }}
      >
        <input
          type="text"
          value={value}
          required
          minLength={2}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Full name"
          className="flex-1 rounded border border-line px-3 py-2 text-sm"
        />
        <button disabled={busy} className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {error ? <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
    </Row>
  );
}

export function PhoneRow({ initial }: { initial: string }): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const { busy, error, patch } = usePatch();

  return (
    <Row
      label="Mobile number"
      display={value || "Not provided"}
      actionLabel={value ? "Edit" : "Add"}
      editing={editing}
      onToggle={() => setEditing((v) => !v)}
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void patch({ phone: value }, () => setEditing(false));
        }}
      >
        <input
          type="tel"
          value={value}
          maxLength={20}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 097 123 4567"
          aria-label="Mobile number"
          className="flex-1 rounded border border-line px-3 py-2 text-sm"
        />
        <button disabled={busy} className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {error ? <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
    </Row>
  );
}

export function PasswordRow(): JSX.Element {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords do not match. Please re-enter them.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not change your password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row label="Password" display="••••••" actionLabel="Edit" editing={editing} onToggle={() => setEditing((v) => !v)}>
      <form onSubmit={onSubmit} className="space-y-2">
        <input type="password" value={current} required onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" aria-label="Current password" autoComplete="current-password" className="w-full rounded border border-line px-3 py-2 text-sm" />
        <input type="password" value={next} required minLength={8} onChange={(e) => setNext(e.target.value)} placeholder="New password (at least 8 characters)" aria-label="New password" autoComplete="new-password" className="w-full rounded border border-line px-3 py-2 text-sm" />
        <input type="password" value={confirm} required onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" aria-label="Confirm new password" autoComplete="new-password" className="w-full rounded border border-line px-3 py-2 text-sm" />
        {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
        {saved ? <p role="status" className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-800">Password updated.</p> : null}
        <button disabled={busy} className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </Row>
  );
}

export function DeleteAccountRow(): JSX.Element {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!confirm("Delete your account permanently? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not delete your account.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <p className="text-sm font-bold text-red-800">Delete account</p>
      <p className="mt-1 text-xs text-gray-600">Permanently removes your account and sign-in. Your listings stay published but are detached from you.</p>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="mt-3 rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">
          Delete my account…
        </button>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <input
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to confirm"
            aria-label="Confirm password to delete account"
            autoComplete="current-password"
            className="flex-1 rounded border border-line px-3 py-2 text-sm"
          />
          <button disabled={busy} className="rounded bg-signal px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Deleting…" : "Confirm delete"}
          </button>
        </form>
      )}
      {error ? <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
    </div>
  );
}
