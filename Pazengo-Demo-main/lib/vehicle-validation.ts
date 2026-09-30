import { prisma } from "./db";
import { MAX_PHOTOS, hasOptionsKind, optionIdentity } from "./validators";

export type AssignedField = {
  fieldId: string;
  key: string;
  label: string;
  kind: "TEXT" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "BOOLEAN" | "DATE" | "LONG_TEXT";
  /** Effective options: per-type override when set, else the library list.
   * Only meaningful for SELECT kinds; always [] otherwise. */
  options: string[];
  /** True when this type overrides the library options. */
  optionsOverridden: boolean;
  /** Dynamic vocabularies (make, model, location): membership not enforced. */
  dynamic: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  help: string | null;
  binding: string | null;
  required: boolean;
  position: number;
};

export type VehicleTypeRef = { id: string; name: string; slug: string };

export async function getVehicleTypes(): Promise<VehicleTypeRef[]> {
  return prisma.vehicleType.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true } });
}

export async function getAllAssignments(): Promise<Record<string, AssignedField[]>> {
  const types = await getVehicleTypes();
  const out: Record<string, AssignedField[]> = {};
  for (const t of types) {
    out[t.id] = await getAssignments(t.id);
  }
  return out;
}

/**
 * Custom fields exposed as marketplace filters: SELECT dropdowns and Yes/No
 * toggles. Deduped by field key across types, with options merged in
 * first-seen order.
 */
export async function getCustomFilterDefs(): Promise<
  { key: string; label: string; kind: "SELECT" | "BOOLEAN"; options: string[] }[]
> {
  const fields = await prisma.formField.findMany({
    where: { binding: null, kind: { in: ["SELECT", "BOOLEAN"] } },
    orderBy: { label: "asc" },
    include: { types: { select: { options: true } } }
  });
  const defs: { key: string; label: string; kind: "SELECT" | "BOOLEAN"; options: string[] }[] = [];
  for (const f of fields) {
    if (f.kind !== "SELECT" && f.kind !== "BOOLEAN") continue;
    const base = (f.options as unknown as string[]) ?? [];
    // Union the library list with every per-type override.
    const merged = [...base];
    for (const t of f.types) {
      for (const o of ((t.options as unknown as string[]) ?? [])) {
        if (!merged.includes(o)) merged.push(o);
      }
    }
    if (f.kind === "SELECT" && merged.length === 0) continue;
    const hit = defs.find((d) => d.key === f.key);
    if (hit) {
      for (const o of merged) {
        if (!hit.options.includes(o)) hit.options.push(o);
      }
      continue;
    }
    defs.push({ key: f.key, label: f.label, kind: f.kind, options: merged });
  }
  return defs;
}

export async function getAssignments(vehicleTypeId: string): Promise<AssignedField[]> {
  const rows = await prisma.vehicleTypeField.findMany({
    where: { vehicleTypeId },
    orderBy: { position: "asc" },
    include: { field: true }
  });
  return rows.map((r) => {
    const base = (r.field.options as unknown as string[]) ?? [];
    const override = (r.options as unknown as string[]) ?? [];
    // Overrides and library lists only apply to dropdowns — a field switched
    // to another kind ignores both (stale overrides are cleared on switch).
    const effective = hasOptionsKind(r.field.kind) ? (override.length > 0 ? override : base) : [];
    return {
      fieldId: r.field.id,
      key: r.field.key,
      label: r.field.label,
      kind: r.field.kind,
      options: effective,
      optionsOverridden: hasOptionsKind(r.field.kind) && override.length > 0,
      dynamic: r.field.dynamic,
      unit: r.field.unit,
      minValue: r.field.minValue,
      maxValue: r.field.maxValue,
      help: r.field.help,
      binding: r.field.binding,
      required: r.required,
      position: r.position
    };
  });
}

export type ValidatedListing = {
  vehicleTypeId: string;
  system: {
    make: string; model: string; variant: string; year: number; priceZmw: number; mileageKm: number;
    transmission: "MANUAL" | "AUTOMATIC"; fuel: "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";
    bodyType: string; drivetrain: string; condition: "NEW" | "USED" | "DEMO";
    chassisNo: string; color: string; location: string; seats: number;
    serviceHistory: "FULL_FRANCHISE" | "FULL" | "PARTIAL" | "NONE" | "UNKNOWN";
    status: "DRAFT" | "PUBLISHED" | "BLOCKED" | "SOLD"; isFeatured: boolean;
    photos: string[]; features: string[];
  };
  attributes: Record<string, string | number | boolean | string[]>;
};

// System slots the database requires a real value for: the CORE taxonomy
// (universal across vehicle types). Linked CUSTOM slots fall back to column
// defaults when unassigned, so unassigning one never bricks saving.
const DB_REQUIRED_BINDINGS = new Set([
  "make", "model", "year", "priceZmw", "mileageKm"
]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === "on" || v === "1" || v === 1;
}

function checkSelect(field: AssignedField, value: string): string {
  if (value && field.options.length > 0 && !field.options.includes(value)) {
    return `${field.label} must be one of: ${field.options.join(", ")}.`;
  }
  return "";
}

function checkNumber(field: AssignedField, n: number | null, lo: number, hi: number): string {
  if (n === null || !Number.isInteger(n)) return `${field.label} must be a whole number.`;
  const min = field.minValue ?? lo;
  const max = field.maxValue ?? hi;
  if (n < min || n > max) return `${field.label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`;
  return "";
}

export function validateListing(
  json: Record<string, unknown>,
  typeName: string,
  assigned: AssignedField[],
  existingAttributes: Record<string, unknown> = {},
  maxPhotos: number = MAX_PHOTOS
): { error?: string; data?: ValidatedListing } {
  const byBinding = new Map<string, AssignedField>();
  for (const f of assigned) {
    if (f.binding && !byBinding.has(f.binding)) byBinding.set(f.binding, f);
  }

  const missingRequired = Array.from(DB_REQUIRED_BINDINGS).filter((b) => !byBinding.has(b));
  if (missingRequired.length > 0) {
    return { error: `“${typeName}” is missing a required listing field. Assign it under Vehicle Config → Form fields.` };
  }

  const out: ValidatedListing["system"] = {
    make: "", model: "", variant: "", year: new Date().getFullYear(), priceZmw: 0, mileageKm: 0,
    transmission: "MANUAL", fuel: "PETROL", bodyType: "", drivetrain: "", condition: "USED",
    chassisNo: "", color: "", location: "", seats: 0, serviceHistory: "UNKNOWN",
    status: "DRAFT", isFeatured: false, photos: [], features: []
  };

  // Required-but-unassigned system slots that have safe defaults.

  const fail = (message: string): { error: string } => ({ error: message });

  // make / model / variant / chassis / color / body / location
  const slots: [string, number, number, string][] = [
    ["make", 2, 40, ""], ["model", 1, 40, ""], ["variant", 0, 60, ""],
    ["bodyType", 2, 30, "Hatchback"], ["chassisNo", 0, 17, ""], ["color", 0, 30, ""], ["location", 0, 60, ""]
  ];
  const got: Record<string, string> = {};
  for (const [binding, min, max, fallback] of slots) {
    const field = byBinding.get(binding);
    const v = str(json[binding]);
    if (!field) {
      // Not on this type's form: keep a valid submitted value (e.g. kept
      // while switching types), otherwise fall back to the column default.
      got[binding] = v && v.length >= min && v.length <= max ? v : fallback;
      continue;
    }
    if (!v) {
      if (field.required && min > 0) return fail(`${field.label} is required.`);
      got[binding] = fallback;
      continue;
    }
    if (v.length < min || v.length > max) {
      return fail(min > 0 ? `${field.label} must be ${min}–${max} characters.` : `${field.label} must be ${max} characters or less.`);
    }
    // Dynamic vocabularies (make, model, location) accept any value —
    // options come live from inventory plus free "Other" entries.
    if (!field.dynamic) {
      const sel = checkSelect(field, v);
      if (sel) return fail(sel);
    }
    got[binding] = v;
  }
  out.make = got.make; out.model = got.model; out.variant = got.variant;
  out.bodyType = got.bodyType; out.chassisNo = got.chassisNo; out.color = got.color; out.location = got.location;
  if (!out.make) return fail("Make is required.");
  if (!out.model) return fail("Model is required.");

  // numbers: year / price / mileage / seats
  const numSlots: [string, number, number, number][] = [
    ["year", 1990, 2027, new Date().getFullYear()],
    ["priceZmw", 1000, 50_000_000, 0],
    ["mileageKm", 0, 2_000_000, 0],
    ["seats", 1, 60, 0]
  ];
  const gotN: Record<string, number> = {};
  for (const [binding, lo, hi, fallback] of numSlots) {
    const field = byBinding.get(binding)!;
    const raw = json[binding];
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
    if (empty) {
      if (field.required) return fail(`${field.label} is required.`);
      gotN[binding] = fallback;
      continue;
    }
    const n = num(raw);
    const err = checkNumber(field, n, lo, hi);
    if (err) return fail(err);
    gotN[binding] = n!;
  }
  out.year = gotN.year; out.priceZmw = gotN.priceZmw; out.mileageKm = gotN.mileageKm; out.seats = gotN.seats;

  // enum-ish selects with fixed vocabularies
  const vocab: Record<string, [string, string[]]> = {
    transmission: ["Transmission", ["MANUAL", "AUTOMATIC"]],
    fuel: ["Fuel", ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"]],
    condition: ["Condition", ["NEW", "USED", "DEMO"]],
    drivetrain: ["Drivetrain", ["4x2", "4x4", "AWD", "FWD", "RWD"]],
    serviceHistory: ["Service history", ["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"]]
  };
  const gotV: Record<string, string> = {};
  for (const [binding, [label, allowed]] of Object.entries(vocab)) {
    const field = byBinding.get(binding);
    const v = str(json[binding]);
    if (!field) {
      gotV[binding] = allowed.includes(v) ? v : binding === "serviceHistory" ? "UNKNOWN" : "";
      continue;
    }
    if (!v) {
      if (field.required) return fail(`${field.label} is required.`);
      gotV[binding] = binding === "serviceHistory" ? "UNKNOWN" : "";
      continue;
    }
    const pool = field.options.length > 0 ? field.options : allowed;
    if (!pool.includes(v)) return fail(`${field.label || label} must be one of: ${pool.join(", ")}.`);
    gotV[binding] = v;
  }
  // Enum columns need valid members even on degenerate configs (unassigned
  // required slots are blocked above; these fallbacks only cover optional).
  out.transmission = gotV.transmission === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL";
  out.fuel = (["PETROL", "DIESEL", "HYBRID", "ELECTRIC"] as const).includes(gotV.fuel as never)
    ? (gotV.fuel as ValidatedListing["system"]["fuel"])
    : "PETROL";
  out.condition = (["NEW", "USED", "DEMO"] as const).includes(gotV.condition as never)
    ? (gotV.condition as ValidatedListing["system"]["condition"])
    : "USED";
  out.drivetrain = gotV.drivetrain;
  out.serviceHistory = (["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"] as const).includes(gotV.serviceHistory as never)
    ? (gotV.serviceHistory as ValidatedListing["system"]["serviceHistory"])
    : "UNKNOWN";

  // listing-level fields (not type-configurable)
  const statusRaw = str(json.status).toUpperCase();
  out.status = (["DRAFT", "PUBLISHED", "BLOCKED", "SOLD"] as const).includes(statusRaw as never)
    ? (statusRaw as ValidatedListing["system"]["status"])
    : "DRAFT";
  out.isFeatured = bool(json.isFeatured);
  const photos = Array.isArray(json.photos) ? json.photos : [];
  if (photos.length > maxPhotos) return { error: `Too many photos — maximum ${maxPhotos}.` };
  for (const p of photos) {
    if (typeof p !== "string" || !(p.startsWith("/") || p.startsWith("http://") || p.startsWith("https://"))) {
      return { error: "One or more photos has an invalid URL." };
    }
  }
  out.photos = photos as string[];
  const features = Array.isArray(json.features) ? json.features : [];
  if (features.length > 20) return { error: "Too many features — maximum 20, one per line." };
  for (const f of features) {
    if (typeof f !== "string" || f.length > 60) return { error: "Each feature must be 60 characters or less." };
  }
  out.features = features as string[];

  // custom attributes keyed by stable field key. Values for fields no longer
  // assigned to this type are preserved (edits must not wipe data the form
  // no longer shows); assigned fields overwrite with freshly validated values.
  const rawAttrs = (json.attributes ?? {}) as Record<string, unknown>;
  const assignedCustomKeys = new Set(assigned.filter((f) => !f.binding).map((f) => f.key));
  const attributes: Record<string, string | number | boolean | string[]> = {};
  for (const [k, v] of Object.entries(existingAttributes)) {
    if (assignedCustomKeys.has(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") attributes[k] = v;
    if (Array.isArray(v) && v.every((x): x is string => typeof x === "string")) attributes[k] = v;
  }
  for (const field of assigned) {
    if (field.binding) continue;
    const raw = rawAttrs[field.key];
    const emptyArray = Array.isArray(raw) && raw.length === 0;
    const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "") || emptyArray;
    if (empty) {
      if (field.required) return fail(`${field.label} is required.`);
      if (field.kind === "BOOLEAN") attributes[field.key] = false;
      if (field.kind === "MULTI_SELECT") attributes[field.key] = [];
      continue;
    }
    switch (field.kind) {
      case "TEXT": {
        const v = str(raw);
        if (v.length > 200) return fail(`${field.label} must be 200 characters or less.`);
        attributes[field.key] = v;
        break;
      }
      case "LONG_TEXT": {
        const v = str(raw);
        if (v.length > 2000) return fail(`${field.label} must be 2000 characters or less.`);
        attributes[field.key] = v;
        break;
      }
      case "NUMBER": {
        const n = num(raw);
        if (n === null) return fail(`${field.label} must be a number.`);
        const min = field.minValue ?? Number.MIN_SAFE_INTEGER;
        const max = field.maxValue ?? Number.MAX_SAFE_INTEGER;
        if (n < min || n > max) return fail(`${field.label} must be between ${min} and ${max}.`);
        attributes[field.key] = n;
        break;
      }
      case "SELECT": {
        const v = str(raw);
        if (field.options.length > 0 && !field.options.includes(v)) {
          return fail(`${field.label} must be one of: ${field.options.join(", ")}.`);
        }
        if (v.length > 120) return fail(`${field.label} must be 120 characters or less.`);
        attributes[field.key] = v;
        break;
      }
      case "MULTI_SELECT": {
        const list = (Array.isArray(raw) ? raw : [raw])
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter((x) => x.length > 0);
        const picked: string[] = [];
        for (const x of list) {
          if (!picked.includes(x)) picked.push(x);
        }
        if (picked.length > 20) return fail(`${field.label} allows at most 20 selections.`);
        if (field.options.length > 0) {
          const bad = picked.find((x) => !field.options.includes(x));
          if (bad) return fail(`${field.label} must only use: ${field.options.join(", ")}.`);
        }
        const tooLong = picked.find((x) => x.length > 120);
        if (tooLong) return fail(`${field.label} entries must be 120 characters or less.`);
        attributes[field.key] = picked;
        break;
      }
      case "BOOLEAN": {
        attributes[field.key] = bool(raw);
        break;
      }
      case "DATE": {
        const v = str(raw);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
          return fail(`${field.label} must be a valid date.`);
        }
        attributes[field.key] = v;
        break;
      }
    }
  }

  return { data: { vehicleTypeId: "", system: out, attributes } };
}

/** Listing columns an option rename can propagate to. */const RENAMEABLE_COLUMNS: Record<string, "make" | "model" | "variant" | "bodyType" | "drivetrain" | "chassisNo" | "color" | "location" | "transmission" | "fuel" | "condition" | "serviceHistory"> = {
  make: "make",
  model: "model",
  variant: "variant",
  bodyType: "bodyType",
  drivetrain: "drivetrain",
  chassisNo: "chassisNo",
  color: "color",
  location: "location",
  transmission: "transmission",
  fuel: "fuel",
  condition: "condition",
  serviceHistory: "serviceHistory"
};

export function renameableColumn(binding: string | null): string | null {
  if (!binding) return null;
  return RENAMEABLE_COLUMNS[binding] ?? null;
}

/** How many listings currently carry this exact option value. */
export async function countOptionUsage(binding: string, value: string): Promise<number> {
  const col = renameableColumn(binding);
  if (!col) return 0;
  try {
    return await prisma.car.count({ where: { [col]: value } });
  } catch (e: unknown) {
    // Legacy junk values predate strict validation and are unqueryable on
    // enum columns — treat as unused rather than failing the rename.
    if (e instanceof Error && e.name === "PrismaClientValidationError") return 0;
    throw e;
  }
}

/**
 * Rename an option value across all listings carrying it. Returns the
 * number of listings updated.
 */
export async function renameOptionEverywhere(binding: string, from: string, to: string): Promise<number> {
  const col = renameableColumn(binding);
  if (!col) return 0;
  try {
    const r = await prisma.car.updateMany({ where: { [col]: from }, data: { [col]: to } });
    return r.count;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "PrismaClientValidationError") return 0;
    throw e;
  }
}

/**
 * Universal shared-list convergence: every valid option value on a saved
 * listing that isn't already in its field's shared list is appended to it
 * (first-seen order, identity-deduped so codes ≡ labels ≡ case variants).
 * Strict bindings are natural no-ops (unseen values can't validate); dynamic
 * and free-string fields are where it bites. Callers must invoke this only
 * after the listing itself saved — absorption failures must never fail saves.
 */
export async function absorbObservedOptions(
  assigned: AssignedField[],
  system: ValidatedListing["system"],
  attributes: Record<string, string | number | boolean | string[]>
): Promise<void> {
  const sys = system as unknown as Record<string, unknown>;
  const optionFields = assigned.filter((f) => hasOptionsKind(f.kind));
  if (optionFields.length === 0) return;
  const libs = await prisma.formField.findMany({
    where: { id: { in: optionFields.map((f) => f.fieldId) } },
    select: { id: true, key: true, binding: true, options: true }
  });
  const byId = new Map(libs.map((l) => [l.id, l]));
  for (const field of optionFields) {
    const lib = byId.get(field.fieldId);
    if (!lib) continue;
    const key = lib.binding ?? lib.key;
    const raw = lib.binding ? sys[lib.binding] : attributes[lib.key];
    const seen: string[] = [];
    const candidates = Array.isArray(raw) ? raw : [raw];
    for (const x of candidates) {
      const s = typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "";
      if (!s) continue;
      if (!seen.some((v) => optionIdentity(key, v) === optionIdentity(key, s))) seen.push(s);
    }
    if (seen.length === 0) continue;
    const base = (lib.options as unknown as string[]) ?? [];
    const missing = seen.filter(
      (v) => !base.some((b) => optionIdentity(key, b) === optionIdentity(key, v))
    );
    if (missing.length === 0) continue;
    await prisma.formField.update({
      where: { id: lib.id },
      data: { options: [...base, ...missing] }
    });
  }
}
