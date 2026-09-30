import ArticleForm from "@/components/article-form";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function NewArticlePage(): Promise<JSX.Element> {
  await guard();
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New article</h1>
        <p className="text-sm text-gray-600">Stays as a draft until you set status to Published.</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <ArticleForm />
      </div>
    </div>
  );
}
