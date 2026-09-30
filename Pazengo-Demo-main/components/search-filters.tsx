import Link from "next/link";
import { SORT_OPTIONS, customParamKey, type CustomFilterDef, type SearchFilters } from "@/lib/search";
import { SERVICE_HISTORY_OPTIONS, DRIVETRAIN_OPTIONS, YEAR_OPTIONS, PRICE_MIN_OPTIONS, PRICE_MAX_OPTIONS, MILEAGE_MAX_OPTIONS, SEAT_MIN_OPTIONS, displayOption } from "@/lib/validators";
import { ZAMBIA_PROVINCES, provinceOf } from "@/lib/zambia";

export function hiddenInputs(f: SearchFilters, exclude: string[]): JSX.Element[] {  const entries: [string, string][] = [
    ["q", f.q],
    ["make", f.make],
    ["model", f.model],
    ["body", f.body],
    ["condition", f.condition],
    ["gearbox", f.gearbox],
    ["fuel", f.fuel],
    ["location", f.location],
    ["province", f.province],
    ["serviceHistory", f.serviceHistory],
    ["drivetrain", f.drivetrain],
    ["color", f.color],
    ["minSeats", f.minSeats !== null ? String(f.minSeats) : ""],
    ["minPrice", f.minPrice !== null ? String(f.minPrice) : ""],
    ["maxPrice", f.maxPrice !== null ? String(f.maxPrice) : ""],
    ["minYear", f.minYear !== null ? String(f.minYear) : ""],
    ["maxYear", f.maxYear !== null ? String(f.maxYear) : ""],
    ["maxMileage", f.maxMileage !== null ? String(f.maxMileage) : ""],
    ...Object.entries(f.custom).map(([k, v]): [string, string] => [customParamKey(k), v]),
    ["sort", f.sort]
  ];
  return entries
    .filter(([k, v]) => v !== "" && !exclude.includes(k))
    .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
}

/**
 * Keeps bookmarked/custom URL values truthful: if the active filter value
 * isn't among the preset options, show it as an extra selected option
 * instead of misleadingly displaying "Any".
 */
function ExtraOption({ options, current, format }: { options: { value: string }[]; current: number | null; format: (n: number) => string }): JSX.Element | null {
  if (current === null || options.some((o) => o.value === String(current))) return null;
  return <option value={String(current)}>{format(current)}</option>;
}

export default function SearchFilters({
  f,
  makes,
  models,
  locations,
  colors,
  customFilters = []
}: {
  f: SearchFilters;
  makes: { make: string; _count: { make: number } }[];
  models: { model: string; _count: { model: number } }[];
  locations: { location: string; _count: { location: number } }[];
  colors: { color: string | null; _count: { color: number } }[];
  customFilters?: CustomFilterDef[];
}): JSX.Element {
  return (
    <form className="grid gap-3 p-4" action="/#listings" method="get">
      {hiddenInputs(f, ["minPrice", "maxPrice", "minYear", "maxYear", "maxMileage", "gearbox", "fuel", "condition", "location", "drivetrain", "minSeats", "color", "serviceHistory", "sort"])}
      <input type="hidden" name="q" value={f.q} />
      <input type="hidden" name="make" value={f.make} />
      <input type="hidden" name="model" value={f.model} />
      <input type="hidden" name="body" value={f.body} />
      <div>
        <label htmlFor="f-minPrice" className="mb-1 block text-xs font-semibold text-gray-600">Min price</label>
        <select id="f-minPrice" name="minPrice" defaultValue={f.minPrice !== null ? String(f.minPrice) : ""} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">No min</option>
          {PRICE_MIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          <ExtraOption options={PRICE_MIN_OPTIONS} current={f.minPrice} format={(n) => `K ${n.toLocaleString("en-ZA")}`} />
        </select>
      </div>
      <div>
        <label htmlFor="f-maxPrice" className="mb-1 block text-xs font-semibold text-gray-600">Max price</label>
        <select id="f-maxPrice" name="maxPrice" defaultValue={f.maxPrice !== null ? String(f.maxPrice) : ""} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">No max</option>
          {PRICE_MAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          <ExtraOption options={PRICE_MAX_OPTIONS} current={f.maxPrice} format={(n) => `K ${n.toLocaleString("en-ZA")}`} />
        </select>
      </div>
      <div>
        <label htmlFor="f-minYear" className="mb-1 block text-xs font-semibold text-gray-600">Min year</label>
        <select id="f-minYear" name="minYear" defaultValue={f.minYear !== null ? String(f.minYear) : ""} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">No min</option>
          {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-maxYear" className="mb-1 block text-xs font-semibold text-gray-600">Max year</label>
        <select id="f-maxYear" name="maxYear" defaultValue={f.maxYear !== null ? String(f.maxYear) : ""} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">No max</option>
          {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-maxMileage" className="mb-1 block text-xs font-semibold text-gray-600">Max mileage</label>
        <select id="f-maxMileage" name="maxMileage" defaultValue={f.maxMileage !== null ? String(f.maxMileage) : ""} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">No max</option>
          {MILEAGE_MAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          <ExtraOption options={MILEAGE_MAX_OPTIONS} current={f.maxMileage} format={(n) => `Under ${n.toLocaleString("en-ZA")} km`} />
        </select>
      </div>
      <div>
        <label htmlFor="f-gearbox" className="mb-1 block text-xs font-semibold text-gray-600">Gearbox</label>
        <select id="f-gearbox" name="gearbox" defaultValue={f.gearbox} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">Any</option>
          <option value="MANUAL">{displayOption("transmission", "MANUAL")}</option>
          <option value="AUTOMATIC">{displayOption("transmission", "AUTOMATIC")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-fuel" className="mb-1 block text-xs font-semibold text-gray-600">Fuel</label>
        <select id="f-fuel" name="fuel" defaultValue={f.fuel} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">Any</option>
          {["PETROL", "DIESEL", "HYBRID", "ELECTRIC"].map((v) => <option key={v} value={v}>{displayOption("fuel", v)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-condition" className="mb-1 block text-xs font-semibold text-gray-600">Condition</label>
        <select id="f-condition" name="condition" defaultValue={f.condition} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">Any</option>
          {["NEW", "USED", "DEMO"].map((v) => <option key={v} value={v}>{displayOption("condition", v)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-location" className="mb-1 block text-xs font-semibold text-gray-600">Location</label>
        <select id="f-location" name="location" defaultValue={f.location} className="w-full rounded border border-line px-3 py-2 text-sm">
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
      </div>
      <div>
        <label htmlFor="f-province" className="mb-1 block text-xs font-semibold text-gray-600">Province</label>
        <select id="f-province" name="province" defaultValue={f.province} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">All provinces</option>
          {ZAMBIA_PROVINCES.map((p) => {
            const n = locations.filter((l) => provinceOf(l.location) === p).reduce((s, l) => s + l._count.location, 0);
            return <option key={p} value={p}>{p} Province ({n})</option>;
          })}
        </select>
      </div>
      <div>
        <label htmlFor="f-serviceHistory" className="mb-1 block text-xs font-semibold text-gray-600">Service history</label>
        <select id="f-serviceHistory" name="serviceHistory" defaultValue={f.serviceHistory} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">Any</option>
          {SERVICE_HISTORY_OPTIONS.filter((o) => o.value !== "UNKNOWN").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-drivetrain" className="mb-1 block text-xs font-semibold text-gray-600">Drivetrain</label>
        <select id="f-drivetrain" name="drivetrain" defaultValue={f.drivetrain} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">Any</option>
          {DRIVETRAIN_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-minSeats" className="mb-1 block text-xs font-semibold text-gray-600">Seats</label>
        <select id="f-minSeats" name="minSeats" defaultValue={f.minSeats !== null ? String(f.minSeats) : ""} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">Any</option>
          {SEAT_MIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          <ExtraOption options={SEAT_MIN_OPTIONS} current={f.minSeats} format={(n) => `${n}+ seats`} />
        </select>
      </div>
      <div>
        <label htmlFor="f-color" className="mb-1 block text-xs font-semibold text-gray-600">Colour</label>
        <select id="f-color" name="color" defaultValue={f.color} className="w-full rounded border border-line px-3 py-2 text-sm">
          <option value="">All colours</option>
          {colors.map((c) => <option key={c.color ?? ""} value={c.color ?? ""}>{c.color} ({c._count.color})</option>)}
        </select>
      </div>
      {customFilters.length > 0 ? (
        <details className="rounded border border-line" open={customFilters.some((d) => f.custom[d.key])}>
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-gray-600">
            More details{customFilters.some((d) => f.custom[d.key]) ? " (active)" : ""}
          </summary>
          <div className="grid gap-3 border-t border-line p-3">
            {customFilters.map((d) => (
              <div key={d.key}>
                <label htmlFor={`f-${customParamKey(d.key)}`} className="mb-1 block text-xs font-semibold text-gray-600">{d.label}</label>
                <select
                  id={`f-${customParamKey(d.key)}`}
                  name={customParamKey(d.key)}
                  defaultValue={f.custom[d.key] ?? ""}
                  className="w-full rounded border border-line px-3 py-2 text-sm"
                >
                  <option value="">Any</option>
                  {(d.kind === "BOOLEAN" ? ["Yes", "No"] : d.options).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <label htmlFor="f-sort" className="text-xs font-semibold text-gray-600">Sort</label>
        <select id="f-sort" name="sort" defaultValue={f.sort} className="rounded border border-line px-3 py-2 text-sm">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 rounded bg-asphalt px-5 py-2 text-sm font-semibold text-white" type="submit">Apply filters</button>
        <Link href="/#listings" className="rounded border border-line px-5 py-2 text-sm font-semibold hover:bg-lot">Clear</Link>
      </div>
    </form>
  );
}
