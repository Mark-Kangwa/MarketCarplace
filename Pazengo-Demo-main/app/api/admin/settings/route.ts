import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { SETTING_DEFS } from "@/lib/validators";
import { bustSettingsCache } from "@/lib/settings";

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const values = (json.values ?? {}) as Record<string, unknown>;
    const changed: string[] = [];
    for (const def of SETTING_DEFS) {
      if (values[def.key] === undefined) continue;
      const n = typeof values[def.key] === "number" ? (values[def.key] as number) : Number(values[def.key]);
      if (!Number.isInteger(n) || n < def.min || n > def.max) {
        return NextResponse.json({ error: `“${def.label}” must be a whole number from ${def.min} to ${def.max}.` }, { status: 400 });
      }
      await prisma.systemSetting.upsert({
        where: { key: def.key },
        update: { value: String(n) },
        create: { key: def.key, value: String(n) }
      });
      changed.push(`${def.label} → ${n}`);
    }
    if (changed.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    bustSettingsCache();
    await prisma.auditLog.create({ data: { actor, action: `Updated system settings: ${changed.join("; ")}`, entity: "SystemSetting", entityId: "settings" } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
