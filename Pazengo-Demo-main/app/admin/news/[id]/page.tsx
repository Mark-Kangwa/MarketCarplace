import { notFound } from "next/navigation";
import ArticleForm from "@/components/article-form";
import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: { id: string } }): Promise<JSX.Element> {
  await guard();
  if (!(await dbOk())) return <p className="text-sm">Database not connected.</p>;
  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Edit article</h1>
        <p className="text-sm text-gray-600">Live at <span className="font-mono">/news/{article.slug}</span> when published. The link never changes, even if you retitle.</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <ArticleForm
          id={article.id}
          initial={{
            title: article.title,
            kind: article.kind,
            excerpt: article.excerpt,
            coverUrl: article.coverUrl ?? "",
            body: article.body,
            status: article.status
          }}
        />
      </div>
    </div>
  );
}
