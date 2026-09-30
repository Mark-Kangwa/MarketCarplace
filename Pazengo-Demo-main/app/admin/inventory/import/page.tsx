import ImportForm from "@/components/import-form";
import { csvTemplateHeader } from "@/lib/validators";
import { guard } from "@/lib/guard";

export default async function ImportPage(): Promise<JSX.Element> {
  await guard();
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Import stock from CSV</h1>
        <p className="text-sm text-gray-600">Upload a spreadsheet export. We validate first — nothing saves until you confirm.</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="mb-2 text-xs text-gray-600">Expected header:</p>
        <code className="mb-4 block overflow-x-auto rounded bg-lot p-2 text-xs">{csvTemplateHeader()}</code>
        <ImportForm />
      </div>
    </div>
  );
}
