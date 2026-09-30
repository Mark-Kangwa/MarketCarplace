import { z } from "zod";

export const MAX_PHOTOS = 10;

export const DRIVETRAIN_OPTIONS = ["4x2", "4x4", "AWD", "FWD", "RWD"] as const;

export const YEAR_OPTIONS: string[] = Array.from({ length: 2027 - 1990 + 1 }, (_, i) => String(2027 - i));

export const PRICE_MIN_OPTIONS: { value: string; label: string }[] = [
  { value: "100000", label: "K 100 000" },
  { value: "150000", label: "K 150 000" },
  { value: "200000", label: "K 200 000" },
  { value: "250000", label: "K 250 000" },
  { value: "300000", label: "K 300 000" },
  { value: "400000", label: "K 400 000" },
  { value: "500000", label: "K 500 000" },
  { value: "750000", label: "K 750 000" }
];

export const PRICE_MAX_OPTIONS: { value: string; label: string }[] = [
  { value: "150000", label: "K 150 000" },
  { value: "200000", label: "K 200 000" },
  { value: "250000", label: "K 250 000" },
  { value: "300000", label: "K 300 000" },
  { value: "400000", label: "K 400 000" },
  { value: "500000", label: "K 500 000" },
  { value: "750000", label: "K 750 000" },
  { value: "1000000", label: "K 1 000 000" }
];

export const MILEAGE_MAX_OPTIONS: { value: string; label: string }[] = [
  { value: "30000", label: "Under 30 000 km" },
  { value: "50000", label: "Under 50 000 km" },
  { value: "80000", label: "Under 80 000 km" },
  { value: "100000", label: "Under 100 000 km" },
  { value: "120000", label: "Under 120 000 km" },
  { value: "150000", label: "Under 150 000 km" },
  { value: "200000", label: "Under 200 000 km" }
];

export const SEAT_MIN_OPTIONS: { value: string; label: string }[] = [
  { value: "2", label: "2+ seats" },
  { value: "4", label: "4+ seats" },
  { value: "5", label: "5+ seats" },
  { value: "7", label: "7+ seats" },
  { value: "8", label: "8+ seats" },
  { value: "9", label: "9+ seats" },
  { value: "14", label: "14+ seats" }
];

export const SERVICE_HISTORY_OPTIONS = [
  { value: "FULL_FRANCHISE", label: "Full franchise service history" },
  { value: "FULL", label: "Full service history" },
  { value: "PARTIAL", label: "Partial service history" },
  { value: "NONE", label: "No service history" },
  { value: "UNKNOWN", label: "Unknown" }
] as const;

export function serviceHistoryLabel(v: string): string {
  return SERVICE_HISTORY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export const carSchema = z.object({
  make: z.string().min(2).max(40),
  model: z.string().min(1).max(40),
  variant: z.string().max(60).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1990).max(2027),
  priceZmw: z.coerce.number().int().min(1000).max(50_000_000),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]),
  fuel: z.enum(["PETROL", "DIESEL", "HYBRID", "ELECTRIC"]),
  bodyType: z.string().min(2).max(30),
  drivetrain: z.enum(DRIVETRAIN_OPTIONS, { errorMap: () => ({ message: "Drivetrain is required" }) }),
  condition: z.enum(["NEW", "USED", "DEMO"]),
  chassisNo: z.string().max(17).optional().or(z.literal("")),
  color: z.string().max(30).optional().or(z.literal("")),
  location: z.string().trim().min(2, "Location is required").max(60),
  seats: z.coerce.number().int().min(1).max(60),
  serviceHistory: z.enum(["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"]).default("UNKNOWN"),
  status: z.enum(["DRAFT", "PUBLISHED", "BLOCKED", "SOLD"]).default("DRAFT"),
  isFeatured: z.coerce.boolean().default(false),
  photos: z.array(z.string().url().or(z.string().startsWith("/"))).max(MAX_PHOTOS).default([]),
  features: z.array(z.string().max(60)).max(20).default([])
});

export const featuredToggleSchema = z.object({
  isFeatured: z.coerce.boolean()
});

export type CarInput = z.infer<typeof carSchema>;

export const blockUserSchema = z.object({
  reason: z.string().min(3).max(300)
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: z.enum(["BUYER", "DEALER"]).default("BUYER")
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  password: z.string().min(1, "Enter your password").max(72)
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60).optional(),
  phone: z.string().trim().max(20).optional().or(z.literal(""))
});

export const passwordChangeSchema = z.object({
  current: z.string().min(1, "Enter your current password").max(72),
  next: z.string().min(8, "New password must be at least 8 characters").max(72)
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm").max(72)
});

export const favoriteToggleSchema = z.object({
  carId: z.string().min(1, "Missing car")
});

export const favoriteListSchema = z.object({
  name: z.string().trim().min(1, "Enter a list name").max(40)
});

export const favoriteListRenameSchema = z.object({
  id: z.string().min(1, "Missing list"),
  name: z.string().trim().min(1, "Enter a list name").max(40)
});

export const favoriteListIdSchema = z.object({
  id: z.string().min(1, "Missing list")
});

export const favoriteSaveSchema = z.object({
  carId: z.string().min(1, "Missing car"),
  listId: z.string().min(1, "Choose a list")
});

export function slugifyName(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 60) || "type";
}

export const vehicleTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter a type name").max(40)
});

export const FIELD_KINDS = ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "BOOLEAN", "DATE", "LONG_TEXT"] as const;

/** Kinds that carry an option list (dropdowns and checkbox groups). */
export function hasOptionsKind(kind: string): boolean {
  return kind === "SELECT" || kind === "MULTI_SELECT";
}

/**
 * CORE taxonomy: universal across every vehicle type — kind and options are
 * locked. Everything else is CUSTOM (editable), optionally linked to a
 * listing column so search filters keep working.
 */
export const CORE_BINDINGS = ["make", "model", "variant", "year", "priceZmw", "mileageKm"] as const;

export function isCoreBinding(binding: string | null | undefined): boolean {
  return !!binding && (CORE_BINDINGS as readonly string[]).includes(binding);
}

/**
 * Kinds a linked CUSTOM field may switch between without breaking its
 * listing column. Unlinked custom fields may use any kind.
 */
export const LINKED_KIND_COMPAT: Record<string, readonly string[]> = {
  seats: ["NUMBER", "SELECT"],
  transmission: ["TEXT", "SELECT"],
  fuel: ["TEXT", "SELECT"],
  bodyType: ["TEXT", "SELECT"],
  drivetrain: ["TEXT", "SELECT"],
  condition: ["TEXT", "SELECT"],
  chassisNo: ["TEXT", "SELECT"],
  color: ["TEXT", "SELECT"],
  location: ["TEXT", "SELECT"],
  serviceHistory: ["TEXT", "SELECT"]
};

const TITLE_CASE_BINDINGS = new Set(["transmission", "fuel", "condition"]);
const SERVICE_HISTORY_KEYS = new Set(["serviceHistory", "service_history"]);

/**
 * Single source of truth for option wording, admin and frontend alike.
 * Stored values stay codes — display only.
 */
export function displayOption(bindingOrKey: string, value: string): string {
  if (SERVICE_HISTORY_KEYS.has(bindingOrKey)) return serviceHistoryLabel(value);
  if (TITLE_CASE_BINDINGS.has(bindingOrKey) && value.length > 0) {
    return value.charAt(0) + value.slice(1).toLowerCase();
  }
  return value;
}

// Bindings backed by strict enum columns: only known codes are valid, so
// unmappable text is rejected instead of saved.
const STRICT_OPTION_BINDINGS = new Set(["transmission", "fuel", "condition", "serviceHistory"]);

/** Canonical codes per strict binding (what the listing columns accept). */
export const CANONICAL_OPTION_CODES: Record<string, readonly string[]> = {
  transmission: ["MANUAL", "AUTOMATIC"],
  fuel: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"],
  condition: ["NEW", "USED", "DEMO"],
  serviceHistory: ["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"]
};

export function isCanonicalOptionCode(bindingOrKey: string, code: string): boolean {
  return (CANONICAL_OPTION_CODES[bindingOrKey] as readonly string[] | undefined)?.includes(code) ?? false;
}

export function isStrictOptionBinding(bindingOrKey: string): boolean {
  return STRICT_OPTION_BINDINGS.has(bindingOrKey);
}

/**
 * Canonical translation for admin options boxes: turns what an admin types
 * ("Full service history", "FULL", "manual") into the stored code form.
 * Free-string columns pass new values through untouched (e.g. Motorbike
 * body styles); strict bindings resolve codes and labels, else the raw text
 * (callers enforce canonical membership for strict bindings).
 */
export function parseDisplayOption(bindingOrKey: string, text: string): string {
  const t = text.trim();
  if (SERVICE_HISTORY_KEYS.has(bindingOrKey)) {
    const up = t.toUpperCase().replace(/[\s-]+/g, "_");
    if ((CANONICAL_OPTION_CODES.serviceHistory as readonly string[]).includes(up)) return up;
    const hit = SERVICE_HISTORY_OPTIONS.find((o) => o.label.toLowerCase() === t.toLowerCase());
    if (hit) return hit.value;
    return t;
  }
  if (TITLE_CASE_BINDINGS.has(bindingOrKey)) return t.toUpperCase();
  return t;
}

/**
 * Canonical identity for duplicate detection: codes, case variants,
 * underscore/space variants and friendly labels of the same value collide.
 * Free-text values collapse by case-insensitive trim.
 */
export function optionIdentity(bindingOrKey: string, value: string): string {
  const t = value.trim();
  if (SERVICE_HISTORY_KEYS.has(bindingOrKey)) {
    const up = t.toUpperCase().replace(/[\s-]+/g, "_");
    if ((SERVICE_HISTORY_OPTIONS as readonly { value: string }[]).some((o) => o.value === up)) return up;
    const hit = SERVICE_HISTORY_OPTIONS.find((o) => o.label.toLowerCase() === t.toLowerCase());
    if (hit) return hit.value;
    return `raw:${t.toLowerCase()}`;
  }
  if (TITLE_CASE_BINDINGS.has(bindingOrKey)) return t.toUpperCase();
  return t.toLowerCase();
}

/** First value whose identity collides with an earlier one, if any. */
export function findOptionDuplicate(bindingOrKey: string, options: string[]): string | null {
  const seen = new Set<string>();
  for (const o of options) {
    const id = optionIdentity(bindingOrKey, o);
    if (seen.has(id)) return o;
    seen.add(id);
  }
  return null;
}

export const formFieldCreateSchema = z.object({
  label: z.string().trim().min(2, "Enter a field label").max(60),
  kind: z.enum(FIELD_KINDS),
  options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  unit: z.string().trim().max(12).optional().or(z.literal("")),
  minValue: z.coerce.number().finite().optional(),
  maxValue: z.coerce.number().finite().optional(),
  help: z.string().trim().max(200).optional().or(z.literal("")),
  assignTo: z.string().min(1).optional(),
  required: z.coerce.boolean().default(false)
});

export const formFieldUpdateSchema = z.object({
  label: z.string().trim().min(2).max(60).optional(),
  kind: z.enum(FIELD_KINDS).optional(),
  options: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  unit: z.string().trim().max(12).optional().or(z.literal("")),
  minValue: z.coerce.number().finite().nullable().optional(),
  maxValue: z.coerce.number().finite().nullable().optional(),
  help: z.string().trim().max(200).optional().or(z.literal(""))
});

export const assignmentSchema = z.object({  fieldId: z.string().min(1, "Choose a field"),
  required: z.coerce.boolean().default(false),
  position: z.coerce.number().int().min(0).max(1000).optional(),
  options: z.array(z.string().trim().min(1).max(60)).max(50).nullable().optional()
});

export const savedSearchCreateSchema = z.object({
  name: z.string().trim().optional().or(z.literal("")),
  emailAlerts: z.boolean().optional(),
  search: z.record(z.string(), z.string())
});

export const savedSearchUpdateSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").optional(),
  emailAlerts: z.boolean().optional()
});

export type SettingDef = {
  key: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  fallback: number;
};

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "soldGraceDays",
    label: "Sold listings visible (days)",
    hint: "How long a sold car stays visible after its sale. Applies instantly to already-sold cars (counted from their sale date).",
    min: 0,
    max: 90,
    fallback: 5
  },
  {
    key: "featuredTake",
    label: "Featured slots on homepage",
    hint: "How many sponsored listings show at the top of the homepage.",
    min: 1,
    max: 10,
    fallback: 3
  },
  {
    key: "landingTake",
    label: "Latest listings on plain homepage",
    hint: "How many regular listings show when no search is active.",
    min: 4,
    max: 24,
    fallback: 8
  },
  {
    key: "maxPhotos",
    label: "Photos per listing",
    hint: "Maximum gallery photos on one listing.",
    min: 1,
    max: 20,
    fallback: 10
  },
  {
    key: "freeLiveLimit",
    label: "Simultaneous free listings per user",
    hint: "How many live free-package listings one user may hold at once.",
    min: 1,
    max: 10,
    fallback: 1
  },
  {
    key: "maxSavedSearches",
    label: "Saved alerts per user",
    hint: "How many searches/alerts one user may save.",
    min: 5,
    max: 50,
    fallback: 20
  }
];

export const listingProductSchema = z.object({  name: z.string().trim().min(2, "Enter a product name").max(60),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  priceZmw: z.coerce.number().int().min(0, "Price cannot be negative").max(100_000_000),
  durationDays: z.coerce.number().int().min(1, "Duration must be at least 1 day").max(365)
});

export const menuItemUpdateSchema = z.object({
  label: z.string().trim().min(1, "Enter a label").max(40).optional(),
  visible: z.boolean().optional()
});

export const menuReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50)
});

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter a full name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum(["BUYER", "DEALER", "ADMIN"]).default("BUYER")
});

export const adminUserRoleSchema = z.object({
  role: z.enum(["BUYER", "DEALER", "ADMIN"])
});

export const adminUserPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(72)
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset link").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(72)
});

export const articleSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(120),
  kind: z.enum(["NEWS", "REVIEW"]).default("NEWS"),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  coverUrl: z.string().trim().max(500).optional().or(z.literal("")),
  body: z.string().trim().min(20, "Article body must be at least 20 characters").max(20000),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT")
});

export const enquiryRecordSchema = z.object({
  carId: z.string().min(1, "Missing car"),
  channel: z.enum(["MESSAGE", "WHATSAPP", "SHOW_NUMBER", "PANEL"]),
  message: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const paymentDecisionSchema = z.object({
  note: z.string().max(300).optional().or(z.literal(""))
});

export function csvTemplateHeader(): string {
  return "make,model,variant,year,price,mileage,transmission,fuel,body,drivetrain,condition,chassis,color,location,seats,servicehistory,features";
}

export function parseCarCsv(text: string): { rows: Record<string, string>[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["CSV is empty"] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const expected = csvTemplateHeader().split(",");
  const missing = expected.filter((e) => !header.includes(e));
  if (missing.length) errors.push(`Missing columns: ${missing.join(", ")}`);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map((c) => c.trim());
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => (rec[h] = cols[idx] ?? ""));
    rows.push(rec);
  }
  return { rows, errors };
}

export function csvRowToCarInput(r: Record<string, string>): CarInput {
  const history = (r.servicehistory ?? r.service_history ?? "UNKNOWN").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const validHistory = (["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"] as const).includes(history as never)
    ? history
    : "UNKNOWN";
  const driveRaw = (r.drivetrain ?? "").trim().toUpperCase();
  const driveMap: Record<string, string> = { "4X2": "4x2", "4X4": "4x4", FWD: "FWD", RWD: "RWD", AWD: "AWD" };
  const drivetrain = driveMap[driveRaw] ?? "";
  const features = (r.features ?? "")
    .split(";")
    .map((s) => s.trim().replace(/^[-•*]\s+/, ""))
    .filter((s) => s.length > 0);
  if (features.length > 20) throw new Error("Too many features — maximum 20, separated by ';'.");
  const tooLong = features.find((s) => s.length > 60);
  if (tooLong) throw new Error(`Feature too long (max 60 chars): "${tooLong.slice(0, 40)}…"`);
  return carSchema.parse({
    make: r.make,
    model: r.model,
    variant: r.variant ?? "",
    year: Number(r.year),
    priceZmw: Number(r.price),
    mileageKm: Number(r.mileage),
    transmission: (r.transmission ?? "MANUAL").toUpperCase(),
    fuel: (r.fuel ?? "PETROL").toUpperCase(),
    bodyType: r.body || "Hatchback",
    drivetrain,
    condition: (r.condition ?? "USED").toUpperCase(),
    chassisNo: r.chassis ?? r.vin ?? "",
    color: r.color ?? "",
    location: r.location ?? "",
    seats: r.seats ? Number(r.seats) : 5,
    serviceHistory: validHistory,
    status: "DRAFT",
    photos: [],
    features
  });
}
