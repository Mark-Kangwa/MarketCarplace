import { prisma } from "./db";
import { SETTING_DEFS, type SettingDef } from "./validators";

const CACHE_TTL_MS = 60_000;
let cache: { at: number; values: Record<string, number> } | null = null;

export function bustSettingsCache(): void {
  cache = null;
}

function clamp(def: SettingDef, n: number): number {
  if (!Number.isFinite(n)) return def.fallback;
  return Math.min(def.max, Math.max(def.min, Math.floor(n)));
}

export async function getSettings(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values;
  const rows = await prisma.systemSetting.findMany();
  const stored = new Map(rows.map((r) => [r.key, Number(r.value)]));
  const values: Record<string, number> = {};
  for (const def of SETTING_DEFS) {
    values[def.key] = clamp(def, stored.has(def.key) ? (stored.get(def.key) as number) : def.fallback);
  }
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting(key: string): Promise<number> {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  return (await getSettings())[key] as number;
}
