import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import MyCarActions from "@/components/my-car-actions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { zmw } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusPill(status: string, expired: boolean): { label: string; cls: string } {
  if (expired && status === "PUBLISHED") return { label: "Expired", cls: "bg-gray-200 text-gray-700" };
  switch (status) {
    case "PUBLISHED":
      return { label: "Live", cls: "bg-green-100 text-green-800" };
    case "SOLD":
      return { label: "Sold", cls: "bg-signal/10 text-signal" };
    case "BLOCKED":
      return { label: "Blocked", cls: "bg-gray-200 text-gray-700" };
    default:
      return { label: "In review", cls: "bg-amber-100 text-amber-800" };
  }
}

function expiryLabel(expiresAt: Date | null): string | null {
  if (!expiresAt) return null;
  return `Live until ${new Date(expiresAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`;
}

export default async function MyCarsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login?next=/my-cars");
  }
  const firstParam = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const justSaved = firstParam(searchParams.saved) === "1";
  const justSubmitted = firstParam(searchParams.submitted) === "1";
  const justPaid = firstParam(searchParams.paid) === "1";
  const cars = await prisma.car.findMany({
    where: { ownerId: session.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, make: true, model: true, variant: true, year: true,
      priceZmw: true, location: true, status: true, createdAt: true,
      photos: true, productName: true, expiresAt: true
    }
  });
  const payments = await prisma.payment.findMany({
    where: { userId: session.id, kind: "LISTING_FEE" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, status: true, method: true, createdAt: true, carId: true,
      listingProduct: { select: { id: true, name: true } }
    }
  });
  const ready = payments.filter((p) => p.status === "APPROVED" && !p.carId && p.listingProduct);
  const awaiting = payments.filter((p) => p.status === "PENDING");
  const refused = payments.filter((p) => p.status === "REJECTED").slice(0, 3);
  const feedback = await prisma.listingReview.findMany({
    where: {
      car: { ownerId: session.id },
      seenAt: null,
      decision: { in: ["REQUEST_CHANGES", "REJECTED"] }
    },
    select: { carId: true }
  });
  const feedbackCarIds = new Set(feedback.map((f) => f.carId));
  return (
    <AccountShell
      active="my-cars"
      crumb="My cars"
      title="My cars"
      subtitle={
        cars.length === 0
          ? "Cars you list for sale live here, under your profile."
          : `${cars.length} car${cars.length === 1 ? "" : "s"} you’re selling.`
      }
      action={<Link href="/sell-my-car" className="rounded bg-signal px-4 py-2 text-sm font-bold text-white hover:brightness-110">+ Add your car</Link>}
    >
      {justSubmitted ? (
        <p role="status" className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Submitted for review — our team will check it before it goes live. Paid listings also wait for payment approval.
        </p>
      ) : null}
      {justPaid ? (
        <p role="status" className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Payment recorded — once we approve it, your package unlocks the car form.
        </p>
      ) : null}
      {justSaved && !justSubmitted ? (
        <p role="status" className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Changes saved.
        </p>
      ) : null}
      {ready.length > 0 ? (
        <section aria-label="Ready to list" className="mb-4 rounded-lg border border-green-200 bg-green-50/50 p-4">
          <h2 className="text-sm font-bold text-asphalt">Ready to list — payment approved ✓</h2>
          <ul className="mt-2 space-y-2">
            {ready.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-white px-3 py-2 text-sm">
                <span><span className="font-semibold">{p.listingProduct?.name}</span> <span className="text-xs text-gray-500">approved — one listing</span></span>
                <Link href={`/sell-my-car/list?product=${p.listingProduct?.id}`} className="rounded bg-signal px-3 py-1.5 font-bold text-white">Continue → form</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {awaiting.length > 0 ? (
        <section aria-label="Payments in review" className="mb-4 rounded-lg border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-asphalt">Payments in review</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {awaiting.map((p) => (
              <li key={p.id}>⏳ {p.listingProduct?.name ?? "Package"} · {p.method === "MOBILE_MONEY" ? "Mobile money" : "EFT"} — we&apos;ll unlock your form once approved.</li>
            ))}
          </ul>
        </section>
      ) : null}
      {refused.length > 0 ? (
        <section aria-label="Declined payments" className="mb-4 rounded-lg border border-red-200 bg-red-50/50 p-4">
          <h2 className="text-sm font-bold text-asphalt">Declined payments</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {refused.map((p) => (
              <li key={p.id}>✕ {p.listingProduct?.name ?? "Package"} was declined — <Link href="/sell-my-car" className="font-semibold text-trader hover:underline">pay again</Link>.</li>
            ))}
          </ul>
        </section>
      ) : null}
      {cars.length === 0 && ready.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-gray-600">
          <p className="text-base font-bold text-asphalt">You haven’t listed a car yet.</p>
          <p className="mx-auto mt-1 max-w-sm">Tell us about your vehicle — photos, price and details — and we’ll review it before it goes live to thousands of buyers.</p>
          <Link href="/sell-my-car" className="mt-4 inline-block rounded bg-signal px-5 py-2.5 text-sm font-bold text-white hover:brightness-110">Add your car</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {cars.map((c) => {
            const expired = !!c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now();
            const pill = statusPill(c.status, expired);
            const expiry = expiryLabel(c.expiresAt);
            const photos = Array.isArray(c.photos) ? (c.photos as string[]) : [];
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt="" className="h-14 w-20 rounded object-cover" loading="lazy" />
                ) : (
                  <span aria-hidden="true" className="grid h-14 w-20 place-items-center rounded bg-lot text-lg text-gray-400">🚗</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.year} {c.make} {c.model}{c.variant ? ` ${c.variant}` : ""}</span>
                  {feedbackCarIds.has(c.id) ? (
                    <Link href={`/my-cars/${c.id}`} className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 hover:underline">
                      💬 Reviewer feedback — view &amp; amend
                    </Link>
                  ) : null}
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className={`rounded px-1.5 py-0.5 font-bold ${pill.cls}`}>{pill.label}</span>
                    <span className="tabular font-semibold text-asphalt">{zmw(c.priceZmw)}</span>
                    {c.location ? <span>{c.location}</span> : null}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {c.productName ? <span>📦 {c.productName}</span> : null}
                    {expiry && !expired ? <span>{expiry}</span> : null}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {expired && c.status === "PUBLISHED" ? (
                    <Link href={`/sell-my-car/renew/${c.id}`} className="rounded bg-signal px-3 py-1.5 font-bold text-white hover:brightness-110">Renew</Link>
                  ) : null}
                  {c.status !== "BLOCKED" ? (
                    <Link href={`/my-cars/${c.id}`} className="rounded border border-line px-3 py-1.5 hover:bg-lot">Edit</Link>
                  ) : null}
                  <MyCarActions id={c.id} status={c.status} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
