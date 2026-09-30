"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton({ className }: { className: string }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut(): Promise<void> {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setBusy(false);
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={signOut} className={className}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
