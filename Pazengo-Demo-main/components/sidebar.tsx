"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/listing-products", label: "Listing products" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/news", label: "News & Reviews" }
];

const inventoryLinks = [
  { href: "/admin/inventory/published", label: "Published" },
  { href: "/admin/inventory/pending-review", label: "Pending review" }
];

export default function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const active = links.filter((l) => pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href))).map((l) => l.href)[0] ?? "/admin";
  const inventoryOpen = pathname.startsWith("/admin/inventory");
  const inventoryActive = inventoryLinks.filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`)).map((l) => l.href)[0] ?? "/admin/inventory/published";
  const configOpen = pathname.startsWith("/admin/vehicle-config");
  return (
    <aside className="hidden w-56 shrink-0 flex-col bg-asphalt text-white md:flex">
      <div className="border-b border-white/10 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Link href="/" aria-label="Pazengo home"><img src="/logo/logo-dark.png" alt="Pazengo" className="h-7 w-auto" /></Link>
        <p className="mt-1 text-xs text-white/60">Admin console</p>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Admin">
        {links.slice(0, 1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active === l.href ? "page" : undefined}
            className={`block rounded px-3 py-2 text-sm ${active === l.href ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}
          >
            {l.label}
          </Link>
        ))}
        <div className="pt-2">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Inventory</p>
          {inventoryLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={inventoryActive === l.href ? "page" : undefined}
              className={`block rounded px-3 py-2 pl-6 text-sm ${inventoryOpen && inventoryActive === l.href ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        {links.slice(1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active === l.href ? "page" : undefined}
            className={`block rounded px-3 py-2 text-sm ${active === l.href ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}
          >
            {l.label}
          </Link>
        ))}
        <div className="pt-2">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Vehicle Config</p>
          {[
            { href: "/admin/vehicle-config/vehicle-types", label: "Vehicle types" },
            { href: "/admin/vehicle-config/form-fields", label: "Form fields" }
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "page" : undefined}
              className={`block rounded px-3 py-2 pl-6 text-sm ${configOpen && (pathname === l.href || pathname.startsWith(`${l.href}/`)) ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="pt-2">
          <Link
            href="/admin/system-settings"
            aria-current={pathname === "/admin/system-settings" ? "page" : undefined}
            className={`block rounded px-3 py-2 text-sm ${pathname === "/admin/system-settings" ? "bg-white/15 font-semibold" : "text-white/80 hover:bg-white/10"}`}
          >
            System Settings
          </Link>
        </div>
      </nav>
      <div className="p-3 text-xs text-white/50">
        <p>Single admin mode</p>
        <Link href="/" className="underline hover:text-white">View marketplace</Link>
      </div>
    </aside>
  );
}
