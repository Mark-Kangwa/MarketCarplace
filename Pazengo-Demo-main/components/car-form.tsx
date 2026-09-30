"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_PHOTOS, DRIVETRAIN_OPTIONS, YEAR_OPTIONS, SERVICE_HISTORY_OPTIONS, displayOption } from "@/lib/validators";
import { ZAMBIA_PROVINCES, ZAMBIA_PROVINCE_TOWNS, isListedTown, provinceOf } from "@/lib/zambia";
import type { AssignedField, VehicleTypeRef } from "@/lib/vehicle-validation";

const OTHER_MAKE = "__other";
const OTHER_MODEL = "__other_model";
const OTHER_LOCATION = "__other";

const FALLBACK_SELECTS: Record<string, string[]> = {
  transmission: ["MANUAL", "AUTOMATIC"],
  fuel: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"],
  bodyType: ["Hatchback", "Sedan", "SUV", "Bakkie", "Coupe", "Van"],
  condition: ["NEW", "USED", "DEMO"],
  drivetrain: [...DRIVETRAIN_OPTIONS],
  seats: ["2", "4", "5", "7", "8", "9", "14", "16"]
};

type Initial = Record<string, string | number | string[] | boolean | Record<string, unknown> | undefined>;

function strOf(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

function initialFeatured(initial?: Initial): boolean {
  return initial?.isFeatured === true;
}

function initialPhotos(initial?: Initial): string[] {
  const v = initial?.photos;
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string" && s.length > 0);
  const single = initial?.photoUrl;
  if (typeof single === "string" && single.length > 0) return [single];
  return [];
}

function initialFeatures(initial?: Initial): string {
  const v = initial?.features;
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).join("\n");
  return "";
}

const MAX_FEATURES = 20;
const MAX_FEATURE_LENGTH = 60;

function parseFeaturesText(text: string): { features: string[]; error: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-•*]\s+/, ""))
    .filter((l) => l.length > 0);
  if (lines.length > MAX_FEATURES) {
    return { features: [], error: `Too many features — maximum ${MAX_FEATURES}, one per line.` };
  }
  const tooLong = lines.find((l) => l.length > MAX_FEATURE_LENGTH);
  if (tooLong) {
    return { features: [], error: `Each feature must be ${MAX_FEATURE_LENGTH} characters or less: "${tooLong.slice(0, 40)}…"` };
  }
  return { features: lines, error: "" };
}

const SYSTEM_SLOTS = [
  "make", "model", "variant", "year", "priceZmw", "mileageKm", "transmission",
  "fuel", "bodyType", "drivetrain", "condition", "chassisNo", "color",
  "location", "seats", "serviceHistory", "status"
];

export default function CarForm(props: {
  initial?: Initial;
  id?: string;
  makes?: string[];
  modelsByMake?: Record<string, string[]>;
  vehicleTypes: VehicleTypeRef[];
  assignments: Record<string, AssignedField[]>;
  /** Curated library makes (unioned with in-stock makes in the dropdown). */
  libraryMakes?: string[];
  /** Curated library towns + in-stock locations shown under “More places”. */
  libraryLocations?: string[];
  inventoryLocations?: string[];
  maxPhotos?: number;
  /** User mode: posts to the frontend listings API, hides admin controls. */
  mode?: "admin" | "user";
  /**
   * Wizard mode: instead of POSTing, hands the assembled payload to the
   * caller (sell flow stores it and continues to checkout).
   */
  intercept?: (body: Record<string, unknown>) => void;
  submitLabel?: string;
}): JSX.Element {
  const { initial, id, makes, modelsByMake, vehicleTypes, assignments } = props;
  const userMode = props.mode === "user";
  const submitUrl = id
    ? userMode ? `/api/my-listings/${id}` : `/api/admin/cars/${id}`
    : userMode ? "/api/my-listings" : "/api/admin/cars";
  const uploadUrl = userMode ? "/api/uploads" : "/api/admin/uploads";  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(() => initialPhotos(initial));
  const [featuresText, setFeaturesText] = useState<string>(() => initialFeatures(initial));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const initialTypeId = typeof initial?.vehicleTypeId === "string" && vehicleTypes.some((t) => t.id === initial.vehicleTypeId)
    ? (initial.vehicleTypeId as string)
    : (vehicleTypes[0]?.id ?? "");
  const [typeId, setTypeId] = useState<string>(initialTypeId);
  const fields = assignments[typeId] ?? [];
  const typeName = vehicleTypes.find((t) => t.id === typeId)?.name ?? "Listing";

  // Controlled values for every system slot + custom text-ish field, keyed by
  // binding (system) or field key (custom). Values survive type switches.
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const slot of SYSTEM_SLOTS) v[slot] = strOf(initial?.[slot]);
    const attrs = (initial?.attributes ?? {}) as Record<string, unknown>;
    for (const [k, val] of Object.entries(attrs)) {
      if (typeof val === "string" || typeof val === "number") v[`attr.${k}`] = String(val);
    }
    return v;
  });
  const [bools, setBools] = useState<Record<string, boolean>>(() => {
    const b: Record<string, boolean> = {};
    const attrs = (initial?.attributes ?? {}) as Record<string, unknown>;
    for (const [k, val] of Object.entries(attrs)) {
      if (typeof val === "boolean") b[k] = val;
    }
    return b;
  });
  const [multis, setMultis] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    const attrs = (initial?.attributes ?? {}) as Record<string, unknown>;
    for (const [k, val] of Object.entries(attrs)) {
      if (Array.isArray(val)) m[k] = val.filter((x): x is string => typeof x === "string");
    }
    return m;
  });

  function toggleMulti(fieldKey: string, option: string): void {
    setMultis((prev) => {
      const cur = prev[fieldKey] ?? [];
      return {
        ...prev,
        [fieldKey]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option]
      };
    });
  }

  function setVal(key: string, value: string): void {
    setVals((prev) => ({ ...prev, [key]: value }));
  }

  const photoCap = props.maxPhotos ?? MAX_PHOTOS;

  function union(...lists: (string[] | undefined)[]): string[] {
    const out: string[] = [];
    for (const list of lists) {
      for (const v of list ?? []) {
        const t = v.trim();
        if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
      }
    }
    return out;
  }

  // Curated library values unioned with what's in stock — what you manage
  // under Field options is what sellers see here.
  const makeList = union(makes, props.libraryMakes);
  const morePlaces = union(props.libraryLocations, props.inventoryLocations).filter((t) => !isListedTown(t));
  const initialMake = typeof initial?.make === "string" ? initial.make : "";
  const [makeChoice, setMakeChoice] = useState<string>(() =>
    initialMake && makeList.includes(initialMake) ? initialMake : initialMake ? OTHER_MAKE : ""
  );
  const [customMake, setCustomMake] = useState<string>(() =>
    initialMake && !makeList.includes(initialMake) ? initialMake : ""
  );
  const initialModel = typeof initial?.model === "string" ? initial.model : "";
  const initialModelList = (modelsByMake?.[initialMake] ?? []).filter((m) => m.trim().length > 0);
  const [modelChoice, setModelChoice] = useState<string>(() =>
    initialModel && initialModelList.includes(initialModel) ? initialModel : initialModel ? OTHER_MODEL : ""
  );
  const [customModel, setCustomModel] = useState<string>(() =>
    initialModel && !initialModelList.includes(initialModel) ? initialModel : ""
  );

  const effectiveMake = makeChoice === OTHER_MAKE ? customMake.trim() : makeChoice;
  const modelList = ((modelsByMake?.[effectiveMake] ?? []) as string[]).filter((m) => m.trim().length > 0);

  function handleMakeChange(v: string): void {
    setMakeChoice(v);
    const eff = v === OTHER_MAKE ? customMake.trim() : v;
    const list = (modelsByMake?.[eff] ?? []) as string[];
    setModelChoice((prev) => (prev && prev !== OTHER_MODEL && !list.includes(prev) ? "" : prev));
  }
  const initialLocation = typeof initial?.location === "string" ? initial.location : "";
  const [locationChoice, setLocationChoice] = useState<string>(() =>
    initialLocation && isListedTown(initialLocation) ? initialLocation : initialLocation ? OTHER_LOCATION : ""
  );
  const [customLocation, setCustomLocation] = useState<string>(() =>
    initialLocation && !isListedTown(initialLocation) ? initialLocation : ""
  );

  async function onFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setError("");
    const remaining = photoCap - photos.length;
    if (remaining <= 0) {
      setError(`Photo gallery is full — maximum ${photoCap} photos. Remove one to add another.`);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} allowed (maximum ${photoCap}).`);
    }
    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append("files", f));
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Upload failed. Use JPG, PNG or WebP under 5MB.");
        return;
      }
      const urls = Array.isArray(json.urls) ? (json.urls as string[]) : [];
      setPhotos((prev) => [...prev, ...urls].slice(0, photoCap));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(url: string): void {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function movePhoto(from: number, to: number): void {
    if (from === to) return;
    setPhotos((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function onThumbDrop(e: React.DragEvent, to: number): void {
    e.preventDefault();
    if (dragIndex.current !== null) movePhoto(dragIndex.current, to);
    dragIndex.current = null;
    setOverIndex(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    body.vehicleTypeId = typeId;
    body.make = makeChoice === OTHER_MAKE ? customMake.trim() : makeChoice;
    body.model = modelChoice === OTHER_MODEL
      ? customModel.trim()
      : modelList.includes(modelChoice)
        ? modelChoice
        : customModel.trim() || modelChoice;
    body.location = locationChoice === OTHER_LOCATION ? customLocation.trim() : locationChoice;
    for (const slot of SYSTEM_SLOTS) {
      if (slot === "make" || slot === "model" || slot === "location") continue;
      body[slot] = vals[slot] ?? "";
    }
    body.status = fd.get("status") ?? vals.status ?? "DRAFT";
    body.isFeatured = fd.get("isFeatured") === "on";
    body.photos = photos;
    const parsed = parseFeaturesText(featuresText);
    if (parsed.error) {
      setError(parsed.error);
      setBusy(false);
      return;
    }
    body.features = parsed.features;
    const attributes: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.binding) continue;
      if (f.kind === "BOOLEAN") {
        attributes[f.key] = bools[f.key] ?? false;
      } else if (f.kind === "MULTI_SELECT") {
        attributes[f.key] = multis[f.key] ?? [];
      } else {
        attributes[f.key] = vals[`attr.${f.key}`] ?? "";
      }
    }
    body.attributes = attributes;
    if (props.intercept) {
      setBusy(false);
      props.intercept(body);
      return;
    }
    const res = await fetch(submitUrl, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save. Check the chassis number is unique.");
      return;
    }
    // Land where the car now lives: drafts wait in Pending review.
    const landed = userMode
      ? "/my-cars?saved=1"
      : String(body.status ?? "") === "PUBLISHED"
        ? "/admin/inventory/published"
        : "/admin/inventory/pending-review";
    router.push(landed);
    router.refresh();
  }

  if (vehicleTypes.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No vehicle types yet — create one under <a href="/admin/vehicle-config/vehicle-types" className="text-trader underline">Vehicle Config → Vehicle types</a> first.
      </p>
    );
  }

  const seen = new Set<string>();

  function renderField(f: AssignedField): JSX.Element | null {
    if (f.binding) {
      if (seen.has(f.binding)) return null;
      seen.add(f.binding);
    }
    const req = f.required;
    const label = `${f.label}${req ? " *" : ""}`;
    const help = f.help ? <p className="mt-1 text-xs text-gray-500">{f.help}</p> : null;

    if (f.binding === "make") {
      return (
        <div key={f.fieldId}>
          <label htmlFor="makeChoice" className="mb-1 block text-sm font-medium">{label}</label>
          <select id="makeChoice" value={makeChoice} required={req} onChange={(e) => handleMakeChange(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="" disabled>Select make…</option>
            {makeList.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value={OTHER_MAKE}>＋ Other…</option>
          </select>
          {makeChoice === OTHER_MAKE ? (
            <input type="text" value={customMake} required={req} minLength={2} maxLength={40} onChange={(e) => setCustomMake(e.target.value)} placeholder="Enter make, e.g. GWM" aria-label="Custom make" className="mt-2 w-full rounded border border-line px-3 py-2 text-sm" />
          ) : null}
          {help}
        </div>
      );
    }
    if (f.binding === "model") {
      return (
        <div key={f.fieldId}>
          <label htmlFor="modelChoice" className="mb-1 block text-sm font-medium">{label}</label>
          <select id="modelChoice" value={modelChoice} required={req} onChange={(e) => setModelChoice(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="" disabled>{effectiveMake ? `Select ${effectiveMake} model…` : "Select make first…"}</option>
            {modelList.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value={OTHER_MODEL}>＋ Other…</option>
          </select>
          {modelChoice === OTHER_MODEL ? (
            <input type="text" value={customModel} required={req} minLength={1} maxLength={40} onChange={(e) => setCustomModel(e.target.value)} placeholder="Enter model, e.g. Hilux" aria-label="Custom model" className="mt-2 w-full rounded border border-line px-3 py-2 text-sm" />
          ) : null}
          {help}
        </div>
      );
    }
    if (f.binding === "location") {
      return (
        <div key={f.fieldId}>
          <label htmlFor="locationChoice" className="mb-1 block text-sm font-medium">{label}</label>
          <select id="locationChoice" value={locationChoice} required={req} onChange={(e) => setLocationChoice(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="" disabled>Select location…</option>
            {ZAMBIA_PROVINCES.map((p) => (
              <optgroup key={p} label={`${p} Province`}>
                {ZAMBIA_PROVINCE_TOWNS[p].map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
            {morePlaces.length > 0 ? (
              <optgroup label="More places">
                {morePlaces.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ) : null}
            <option value={OTHER_LOCATION}>＋ Other…</option>
          </select>
          {locationChoice && locationChoice !== OTHER_LOCATION && provinceOf(locationChoice) ? (
            <p className="mt-1 text-xs text-gray-500">→ {provinceOf(locationChoice)} Province</p>
          ) : null}
          {locationChoice === OTHER_LOCATION ? (
            <input type="text" value={customLocation} required={req} minLength={2} maxLength={60} onChange={(e) => setCustomLocation(e.target.value)} placeholder="Enter town, e.g. Chisamba" aria-label="Custom location" className="mt-2 w-full rounded border border-line px-3 py-2 text-sm" />
          ) : null}
          {help}
        </div>
      );
    }
    if (f.binding === "serviceHistory") {
      const opts = f.options.length > 0 ? f.options : SERVICE_HISTORY_OPTIONS.map((o) => o.value);
      return (
        <div key={f.fieldId}>
          <label htmlFor="serviceHistory" className="mb-1 block text-sm font-medium">{label}</label>
          <select id="serviceHistory" value={vals.serviceHistory || "UNKNOWN"} required={req} onChange={(e) => setVal("serviceHistory", e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            {opts.map((o) => <option key={o} value={o}>{displayOption("serviceHistory", o)}</option>)}
          </select>
          {help}
        </div>
      );
    }
    if (f.binding && ["transmission", "fuel", "bodyType", "condition", "drivetrain", "seats"].includes(f.binding)) {
      const opts = f.options.length > 0 ? f.options : (FALLBACK_SELECTS[f.binding] ?? []);
      // Kind-aware: a linked field switched away from dropdown renders as a
      // plain input; the server still enforces the valid values.
      if (f.kind !== "SELECT") {
        return (
          <div key={f.fieldId}>
            <label htmlFor={f.binding} className="mb-1 block text-sm font-medium">{label}</label>
            <input
              id={f.binding}
              type={f.binding === "seats" ? "number" : "text"}
              value={vals[f.binding] ?? ""} required={req}
              placeholder={opts.slice(0, 6).map((o) => displayOption(f.binding!, o)).join(" / ")}
              onChange={(e) => setVal(f.binding!, e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            {help}
          </div>
        );
      }
      return (
        <div key={f.fieldId}>
          <label htmlFor={f.binding} className="mb-1 block text-sm font-medium">{label}</label>
          <select id={f.binding} value={vals[f.binding] ?? ""} required={req} onChange={(e) => setVal(f.binding!, e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="" disabled>Select…</option>
            {opts.map((o) => <option key={o} value={o}>{displayOption(f.binding!, o)}</option>)}
          </select>
          {help}
        </div>
      );
    }
    if (f.binding === "year") {
      const lo = f.minValue ?? 1990;
      const hi = f.maxValue ?? 2027;
      if (f.kind !== "SELECT") {
        return (
          <div key={f.fieldId}>
            <label htmlFor="year" className="mb-1 block text-sm font-medium">{label}</label>
            <input
              id="year" type="number" value={vals.year ?? ""} required={req}
              min={lo} max={hi}
              onChange={(e) => setVal("year", e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            {help}
          </div>
        );
      }
      const opts = YEAR_OPTIONS.filter((y) => Number(y) >= lo && Number(y) <= hi);
      return (
        <div key={f.fieldId}>
          <label htmlFor="year" className="mb-1 block text-sm font-medium">{label}</label>
          <select id="year" value={vals.year ?? ""} required={req} onChange={(e) => setVal("year", e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="" disabled>Select year…</option>
            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {help}
        </div>
      );
    }
    if (f.binding && ["priceZmw", "mileageKm"].includes(f.binding)) {
      return (
        <div key={f.fieldId}>
          <label htmlFor={f.binding} className="mb-1 block text-sm font-medium">{label}</label>
          <input
            id={f.binding} type="number" value={vals[f.binding] ?? ""} required={req}
            min={f.minValue ?? undefined} max={f.maxValue ?? undefined}
            onChange={(e) => setVal(f.binding!, e.target.value)}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
          {help}
        </div>
      );
    }
    if (f.binding && ["variant", "chassisNo", "color"].includes(f.binding)) {
      // Kind-aware like the other linked selects: a field switched to
      // dropdown renders its effective options; otherwise a text input.
      if (f.kind === "SELECT") {
        return (
          <div key={f.fieldId}>
            <label htmlFor={f.binding} className="mb-1 block text-sm font-medium">{label}</label>
            <select id={f.binding} value={vals[f.binding] ?? ""} required={req} onChange={(e) => setVal(f.binding!, e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
              <option value="" disabled>Select…</option>
              {f.options.map((o) => <option key={o} value={o}>{displayOption(f.binding!, o)}</option>)}
            </select>
            {help}
          </div>
        );
      }
      return (
        <div key={f.fieldId}>
          <label htmlFor={f.binding} className="mb-1 block text-sm font-medium">{label}</label>
          <input id={f.binding} type="text" value={vals[f.binding] ?? ""} required={req} onChange={(e) => setVal(f.binding!, e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
          {help}
        </div>
      );
    }
    // Custom field by kind
    const key = `attr.${f.key}`;
    if (f.kind === "BOOLEAN") {
      return (
        <div key={f.fieldId}>
          <label htmlFor={key} className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-2 text-sm">
            <input id={key} type="checkbox" checked={bools[f.key] ?? false} onChange={(e) => setBools((prev) => ({ ...prev, [f.key]: e.target.checked }))} className="h-4 w-4" />
            <span className="font-medium">{label}</span>
          </label>
          {help}
        </div>
      );
    }
    if (f.kind === "SELECT") {
      return (
        <div key={f.fieldId}>
          <label htmlFor={key} className="mb-1 block text-sm font-medium">{label}</label>
          <select id={key} value={vals[key] ?? ""} required={req} onChange={(e) => setVal(key, e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
            <option value="" disabled>Select…</option>
            {f.options.map((o) => <option key={o} value={o}>{displayOption(f.key, o)}</option>)}
          </select>
          {help}
        </div>
      );
    }
    if (f.kind === "MULTI_SELECT") {
      const picked = multis[f.key] ?? [];
      return (
        <fieldset key={f.fieldId}>
          <legend className="mb-1 block text-sm font-medium">{label}</legend>
          <div className="grid gap-1.5 rounded border border-line p-3 sm:grid-cols-2">
            {f.options.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(o)}
                  onChange={() => toggleMulti(f.key, o)}
                  className="h-4 w-4"
                />
                <span>{displayOption(f.key, o)}</span>
              </label>
            ))}
            {f.options.length === 0 ? <p className="text-xs text-gray-500">No options configured for this field yet.</p> : null}
          </div>
          {help}
        </fieldset>
      );
    }
    if (f.kind === "LONG_TEXT") {
      return (
        <div key={f.fieldId}>
          <label htmlFor={key} className="mb-1 block text-sm font-medium">{label}</label>
          <textarea id={key} value={vals[key] ?? ""} required={req} rows={3} onChange={(e) => setVal(key, e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
          {help}
        </div>
      );
    }
    return (
      <div key={f.fieldId}>
        <label htmlFor={key} className="mb-1 block text-sm font-medium">
          {label}{f.unit ? ` (${f.unit})` : ""}
        </label>
        <input
          id={key}
          type={f.kind === "NUMBER" ? "number" : f.kind === "DATE" ? "date" : "text"}
          value={vals[key] ?? ""} required={req}
          min={f.minValue ?? undefined} max={f.maxValue ?? undefined}
          onChange={(e) => setVal(key, e.target.value)}
          className="w-full rounded border border-line px-3 py-2 text-sm"
        />
        {help}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div>
        <label htmlFor="vehicleTypeId" className="mb-1 block text-sm font-medium">Vehicle type *</label>
        <select id="vehicleTypeId" value={typeId} required onChange={(e) => setTypeId(e.target.value)} className="w-full rounded border border-line bg-lot px-3 py-2 text-sm font-semibold sm:max-w-xs">
          {vehicleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-gray-500">{userMode ? "The fields below match this vehicle type." : `The fields below come from this ${typeName.toLowerCase()}’s form — change them under Vehicle Config → Form fields.`}</p>
      </div>
      {fields.length === 0 ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {userMode
            ? `“${typeName}” has no fields set up yet — please try another type or contact us.`
            : <>“{typeName}” has no fields assigned yet — assign some under <a href={`/admin/vehicle-config/form-fields?type=${vehicleTypes.find((t) => t.id === typeId)?.slug ?? ""}`} className="underline">Vehicle Config → Form fields</a>, or pick another type.</>}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => renderField(f))}
        {userMode ? null : (
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-medium">Status</label>
            <select id="status" name="status" value={vals.status || "DRAFT"} onChange={(e) => setVal("status", e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm">
              <option>DRAFT</option><option>PUBLISHED</option><option>BLOCKED</option><option>SOLD</option>
            </select>
          </div>
        )}
      </div>
      {userMode ? null : (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <label htmlFor="isFeatured" className="flex cursor-pointer items-start gap-2">
            <input id="isFeatured" name="isFeatured" type="checkbox" defaultChecked={initialFeatured(initial)} className="mt-1 h-4 w-4 accent-amber-600" />
            <span>
              <span className="block text-sm font-bold">★ Feature this listing</span>
              <span className="block text-xs text-gray-600">Featured {typeName.toLowerCase()}s show at the top of the homepage under “Sponsored”. Regular listings appear below.</span>
            </span>
          </label>
        </div>
      )}
      <div>
        <label htmlFor="featuresText" className="mb-1 block text-sm font-medium">Features &amp; extras</label>
        <p className="mb-2 text-xs text-gray-500">One feature per line — these appear as checkmarks on the public listing.</p>
        <textarea
          id="featuresText"
          name="featuresText"
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={4}
          placeholder={"Tow bar\nLeather seats\nReverse camera"}
          className="w-full rounded border border-line px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="car-photos" className="mb-1 block text-sm font-medium">Photo gallery ({photos.length} / {photoCap})</label>
        <p className="mb-2 text-xs text-gray-500">Upload JPG, PNG or WebP photos, up to 5MB each. You can add more than 3 — up to {photoCap} per {typeName.toLowerCase()}. Drag photos to reorder — the first photo is the cover shown on cards.</p>
        <input
          ref={fileRef}
          id="car-photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || photos.length >= photoCap}
          onChange={(e) => onFiles(e.target.files)}
          aria-label="Upload listing photos"
          className="block w-full text-sm file:mr-3 file:rounded file:border file:border-line file:bg-lot file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-line disabled:opacity-50"
        />
        {uploading ? <p role="status" className="mt-1 text-xs text-gray-500">Uploading…</p> : null}
        {photos.length > 0 ? (
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((src, i) => (
              <li
                key={`${src}-${i}`}
                draggable
                onDragStart={(e) => {
                  dragIndex.current = i;
                  e.dataTransfer.effectAllowed = "move";
                  try {
                    e.dataTransfer.setData("text/plain", String(i));
                  } catch {
                    /* clipboard types unsupported — index ref is the source of truth */
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverIndex(i);
                }}
                onDragLeave={() => setOverIndex((prev) => (prev === i ? null : prev))}
                onDrop={(e) => onThumbDrop(e, i)}
                onDragEnd={() => {
                  dragIndex.current = null;
                  setOverIndex(null);
                }}
                aria-label={`Photo ${i + 1} of ${photos.length}${i === 0 ? " (cover)" : ""}. Drag to reorder.`}
                className={`group relative cursor-grab overflow-hidden rounded border bg-lot active:cursor-grabbing ${overIndex === i ? "border-trader ring-2 ring-trader" : "border-line"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Uploaded listing photo ${i + 1}`} draggable={false} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                {i === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded bg-asphalt/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Cover
                  </span>
                ) : null}
                <span className="absolute bottom-1 right-1 flex gap-1">
                  {i > 0 ? (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i - 1)}
                      aria-label={`Move photo ${i + 1} left`}
                      title="Move left"
                      className="rounded bg-asphalt/80 px-1.5 py-0.5 text-xs font-bold text-white hover:bg-signal"
                    >
                      ‹
                    </button>
                  ) : null}
                  {i < photos.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i + 1)}
                      aria-label={`Move photo ${i + 1} right`}
                      title="Move right"
                      className="rounded bg-asphalt/80 px-1.5 py-0.5 text-xs font-bold text-white hover:bg-signal"
                    >
                      ›
                    </button>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => removePhoto(src)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded bg-asphalt/80 px-2 py-0.5 text-xs font-bold text-white hover:bg-signal"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded bg-lot p-3 text-xs text-gray-500">No photos yet. Uploaded photos appear here and on the public listing.</p>
        )}
      </div>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy || uploading} className="rounded bg-signal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving…" : props.submitLabel ?? (id ? "Save changes" : userMode ? "Submit my car" : `Add ${typeName.toLowerCase()}`)}</button>
        <a href={userMode ? "/my-cars" : initial?.status === "DRAFT" || !initial ? "/admin/inventory/pending-review" : "/admin/inventory/published"} className="rounded border border-line px-5 py-2.5 text-sm">Cancel</a>
      </div>
    </form>
  );
}
