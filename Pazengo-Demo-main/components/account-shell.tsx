import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SignOutButton from "@/components/sign-out-button";

export type AccountSection = "favourites" | "recent-activity" | "alerts" | "enquiries" | "my-cars" | "profile";

const MENU: { key: AccountSection; href: string; label: string; icon: string }[] = [
  { key: "favourites", href: "/favourites", label: "Favourites", icon: "♥" },
  { key: "recent-activity", href: "/recent-activity", label: "Recent activity", icon: "◷" },
  { key: "alerts", href: "/alerts", label: "Alerts", icon: "🔔" },
  { key: "enquiries", href: "/enquiries", label: "Enquiries", icon: "✉" },
  { key: "my-cars", href: "/my-cars", label: "My cars", icon: "🚗" },
  { key: "profile", href: "/profile", label: "Profile", icon: "👤" }
];

export default function AccountShell({
  active,
  crumb,
  title,
  subtitle,
  action,
  children
}: {
  active: AccountSection;
  crumb: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  const menu = (
    <>
      {MENU.map((m) => (
        <Link
          key={m.key}
          href={m.href}
          aria-current={m.key === active ? "page" : undefined}
          className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold ${m.key === active ? "border border-trader bg-blue-50 text-trader" : "border border-transparent hover:bg-lot"}`}
        >
          <span aria-hidden="true">{m.icon}</span>
          {m.label}
        </Link>
      ))}
      <SignOutButton className="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-left text-sm font-semibold hover:bg-lot" />
    </>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">{crumb}</span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <div className="mb-4 mt-1 flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm text-gray-600">{subtitle}</p>
          {action}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Account" className="flex gap-2 overflow-x-auto rounded-lg border border-line bg-white p-2 lg:sticky lg:top-4 lg:flex-col lg:overflow-visible">
            {menu}
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
          <p>© 2026 Pazengo. Prices exclude on-road and licence fees. Confirm details with the seller before purchase.</p>
        </div>
      </footer>
    </div>
  );
}
