import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import AutoRefresh from "@/components/auto-refresh";
import AvatarForm from "@/components/avatar-form";
import { DeleteAccountRow, NameRow, PasswordRow, PhoneRow } from "@/components/profile-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage(): Promise<JSX.Element> {
  let session;
  try {
    session = await requireUser();
  } catch {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, phone: true, avatarUrl: true }
  });
  if (!user) redirect("/login");

  return (
    <AccountShell active="profile" crumb="Profile" title="Profile" subtitle="Manage your personal details and account.">
      <AutoRefresh />
      <section aria-label="Profile photo" className="rounded-lg border border-line bg-white p-4">
        <AvatarForm name={user.name} email={user.email} avatarUrl={user.avatarUrl ?? ""} />
      </section>

      <section aria-label="Personal details" className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <NameRow initial={user.name} />
        <div className="border-b border-line/60 px-4 py-3">
          <p className="text-xs text-gray-500">Email</p>
          <p className="truncate text-sm font-semibold">{user.email}</p>
        </div>
        <PhoneRow initial={user.phone ?? ""} />
        <PasswordRow />
      </section>

      <section aria-label="Danger zone" className="mt-4 overflow-hidden rounded-lg border border-red-300 bg-white">
        <DeleteAccountRow />
      </section>
    </AccountShell>
  );
}
