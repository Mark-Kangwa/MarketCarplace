import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { savedSearchCreateSchema } from "@/lib/validators";
import { buildCarWhere, customParamKey, describeSearch, parseSearchParams, searchHistoryKey, toQueryString } from "@/lib/search";
import { getCustomFilterDefs } from "@/lib/vehicle-validation";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function replayParams(f: ReturnType<typeof parseSearchParams>): Record<string, string | number | null | undefined> {
  return {
    q: f.q || undefined,
    make: f.make || undefined,
    model: f.model || undefined,
    body: f.body || undefined,
    condition: f.condition || undefined,
    gearbox: f.gearbox || undefined,
    fuel: f.fuel || undefined,
    location: f.location || undefined,
    province: f.province || undefined,
    serviceHistory: f.serviceHistory || undefined,
    drivetrain: f.drivetrain || undefined,
    color: f.color || undefined,
    minSeats: f.minSeats,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minYear: f.minYear,
    maxYear: f.maxYear,
    maxMileage: f.maxMileage,
    ...Object.fromEntries(Object.entries(f.custom).map(([k, v]) => [customParamKey(k), v])),
    sort: f.sort !== "newest" ? f.sort : undefined
  };
}

async function withCounts(userId: string) {
  const customDefs = await getCustomFilterDefs();
  const soldGraceDays = (await getSettings()).soldGraceDays;
  const rows = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  return Promise.all(
    rows.map(async (s) => {
      const where = buildCarWhere(parseSearchParams(Object.fromEntries(new URLSearchParams(s.params)), customDefs), undefined, soldGraceDays);
      const [matchCount, newCount] = await Promise.all([
        prisma.car.count({ where }),
        prisma.car.count({ where: { ...where, createdAt: { gt: s.lastSeenAt } } })
      ]);
      return { ...s, matchCount, newCount };
    })
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireUser();
    return NextResponse.json({ searches: await withCounts(session.id) });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load saved searches." }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = savedSearchCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid search" }, { status: 400 });
    }
    const customDefs = await getCustomFilterDefs();
    const f = parseSearchParams(parsed.data.search, customDefs);
    const key = searchHistoryKey(f);
    const existing = await prisma.savedSearch.findUnique({
      where: { userId_key: { userId: session.id, key } }
    });
    if (existing) {
      return NextResponse.json({ error: `You already saved this search as "${existing.name}".` }, { status: 409 });
    }
    const count = await prisma.savedSearch.count({ where: { userId: session.id } });
    const maxSaved = (await getSettings()).maxSavedSearches;
    if (count >= maxSaved) {
      return NextResponse.json({ error: `You have ${maxSaved} saved searches — delete one to save another.` }, { status: 400 });
    }
    const label = describeSearch(f, customDefs);
    const saved = await prisma.savedSearch.create({
      data: {
        userId: session.id,
        name: parsed.data.name?.trim() || label,
        key,
        emailAlerts: parsed.data.emailAlerts ?? false,
        params: toQueryString(replayParams(f))
      }
    });
    return NextResponse.json({ ok: true, search: saved });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not save search." }, { status: 500 });
  }
}
