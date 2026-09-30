import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SETTING_DEFS } from "@/lib/validators";
import { prisma } from "@/lib/db";
import SettingsForm from "@/components/settings-form";
import MenuPagesManager from "@/components/menu-pages-manager";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage(): Promise<JSX.Element> {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const [values, menuItems] = await Promise.all([
    getSettings(),
    prisma.menuItem.findMany({ where: { scope: "header" }, orderBy: { position: "asc" } })
  ]);
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">System settings</h1>
        <p className="text-sm text-gray-600">Platform tunables — no code changes needed. Changes apply within a minute.</p>
      </div>
      <SettingsForm defs={SETTING_DEFS} initial={values} />
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Menu pages <span className="text-sm font-normal text-gray-500">· marketplace header</span></h2>
          <p className="text-sm text-gray-600">Rename, reorder, show or delete header entries. Deleting removes the entry only — its page stays live at its address.</p>
        </div>
        <MenuPagesManager initial={menuItems} />
      </section>
    </div>
  );
}
