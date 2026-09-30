import Link from "next/link";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<JSX.Element> {
  const session = await getSession();
  // Logged out: no sidebar, no nav links — the login page is the only thing
  // reachable without a session (every other admin page redirects to it).
  if (!session) {
    return (
      <div className="min-h-screen">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm text-gray-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-light.png" alt="Pazengo" className="h-6 w-auto" /></Link> admin
          </p>
          <a href="/admin/login" className="rounded bg-trader px-3 py-1.5 text-sm font-semibold text-white">Sign in</a>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm text-gray-600 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-light.png" alt="Pazengo" className="h-6 w-auto" /></Link> admin
          </p>
          <nav className="flex gap-4 text-sm md:hidden" aria-label="Admin mobile">
            <a href="/admin">Dash</a><a href="/admin/inventory/published">Stock</a><a href="/admin/inventory/pending-review">Review</a><a href="/admin/users">Users</a><a href="/admin/analytics">Stats</a><a href="/admin/news">News</a><a href="/admin/vehicle-config/vehicle-types">Config</a><a href="/admin/system-settings">Settings</a>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-gray-600 sm:block">{session.email}</span>
            <form action="/api/admin/logout" method="post">
              <button className="rounded border border-line px-3 py-1.5 hover:bg-lot">Sign out</button>
            </form>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </div>
    </div>
  );
}

