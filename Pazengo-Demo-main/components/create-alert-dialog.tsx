"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BODY_TYPES, customParamKey, type CustomFilterDef } from "@/lib/search";
import { DRIVETRAIN_OPTIONS, SERVICE_HISTORY_OPTIONS, YEAR_OPTIONS, PRICE_MIN_OPTIONS, PRICE_MAX_OPTIONS, MILEAGE_MAX_OPTIONS, SEAT_MIN_OPTIONS, displayOption } from "@/lib/validators";
import { ZAMBIA_PROVINCES, provinceOf } from "@/lib/zambia";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded border border-line px-3 py-2 text-sm";

export default function CreateAlertDialog({
  makes,
  modelsByMake,
  locations,
  colors,
  customFilters = []
}: {
  makes: { make: string; _count: { make: number } }[];
  modelsByMake: Record<string, string[]>;
  locations: { location: string; _count: { location: number } }[];
  colors: { color: string | null; _count: { color: number } }[];
  customFilters?: CustomFilterDef[];
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(): void {
    setError("");
    setOpen(true);
    // Mount off-canvas first, then transition in on the next frames.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShown(true));
    });
  }

  function hide(): void {
    setShown(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 320);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") hide();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [q, setQ] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [body, setBody] = useState("");
  const [condition, setCondition] = useState("");
  const [gearbox, setGearbox] = useState("");
  const [fuel, setFuel] = useState("");
  const [location, setLocation] = useState("");
  const [province, setProvince] = useState("");
  const [drivetrain, setDrivetrain] = useState("");
  const [minSeats, setMinSeats] = useState("");
  const [color, setColor] = useState("");
  const [serviceHistory, setServiceHistory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});

  const modelOptions = (modelsByMake[make] ?? []) as string[];

  function onMake(v: string): void {
    setMake(v);
    setModel((prev) => {
      const list = (modelsByMake[v] ?? []) as string[];
      return prev && list.includes(prev) ? prev : "";
    });
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const search: Record<string, string> = {
        q: q.trim(),
        make,
        model,
        body,
        condition,
        gearbox,
        fuel,
        location,
        province,
        drivetrain,
        minSeats,
        color,
        serviceHistory,
        minPrice: minPrice.trim(),
        maxPrice: maxPrice.trim(),
        minYear: minYear.trim(),
        maxYear: maxYear.trim(),
        maxMileage: maxMileage.trim()
      };
      for (const d of customFilters) {
        if (custom[d.key]) search[customParamKey(d.key)] = custom[d.key];
      }
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emailAlerts, search })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not create alert.");
        return;
      }
      hide();
      setName("");
      setEmailAlerts(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="rounded bg-signal px-4 py-2 text-sm font-bold text-white hover:brightness-110"
      >
        🔔 Create Alert
      </button>
      {open ? (
        <span
          className={`fixed inset-0 z-[60] flex justify-end motion-safe:transition-opacity motion-safe:duration-300 ${shown ? "bg-asphalt/60" : "bg-asphalt/0"}`}
          onClick={() => hide()}
        >
          <span
            role="dialog"
            aria-modal="true"
            aria-label="Create alert"
            onClick={(e) => e.stopPropagation()}
            className={`ml-auto flex h-full w-full max-w-md flex-col bg-white text-asphalt shadow-xl motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${shown ? "translate-x-0" : "translate-x-full"}`}
          >
            <span className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-bold">Create Alert</span>
              <button type="button" onClick={() => hide()} aria-label="Close" className="rounded px-2 py-1 text-lg font-bold text-gray-500 hover:bg-lot">
                ✕
              </button>
            </span>
            <form onSubmit={onSubmit} className="grid flex-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
              <span className="sm:col-span-2">
                <Field label="Alert name (optional — auto-described if blank)" htmlFor="ca-name">
                  <input id="ca-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Toyota Hilux under K500,000" className={inputCls} />
                </Field>
              </span>
              <Field label="Keywords" htmlFor="ca-q">
                <input id="ca-q" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Make, model, keyword…" className={inputCls} />
              </Field>
              <Field label="Make" htmlFor="ca-make">
                <select id="ca-make" value={make} onChange={(e) => onMake(e.target.value)} className={inputCls}>
                  <option value="">All makes</option>
                  {makes.map((m) => <option key={m.make} value={m.make}>{m.make} ({m._count.make})</option>)}
                </select>
              </Field>
              <Field label="Model" htmlFor="ca-model">
                <select id="ca-model" value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} className={`${inputCls} disabled:opacity-50`}>
                  <option value="">{make ? "All models" : "Select make first"}</option>
                  {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Body type" htmlFor="ca-body">
                <select id="ca-body" value={body} onChange={(e) => setBody(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Min price" htmlFor="ca-minPrice">
                <select id="ca-minPrice" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={inputCls}>
                  <option value="">No min</option>
                  {PRICE_MIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Max price" htmlFor="ca-maxPrice">
                <select id="ca-maxPrice" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={inputCls}>
                  <option value="">No max</option>
                  {PRICE_MAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Min year" htmlFor="ca-minYear">
                <select id="ca-minYear" value={minYear} onChange={(e) => setMinYear(e.target.value)} className={inputCls}>
                  <option value="">No min</option>
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Max year" htmlFor="ca-maxYear">
                <select id="ca-maxYear" value={maxYear} onChange={(e) => setMaxYear(e.target.value)} className={inputCls}>
                  <option value="">No max</option>
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Max mileage" htmlFor="ca-maxMileage">
                <select id="ca-maxMileage" value={maxMileage} onChange={(e) => setMaxMileage(e.target.value)} className={inputCls}>
                  <option value="">No max</option>
                  {MILEAGE_MAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Gearbox" htmlFor="ca-gearbox">
                <select id="ca-gearbox" value={gearbox} onChange={(e) => setGearbox(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  <option value="MANUAL">{displayOption("transmission", "MANUAL")}</option>
                  <option value="AUTOMATIC">{displayOption("transmission", "AUTOMATIC")}</option>
                </select>
              </Field>
              <Field label="Fuel" htmlFor="ca-fuel">
                <select id="ca-fuel" value={fuel} onChange={(e) => setFuel(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {["PETROL", "DIESEL", "HYBRID", "ELECTRIC"].map((v) => <option key={v} value={v}>{displayOption("fuel", v)}</option>)}
                </select>
              </Field>
              <Field label="Condition" htmlFor="ca-condition">
                <select id="ca-condition" value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {["NEW", "USED", "DEMO"].map((v) => <option key={v} value={v}>{displayOption("condition", v)}</option>)}
                </select>
              </Field>
              <Field label="Location" htmlFor="ca-location">
                <select id="ca-location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls}>
                  <option value="">All locations</option>
                  {ZAMBIA_PROVINCES.map((p) => {
                    const towns = locations.filter((l) => provinceOf(l.location) === p);
                    if (towns.length === 0) return null;
                    return (
                      <optgroup key={p} label={`${p} Province`}>
                        {towns.map((l) => <option key={l.location} value={l.location}>{l.location} ({l._count.location})</option>)}
                      </optgroup>
                    );
                  })}
                  {(() => {
                    const rest = locations.filter((l) => !provinceOf(l.location));
                    if (rest.length === 0) return null;
                    return (
                      <optgroup label="Other locations">
                        {rest.map((l) => <option key={l.location} value={l.location}>{l.location} ({l._count.location})</option>)}
                      </optgroup>
                    );
                  })()}
                </select>
              </Field>
              <Field label="Province" htmlFor="ca-province">
                <select id="ca-province" value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls}>
                  <option value="">All provinces</option>
                  {ZAMBIA_PROVINCES.map((p) => {
                    const n = locations.filter((l) => provinceOf(l.location) === p).reduce((s, l) => s + l._count.location, 0);
                    return <option key={p} value={p}>{p} Province ({n})</option>;
                  })}
                </select>
              </Field>
              <Field label="Drivetrain" htmlFor="ca-drivetrain">
                <select id="ca-drivetrain" value={drivetrain} onChange={(e) => setDrivetrain(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {DRIVETRAIN_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Seats" htmlFor="ca-minSeats">
                <select id="ca-minSeats" value={minSeats} onChange={(e) => setMinSeats(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {SEAT_MIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Colour" htmlFor="ca-color">
                <select id="ca-color" value={color} onChange={(e) => setColor(e.target.value)} className={inputCls}>
                  <option value="">All colours</option>
                  {colors.map((c) => <option key={c.color ?? ""} value={c.color ?? ""}>{c.color} ({c._count.color})</option>)}
                </select>
              </Field>
              <Field label="Service history" htmlFor="ca-serviceHistory">
                <select id="ca-serviceHistory" value={serviceHistory} onChange={(e) => setServiceHistory(e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {SERVICE_HISTORY_OPTIONS.filter((o) => o.value !== "UNKNOWN").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              {customFilters.map((d) => (
                <Field key={d.key} label={d.label} htmlFor={`ca-${customParamKey(d.key)}`}>
                  <select
                    id={`ca-${customParamKey(d.key)}`}
                    value={custom[d.key] ?? ""}
                    onChange={(e) => setCustom((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Any</option>
                    {(d.kind === "BOOLEAN" ? ["Yes", "No"] : d.options).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              ))}
              <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
                <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="mt-1 h-4 w-4 accent-trader" />
                <span className="text-xs text-gray-600">
                  Notify me by email
                  <span className="block text-[11px] text-gray-400">Email delivery launching soon — new matches show here meanwhile.</span>
                </span>
              </label>
              {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 sm:col-span-2">{error}</p> : null}
              <span className="flex gap-2 sm:col-span-2">
                <button disabled={busy} className="rounded bg-asphalt px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Creating…" : "Create Alert"}
                </button>
                <button type="button" onClick={() => hide()} className="rounded border border-line px-5 py-2 text-sm font-semibold hover:bg-lot">
                  Cancel
                </button>
              </span>
            </form>
          </span>
        </span>
      ) : null}
    </>
  );
}
