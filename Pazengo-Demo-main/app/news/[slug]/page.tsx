import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import { prisma, dbOk } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { slug: string };

async function getArticle(slug: string) {
  if (!(await dbOk())) return null;
  return prisma.article.findUnique({ where: { slug } });
}

function isPublic(a: { status: string }): boolean {
  return a.status === "PUBLISHED";
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article || !isPublic(article)) {
    return { title: "Article not found — Pazengo" };
  }
  return {
    title: `${article.title} — Pazengo`,
    description: article.excerpt || article.body.slice(0, 160)
  };
}

export default async function ArticlePage({ params }: { params: Params }): Promise<JSX.Element> {
  const article = await getArticle(params.slug);
  if (!article) {
    if (!(await dbOk())) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="rounded-lg border border-line bg-white p-6 text-sm text-gray-600">Database not connected.</p>
          <Link href="/news" className="mt-4 inline-block text-sm font-semibold text-trader">← Back to news</Link>
        </div>
      );
    }
    notFound();
  }
  if (!isPublic(article)) notFound();
  const paragraphs = article.body.split(/\r?\n\s*\r?\n|\r?\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
          <Link href="/" className="hover:text-trader">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/news" className="hover:text-trader">News &amp; reviews</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-asphalt">{article.kind === "REVIEW" ? "Review" : "News"}</span>
        </nav>
        <div>
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`rounded px-1.5 py-0.5 font-bold ${article.kind === "REVIEW" ? "bg-blue-100 text-trader" : "bg-lot text-gray-600"}`}>
              {article.kind === "REVIEW" ? "REVIEW" : "NEWS"}
            </span>
            <span>{article.publishedAt ? timeAgo(article.publishedAt) : ""}</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">{article.title}</h1>
          {article.excerpt ? <p className="mt-2 text-gray-600">{article.excerpt}</p> : null}
        </div>
        {article.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverUrl} alt={article.title} className="w-full rounded-lg border border-line object-cover" />
        ) : null}
        <div className="space-y-4 rounded-lg border border-line bg-white p-4 text-[15px] leading-relaxed md:p-6">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/news" className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">← All articles</Link>
          <Link href="/" className="rounded border border-line px-4 py-2 text-sm font-semibold hover:bg-lot">Browse cars</Link>
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
