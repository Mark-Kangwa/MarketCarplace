import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { prisma, dbOk } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "News & reviews — Pazengo",
  description: "Car news and reviews from Pazengo."
};

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function NewsPage({ searchParams }: { searchParams: SP }): Promise<JSX.Element> {
  const kind = first(searchParams.kind).toUpperCase() === "REVIEW" ? "REVIEW" : first(searchParams.kind).toUpperCase() === "NEWS" ? "NEWS" : "";
  const q = first(searchParams.q).trim().slice(0, 60);
  let articles: { id: string; title: string; slug: string; kind: string; excerpt: string; coverUrl: string | null; publishedAt: Date | null }[] = [];
  if (await dbOk()) {
    articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        ...(kind ? { kind: kind as never } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {})
      },
      orderBy: { publishedAt: "desc" },
      take: 60
    });
  }
  const tab = (label: string, value: string): string => {
    const sp = new URLSearchParams();
    if (value) sp.set("kind", value);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return `/news${s ? `?${s}` : ""}`;
  };
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">News &amp; reviews</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">News &amp; reviews</h1>
          <p className="mt-1 text-sm text-gray-600">Car news, buying guides and reviews from our team.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2" role="tablist" aria-label="Article type">
            {[
              { label: "All", value: "", selected: kind === "" },
              { label: "News", value: "NEWS", selected: kind === "NEWS" },
              { label: "Reviews", value: "REVIEW", selected: kind === "REVIEW" }
            ].map((t) => (
              <Link
                key={t.label}
                href={tab(t.label, t.value)}
                role="tab"
                aria-selected={t.selected}
                className={`rounded-full border px-4 py-1.5 text-sm ${t.selected ? "border-asphalt bg-asphalt font-semibold text-white" : "border-line bg-white hover:bg-lot"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <form method="get" className="ml-auto flex gap-2" action="/news">
            {kind ? <input type="hidden" name="kind" value={kind} /> : null}
            <input name="q" defaultValue={q} placeholder="Search articles…" aria-label="Search articles" className="w-48 rounded border border-line px-3 py-1.5 text-sm" />
            <button className="rounded bg-asphalt px-3 py-1.5 text-sm font-semibold text-white">Go</button>
          </form>
        </div>
        {articles.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-gray-600">
            <p className="font-semibold text-asphalt">No articles yet{q || kind ? " for this filter" : ""}.</p>
            <p className="mt-1">{q || kind ? "Try clearing the search or choosing another tab." : "Check back soon."}</p>
            {q || kind ? <Link href="/news" className="mt-3 inline-block rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Clear filters</Link> : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link key={a.id} href={`/news/${a.slug}`} className="group overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-md">
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                ) : (
                  <span aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-lot text-3xl">📰</span>
                )}
                <span className="block p-4">
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`rounded px-1.5 py-0.5 font-bold ${a.kind === "REVIEW" ? "bg-blue-100 text-trader" : "bg-lot text-gray-600"}`}>
                      {a.kind === "REVIEW" ? "REVIEW" : "NEWS"}
                    </span>
                    <span>{a.publishedAt ? timeAgo(a.publishedAt) : ""}</span>
                  </span>
                  <span className="mt-1.5 block font-bold leading-snug group-hover:text-trader">{a.title}</span>
                  {a.excerpt ? <span className="mt-1 line-clamp-2 block text-sm text-gray-600">{a.excerpt}</span> : null}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
          <p>© 2026 Pazengo. Prices exclude on-road and licence fees. Confirm details with the seller before purchase.</p>
        </div>
      </footer>
    </div>
  );
}
