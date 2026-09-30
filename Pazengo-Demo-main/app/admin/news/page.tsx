import Link from "next/link";
import { prisma, dbOk } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { Pill } from "@/components/pills";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function NewsAdminPage({ searchParams }: { searchParams: { q?: string; status?: string; kind?: string } }): Promise<JSX.Element> {
  await guard();
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status || "";
  const kind = searchParams.kind || "";
  let articles: Awaited<ReturnType<typeof prisma.article.findMany>> = [];
  if (await dbOk()) {
    articles = await prisma.article.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(kind ? { kind: kind as never } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: 100
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">News &amp; Reviews</h1>
          <p className="text-sm text-gray-600">Write once, publish to the marketplace news page.</p>
        </div>
        <Link href="/admin/news/new" className="rounded bg-signal px-3 py-2 text-sm font-bold text-white">New article</Link>
      </div>
      <form className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3 sm:flex-row" method="get">
        <input name="q" defaultValue={q} placeholder="Search title or body…" aria-label="Search articles" className="flex-1 rounded border border-line px-3 py-2 text-sm" />
        <select name="kind" defaultValue={kind} aria-label="Filter by type" className="rounded border border-line px-3 py-2 text-sm">
          <option value="">News + Reviews</option>
          <option value="NEWS">News</option>
          <option value="REVIEW">Reviews</option>
        </select>
        <select name="status" defaultValue={status} aria-label="Filter by status" className="rounded border border-line px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <button className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Filter</button>
      </form>
      <ul className="divide-y rounded border border-line bg-white">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/news/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-lot/60">
              {a.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.coverUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <span aria-hidden="true" className="grid h-12 w-20 shrink-0 place-items-center rounded bg-lot text-lg">📰</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className={`rounded px-1.5 py-0.5 font-bold ${a.kind === "REVIEW" ? "bg-blue-100 text-trader" : "bg-lot text-gray-600"}`}>{a.kind === "REVIEW" ? "REVIEW" : "NEWS"}</span>
                  <Pill tone={a.status === "PUBLISHED" ? "green" : "amber"}>{a.status}</Pill>
                  <span>/{a.slug}</span>
                  <span>{timeAgo(a.updatedAt)}</span>
                </span>
              </span>
              <span className="text-sm font-semibold text-trader">Open →</span>
            </Link>
          </li>
        ))}
        {articles.length === 0 ? <li className="px-4 py-8 text-center text-sm text-gray-500">No articles yet. Write the first one.</li> : null}
      </ul>
    </div>
  );
}
