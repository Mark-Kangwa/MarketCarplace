/**
 * Single source of truth for Zambian locations.
 * Only the town/city is ever stored (Car.location) — the province is always
 * derived via {@link provinceOf}, so no schema change is needed.
 */
export const ZAMBIA_PROVINCE_TOWNS: Record<string, string[]> = {
  Lusaka: ["Lusaka", "Kafue", "Chongwe", "Chirundu", "Chilanga"],
  Copperbelt: ["Kitwe", "Ndola", "Chingola", "Luanshya", "Chililabombwe", "Mufulira", "Kalulushi", "Chambishi"],
  Central: ["Kabwe", "Kapiri Mposhi", "Mkushi", "Serenje", "Chisamba", "Mumbwa"],
  Southern: ["Livingstone", "Choma", "Mazabuka", "Monze", "Siavonga", "Kalomo", "Kazungula"],
  Eastern: ["Chipata", "Petauke", "Katete"],
  Northern: ["Kasama", "Mbala", "Mpulungu"],
  Muchinga: ["Mpika", "Chinsali", "Isoka", "Nakonde"],
  Luapula: ["Mansa", "Kawambwa", "Nchelenge"],
  "North-Western": ["Solwezi", "Kasempa", "Mwinilunga"],
  Western: ["Mongu", "Senanga", "Sesheke", "Kaoma", "Kalabo"]
};

export const ZAMBIA_PROVINCES: string[] = Object.keys(ZAMBIA_PROVINCE_TOWNS);

export const ZAMBIA_TOWNS: string[] = ZAMBIA_PROVINCES.flatMap((p) => ZAMBIA_PROVINCE_TOWNS[p]);

/** Province for a town (case-insensitive), or null when unknown/custom. */
export function provinceOf(town: string): string | null {
  const needle = town.trim().toLowerCase();
  if (!needle) return null;
  for (const province of ZAMBIA_PROVINCES) {
    if (ZAMBIA_PROVINCE_TOWNS[province].some((t) => t.toLowerCase() === needle)) {
      return province;
    }
  }
  return null;
}

/** All towns in a province (case-insensitive province name), or []. */
export function townsIn(province: string): string[] {
  const needle = province.trim().toLowerCase();
  const key = ZAMBIA_PROVINCES.find((p) => p.toLowerCase() === needle);
  return key ? [...ZAMBIA_PROVINCE_TOWNS[key]] : [];
}

/** True for provinces in canonical casing. */
export function isProvince(v: string): boolean {
  return ZAMBIA_PROVINCES.some((p) => p === v);
}

/** Canonical province name (case-insensitive), or "" when unknown. */
export function provinceCanonical(v: string): string {
  const needle = v.trim().toLowerCase();
  if (!needle) return "";
  return ZAMBIA_PROVINCES.find((p) => p.toLowerCase() === needle) ?? "";
}

/** True for any listed town (case-sensitive canonical form). */
export function isListedTown(v: string): boolean {
  return (ZAMBIA_TOWNS as readonly string[]).includes(v);
}
