import type { Prisma } from "@prisma/client";
import { km, zmw } from "./format";
import { serviceHistoryLabel } from "./validators";
import { provinceCanonical, provinceOf, townsIn } from "./zambia";

export const SORT_OPTIONS = [
  { value: "newest", label: "Default: Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "mileage-asc", label: "Mileage: Low to High" },
  { value: "mileage-desc", label: "Mileage: High to Low" },
  { value: "year-desc", label: "Year: Newest to Oldest" },
  { value: "year-asc", label: "Year: Oldest to Newest" }
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "Bakkie", "Coupe", "Van"] as const;
const TRANSMISSIONS = ["MANUAL", "AUTOMATIC"] as const;
const FUELS = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"] as const;
const CONDITIONS = ["NEW", "USED", "DEMO"] as const;
const HISTORIES = ["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"] as const;
const DRIVETRAINS = ["4x2", "4x4", "AWD", "FWD", "RWD"] as const;

/** Case-insensitive match that preserves canonical casing (e.g. "4X2" -> "4x2"). */
function oneOfCaseless(v: string, allowed: readonly string[]): string {
  const up = v.toUpperCase();
  return allowed.find((a) => a.toUpperCase() === up) ?? "";
}

export type SearchFilters = {
  q: string;
  make: string;
  model: string;
  body: string;
  condition: string;
  gearbox: string;
  fuel: string;
  location: string;
  province: string;
  serviceHistory: string;
  drivetrain: string;
  color: string;
  minSeats: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  minYear: number | null;
  maxYear: number | null;
  maxMileage: number | null;
  sort: SortValue;
  page: number;
  /** Custom-field filters keyed by field key (URL param `cf_<key>`). */
  custom: Record<string, string>;
};

/** A custom form field exposed as a marketplace filter (SELECT or Yes/No). */
export type CustomFilterDef = {
  key: string;
  label: string;
  kind: "SELECT" | "BOOLEAN";
  options: string[];
};

/** URL prefix for custom-field filter params, e.g. `cf_engine_size=125`. */
export function customParamKey(key: string): string {
  return `cf_${key}`;
}

type RawParams = Record<string, string | string[] | undefined>;

/**
 * True when the URL carries any search key — even with empty values.
 * HTML GET forms always submit named controls, so clicking Search with an
 * empty field still yields `?body=&make=&q=`. A plain `/` visit has no keys.
 * A lone `page` key does NOT count: `/?page=2` stays in landing mode so the
 * Latest section can paginate without flipping to the sidebar layout.
 */
const SEARCH_KEYS = [
  "q", "make", "model", "body", "condition", "gearbox", "fuel", "location",
  "province", "serviceHistory", "drivetrain", "color", "minSeats", "minPrice", "maxPrice",
  "minYear", "maxYear", "maxMileage", "sort"
] as const;

export function isSearchRequest(sp: RawParams): boolean {
  if (SEARCH_KEYS.some((k) => sp[k] !== undefined)) return true;
  return Object.keys(sp).some((k) => k.startsWith("cf_"));
}

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

function num(v: string, opts: { min: number; max: number }): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[\s,]/g, ""));
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < opts.min || i > opts.max) return null;
  return i;
}

function oneOf(v: string, allowed: readonly string[]): string {
  const up = v.toUpperCase();
  return (allowed as readonly string[]).includes(up) ? up : "";
}

export function parseSearchParams(sp: RawParams, defs: CustomFilterDef[] = []): SearchFilters {
  const sortRaw = first(sp.sort).toLowerCase();
  const sort: SortValue = (SORT_OPTIONS as readonly { value: string }[]).some((o) => o.value === sortRaw)
    ? (sortRaw as SortValue)
    : "newest";
  const pageRaw = Number(first(sp.page));
  const page = Number.isFinite(pageRaw) ? Math.min(500, Math.max(1, Math.floor(pageRaw))) : 1;
  const bodyRaw = first(sp.body);
  const body = (BODY_TYPES as readonly string[]).includes(bodyRaw) ? bodyRaw : "";
  const custom: Record<string, string> = {};
  for (const d of defs) {
    const v = first(sp[customParamKey(d.key)]);
    if (!v) continue;
    if (d.kind === "BOOLEAN") {
      if (v === "Yes" || v === "No") custom[d.key] = v;
    } else if (d.options.includes(v)) {
      custom[d.key] = v;
    }
  }

  return {
    q: first(sp.q).slice(0, 60),
    make: first(sp.make).slice(0, 40),
    model: first(sp.model).slice(0, 40),
    body,
    condition: oneOf(first(sp.condition), CONDITIONS),
    gearbox: oneOf(first(sp.gearbox), TRANSMISSIONS),
    fuel: oneOf(first(sp.fuel), FUELS),
    location: first(sp.location).slice(0, 60),
    province: provinceCanonical(first(sp.province)),
    serviceHistory: oneOf(first(sp.serviceHistory), HISTORIES),
    drivetrain: oneOfCaseless(first(sp.drivetrain), DRIVETRAINS),
    color: first(sp.color).slice(0, 30),
    minSeats: num(first(sp.minSeats), { min: 1, max: 60 }),
    minPrice: num(first(sp.minPrice), { min: 0, max: 50_000_000 }),
    maxPrice: num(first(sp.maxPrice), { min: 0, max: 50_000_000 }),
    minYear: num(first(sp.minYear), { min: 1990, max: 2027 }),
    maxYear: num(first(sp.maxYear), { min: 1990, max: 2027 }),
    maxMileage: num(first(sp.maxMileage), { min: 0, max: 2_000_000 }),
    sort,
    page,
    custom
  };
}

export function hasActiveFilters(f: SearchFilters): boolean {
  return Boolean(
    f.q ||
      f.make ||
      f.model ||
      f.body ||
      f.condition ||
      f.gearbox ||
      f.fuel ||
      f.location ||
      f.province ||
      f.serviceHistory ||
      f.drivetrain ||
      f.color ||
      f.minSeats !== null ||
      f.minPrice !== null ||
      f.maxPrice !== null ||
      f.minYear !== null ||
      f.maxYear !== null ||
      f.maxMileage !== null ||
      Object.keys(f.custom).length > 0
  );
}

/** Sold listings stay visible for this long after being marked sold. */
export const SOLD_GRACE_DAYS = 5;

export function soldGraceCutoff(from: Date = new Date(), days: number = SOLD_GRACE_DAYS): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Public visibility: published cars plus recently-sold ones (SOLD with a
 * fresh soldAt). Expired sold cars vanish publicly but stay in admin.
 */
export function visibleCarWhere(days: number = SOLD_GRACE_DAYS): Prisma.CarWhereInput {
  return {
    OR: [
      { status: "PUBLISHED" },
      { status: "SOLD", soldAt: { gte: soldGraceCutoff(new Date(), days) } }
    ]
  };
}

/**
 * Package expiry: listings whose paid/free window lapsed vanish publicly
 * but stay in admin. Admin stock (expiresAt null) never expires. Merge into
 * AND via addAnd() — never assign where.AND directly (keyword tokens own it).
 */
export function notExpiredWhere(now: Date = new Date()): Prisma.CarWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Append a clause to where.AND without clobbering existing entries. */
export function addAnd(where: Prisma.CarWhereInput, clause: Prisma.CarWhereInput): Prisma.CarWhereInput {
  const rest = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  where.AND = [...rest, clause];
  return where;
}

/** True while a sold car is still inside its public grace window. */
export function isSoldVisible(soldAt: Date | string | null | undefined, now: Date = new Date(), days: number = SOLD_GRACE_DAYS): boolean {
  if (!soldAt) return false;
  return new Date(soldAt).getTime() >= soldGraceCutoff(now, days).getTime();
}

export function buildCarWhere(f: SearchFilters, opts?: { exclude?: "make" | "model" }, soldDays: number = SOLD_GRACE_DAYS): Prisma.CarWhereInput {
  const where: Prisma.CarWhereInput = visibleCarWhere(soldDays);
  addAnd(where, notExpiredWhere());
  if (f.q) {
    // Tokenize: every word must match at least one field (AND of per-token ORs),
    // so "BMW Ford" matches make=BMW + model=Ford, "Toyota Hilux" matches both Hiluxes.
    const words = f.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    where.AND = words.map((t) => ({
      OR: [
        { make: { contains: t, mode: "insensitive" } },
        { model: { contains: t, mode: "insensitive" } },
        { variant: { contains: t, mode: "insensitive" } },
        { color: { contains: t, mode: "insensitive" } },
        { location: { contains: t, mode: "insensitive" } },
        { drivetrain: { contains: t, mode: "insensitive" } },
        { chassisNo: { contains: t, mode: "insensitive" } }
      ]
    }));
  }
  if (f.make && opts?.exclude !== "make") where.make = { equals: f.make, mode: "insensitive" };
  if (f.model && opts?.exclude !== "model") where.model = { equals: f.model, mode: "insensitive" };
  if (f.body) where.bodyType = f.body;
  if (f.condition) where.condition = f.condition as never;
  if (f.gearbox) where.transmission = f.gearbox as never;
  if (f.fuel) where.fuel = f.fuel as never;
  const geo: Prisma.CarWhereInput[] = [];
  if (f.location) geo.push({ location: { equals: f.location, mode: "insensitive" } });
  if (f.province) {
    // Derived geography: a province matches every town mapped to it.
    // With a city also set, both apply (AND) — a contradictory pair
    // correctly yields no matches.
    geo.push({ location: { in: townsIn(f.province), mode: "insensitive" } });
  }
  if (geo.length === 1) {
    Object.assign(where, geo[0]);
  } else if (geo.length > 1) {
    const rest = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...rest, ...geo];
  }
  if (f.serviceHistory) where.serviceHistory = f.serviceHistory as never;
  if (f.drivetrain) where.drivetrain = f.drivetrain;
  if (f.color) where.color = { equals: f.color, mode: "insensitive" };
  if (f.minSeats !== null) where.seats = { gte: f.minSeats };
  if (f.minPrice !== null || f.maxPrice !== null) {
    // Guard against inverted ranges: return impossible range instead of swapping silently
    if (f.minPrice !== null && f.maxPrice !== null && f.minPrice > f.maxPrice) {
      where.priceZmw = { gte: 1, lt: 0 };
    } else {
      where.priceZmw = {
        ...(f.minPrice !== null ? { gte: f.minPrice } : {}),
        ...(f.maxPrice !== null ? { lte: f.maxPrice } : {})
      };
    }
  }
  if (f.minYear !== null || f.maxYear !== null) {
    if (f.minYear !== null && f.maxYear !== null && f.minYear > f.maxYear) {
      where.year = { gte: 3000, lt: 2000 };
    } else {
      where.year = {
        ...(f.minYear !== null ? { gte: f.minYear } : {}),
        ...(f.maxYear !== null ? { lte: f.maxYear } : {})
      };
    }
  }
  if (f.maxMileage !== null) where.mileageKm = { lte: f.maxMileage };
  const customClauses: Prisma.CarWhereInput[] = [];
  for (const [key, value] of Object.entries(f.custom)) {
    // Custom values live in the listing's attributes JSON: exact match on the
    // field key. Yes/No maps back to the stored boolean.
    const equals: string | boolean = value === "Yes" ? true : value === "No" ? false : value;
    customClauses.push({ attributes: { path: [key], equals } });
  }
  if (customClauses.length > 0) {
    const rest = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...rest, ...customClauses];
  }
  return where;
}

export function regularOrderBy(sort: SortValue): Prisma.CarOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { priceZmw: "asc" };
    case "price-desc":
      return { priceZmw: "desc" };
    case "mileage-asc":
      return { mileageKm: "asc" };
    case "mileage-desc":
      return { mileageKm: "desc" };
    case "year-desc":
      return { year: "desc" };
    case "year-asc":
      return { year: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

export function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Human-readable summary, e.g. "Toyota Hilux · Max K500 000 · Lusaka". */
export function describeSearch(f: SearchFilters, defs: CustomFilterDef[] = []): string {
  const parts: string[] = [];
  const makeModel = [f.make, f.model].filter(Boolean).join(" ");
  if (f.q) parts.push(`“${f.q}”`);
  if (makeModel) parts.push(makeModel);
  if (f.body) parts.push(f.body);
  if (f.condition) parts.push(f.condition.charAt(0) + f.condition.slice(1).toLowerCase());
  if (f.gearbox) parts.push(f.gearbox.charAt(0) + f.gearbox.slice(1).toLowerCase());
  if (f.fuel) parts.push(f.fuel.charAt(0) + f.fuel.slice(1).toLowerCase());
  if (f.drivetrain) parts.push(f.drivetrain);
  if (f.color) parts.push(f.color);
  if (f.location) parts.push(f.location);
  if (f.province && f.province !== provinceOf(f.location)) parts.push(`${f.province} Province`);
  if (f.serviceHistory && f.serviceHistory !== "UNKNOWN") parts.push(serviceHistoryLabel(f.serviceHistory));
  if (f.minSeats !== null) parts.push(`${f.minSeats}+ seats`);
  if (f.minPrice !== null && f.maxPrice !== null) parts.push(`${zmw(f.minPrice)} – ${zmw(f.maxPrice)}`);
  else if (f.maxPrice !== null) parts.push(`Under ${zmw(f.maxPrice)}`);
  else if (f.minPrice !== null) parts.push(`Over ${zmw(f.minPrice)}`);
  if (f.minYear !== null && f.maxYear !== null) parts.push(`${f.minYear}–${f.maxYear}`);
  else if (f.minYear !== null) parts.push(`${f.minYear}+`);
  else if (f.maxYear !== null) parts.push(`Up to ${f.maxYear}`);
  if (f.maxMileage !== null) parts.push(`Under ${km(f.maxMileage)}`);
  const labelOf = new Map(defs.map((d) => [d.key, d.label]));
  for (const [key, value] of Object.entries(f.custom)) {
    parts.push(`${labelOf.get(key) ?? prettifyKey(key)}: ${value}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "All cars";
}

function prettifyKey(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/**
 * Stable identity for a search — normalized filters minus page/sort, so
 * paging or re-sorting the same search bumps its timestamp instead of
 * spawning duplicate history rows.
 */
export function searchHistoryKey(f: SearchFilters): string {
  return JSON.stringify({
    q: f.q,
    make: f.make,
    model: f.model,
    body: f.body,
    condition: f.condition,
    gearbox: f.gearbox,
    fuel: f.fuel,
    location: f.location,
    province: f.province,
    serviceHistory: f.serviceHistory,
    drivetrain: f.drivetrain,
    color: f.color,
    minSeats: f.minSeats,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minYear: f.minYear,
    maxYear: f.maxYear,
    maxMileage: f.maxMileage,
    custom: f.custom
  });
}
