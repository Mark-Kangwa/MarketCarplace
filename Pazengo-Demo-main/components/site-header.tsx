import Link from "next/link";
import AccountMenu from "@/components/account-menu";
import { getSession, getUserSession } from "@/lib/auth";
import { prisma, dbOk } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SiteHeader(): Promise<JSX.Element> {
  const [user, admin] = await Promise.all([getUserSession(), getSession()]);
  // Managed under System Settings → Menu pages; falls back to the seed
  // order when the table is empty or the DB is unreachable.
  let menu: { key: string; label: string; href: string | null; emphasized: boolean }[] = [
    { key: "buy", label: "Buy a car", href: "/", emphasized: false },
    { key: "sell", label: "Sell my car", href: "/sell-my-car", emphasized: true },
    { key: "value", label: "Value my car", href: null, emphasized: false },
    { key: "news", label: "News & reviews", href: null, emphasized: false },
    { key: "tools", label: "Tools & services", href: null, emphasized: false }
  ];
  if (await dbOk()) {
    const rows = await prisma.menuItem.findMany({
      where: { scope: "header", visible: true },
      orderBy: { position: "asc" }
    });
    if (rows.length > 0) menu = rows;
  }
  return (
    <header className="bg-asphalt text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-dark.png" alt="Pazengo" className="h-8 w-auto" /></Link>
        <nav className="hidden items-center gap-5 text-sm text-white/85 md:flex" aria-label="Primary">
          {menu.map((m, i) =>
            m.href ? (
              m.emphasized ? (
                <Link key={m.key} href={m.href} className="rounded bg-signal px-3 py-1.5 font-bold text-white hover:brightness-110">{m.label}</Link>
              ) : (
                <Link key={m.key} href={m.href} className={i === 0 ? "font-semibold text-white" : undefined}>{m.label}</Link>
              )
            ) : (
              <span key={m.key}>{m.label}</span>
            )
          )}
        </nav>
        {user ? (
          <AccountMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} isAdmin={admin !== null} />
        ) : (
          <span className="flex items-center gap-2">
            <Link href="/login" className="rounded bg-white px-3 py-1.5 text-sm font-semibold text-asphalt hover:bg-gray-100">
              Sign in / Register
            </Link>
            <Link href="/admin" aria-label="Admin console" title="Admin console" className="rounded px-2 py-1.5 text-xs text-white/60 hover:text-white">
              Admin
            </Link>
          </span>
        )}
      </div>
    </header>
  );
}
