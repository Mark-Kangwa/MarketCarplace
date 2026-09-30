import { prisma, dbOk } from "@/lib/db";
import { guard } from "@/lib/guard";
import UserManager from "@/components/user-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: { q?: string; role?: string; status?: string } }): Promise<JSX.Element> {
  await guard();
  const q = (searchParams.q ?? "").trim();
  let users: {
    id: string; name: string; email: string; phone: string | null;
    role: "BUYER" | "DEALER" | "ADMIN"; status: "ACTIVE" | "BLOCKED";
    blockedReason: string | null; createdAt: Date;
  }[] = [];
  if (await dbOk()) {
    users = await prisma.user.findMany({
      where: {
        ...(searchParams.status ? { status: searchParams.status as never } : {}),
        ...(searchParams.role ? { role: searchParams.role as never } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-gray-600">Create users in any role, reset access, or block to revoke immediately. No email is sent — share passwords and reset links manually.</p>
      </div>
      <form className="flex flex-col gap-2 rounded-lg border border-line bg-white p-3 sm:flex-row" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or email…" aria-label="Search users" className="flex-1 rounded border border-line px-3 py-2 text-sm" />
        <select name="role" defaultValue={searchParams.role ?? ""} aria-label="Role" className="rounded border border-line px-3 py-2 text-sm">
          <option value="">All roles</option><option value="BUYER">General users</option><option value="DEALER">Dealers</option><option value="ADMIN">Administrators</option>
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} aria-label="Status" className="rounded border border-line px-3 py-2 text-sm">
          <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="BLOCKED">Blocked</option>
        </select>
        <button className="rounded bg-asphalt px-4 py-2 text-sm font-semibold text-white">Filter</button>
      </form>
      <UserManager
        initial={users.map((u) => ({
          ...u,
          phone: u.phone ?? null,
          blockedReason: u.blockedReason ?? null,
          createdAt: u.createdAt.toISOString()
        }))}
      />
    </div>
  );
}
