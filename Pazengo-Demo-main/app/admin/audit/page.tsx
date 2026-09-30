import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AuditPage(): Promise<JSX.Element> {
  await guard();
  let logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>> = [];
  if (await dbOk()) logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-gray-600">Every block, publish, and payment decision. Never delete entries.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-lot text-xs text-gray-600">
            <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">{l.actor}</td>
                <td className="px-3 py-2">{l.action}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{l.entity} · {l.entityId.slice(0, 8)}</td>
              </tr>
            ))}
            {logs.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">No entries yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
