"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps server-rendered pages fresh without manual reloads: revalidates on
 * window focus / tab-visible, plus a lightweight interval that only fires
 * while the tab is visible. Set intervalMs={0} to disable polling.
 */
export default function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }): null {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function refreshIfVisible(): void {
      if (document.visibilityState === "visible") router.refresh();
    }
    function onFocus(): void {
      router.refresh();
    }
    function onVisibility(): void {
      refreshIfVisible();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    if (intervalMs > 0) {
      timer.current = setInterval(refreshIfVisible, intervalMs);
    }
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearInterval(timer.current);
    };
  }, [router, intervalMs]);

  return null;
}
