"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { avatarInitial } from "@/lib/avatar";

export default function AccountMenu({ name, email, avatarUrl, isAdmin }: { name: string; email: string; avatarUrl: string; isAdmin: boolean }): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  async function signOut(): Promise<void> {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setBusy(false);
    setPinned(false);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    if (!pinned) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setPinned(false);
    }
    function onDown(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPinned(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [pinned]);

  return (
    <span ref={rootRef} className="group relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={pinned}
        aria-label={`Account: ${name}. Activate to show account options.`}
        title={`Signed in as ${name}`}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white font-bold text-asphalt focus-visible:outline-2 focus-visible:outline-white"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-sm tracking-wide">
            {avatarInitial(name)}
          </span>
        )}
      </button>
      <span
        role="menu"
        aria-label="Account options"
        className={`${pinned ? "block" : "hidden"} absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-white text-asphalt shadow-lg group-hover:block`}
      >
        <span className="block border-b border-line px-4 py-3">
          <span className="block truncate text-sm font-bold">{name}</span>
          <span className="block truncate text-xs text-gray-500">{email}</span>
        </span>
        <Link href="/favourites" role="menuitem" onClick={() => setPinned(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-lot">
          <span aria-hidden="true">♥ </span>Favourites
        </Link>
        <Link href="/recent-activity" role="menuitem" onClick={() => setPinned(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-lot">
          <span aria-hidden="true">◷ </span>Recent activity
        </Link>
        <Link href="/alerts" role="menuitem" onClick={() => setPinned(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-lot">
          <span aria-hidden="true">🔔 </span>Alerts
        </Link>
        <Link href="/enquiries" role="menuitem" onClick={() => setPinned(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-lot">
          <span aria-hidden="true">✉ </span>Enquiries
        </Link>
        <Link href="/my-cars" role="menuitem" onClick={() => setPinned(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-lot">
          <span aria-hidden="true">🚗 </span>My cars
        </Link>
        <Link href="/profile" role="menuitem" onClick={() => setPinned(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-lot">
          Profile
        </Link>
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={signOut}
          className="block w-full px-4 py-2.5 text-left text-sm font-semibold hover:bg-lot disabled:opacity-60"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </span>
      {isAdmin ? (
        <Link href="/admin" aria-label="Admin console" title="Admin console" className="rounded px-2 py-1.5 text-xs text-white/60 hover:text-white">
          Admin
        </Link>
      ) : null}
    </span>
  );
}
