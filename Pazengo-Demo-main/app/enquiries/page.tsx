import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import AutoRefresh from "@/components/auto-refresh";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo, zmw } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  MESSAGE: "Message sent",
  WHATSAPP: "WhatsApp chat",
  SHOW_NUMBER: "Viewed number",
  PANEL: "Opened contact options"
};

export default async function EnquiriesPage(): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login");
  }
  const enquiries = await prisma.enquiry.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { car: true }
  });

  return (
    <AccountShell
      active="enquiries"
      crumb="Enquiries"
      title="Enquiries"
      subtitle={enquiries.length === 0
        ? "Every time you message a dealer, open a WhatsApp chat or view a number, it is recorded here."
        : `${enquiries.length} enquir${enquiries.length === 1 ? "y" : "ies"} made.`}
    >
      <AutoRefresh />
      {enquiries.length === 0 ? (
        <div className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">
          <p className="font-semibold text-asphalt">No enquiries yet.</p>
          <p className="mt-1">Contact a dealer on any listing and it will show up here.</p>
          <Link href="/#listings" className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Browse cars</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {enquiries.map((e) => {
            const photos = Array.isArray(e.car.photos) ? (e.car.photos as string[]) : [];
            const img = photos[0] ?? `https://placehold.co/320x200/e2e5ea/0F1F38?text=${encodeURIComponent(`${e.car.make} ${e.car.model}`)}`;
            const title = `${e.car.year} ${e.car.make} ${e.car.model}${e.car.variant ? ` ${e.car.variant}` : ""}`;
            return (
              <li key={e.id} className="overflow-hidden rounded-lg border border-line bg-white">
                <Link href={`/listing/${e.car.id}`} className="flex gap-3 p-3 hover:bg-lot/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-20 w-28 shrink-0 rounded object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{title}</span>
                    <span className="tabular mt-0.5 block text-sm font-semibold text-asphalt">{zmw(e.car.priceZmw)}</span>
                    <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-trader">
                      {CHANNEL_LABEL[e.channel] ?? e.channel}
                    </span>
                    {e.message ? <span className="mt-1 block truncate text-xs text-gray-600">“{e.message}”</span> : null}
                    <span className="mt-1 block text-xs text-gray-500">{timeAgo(e.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
