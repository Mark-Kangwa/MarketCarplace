import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { slugifyName, vehicleTypeSchema } from "@/lib/validators";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const types = await prisma.vehicleType.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { fields: true, cars: true } } }
    });
    return NextResponse.json({ types });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not load vehicle types." }, { status: 500 });
  }
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 2;
  for (;;) {
    const hit = await prisma.vehicleType.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = vehicleTypeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid type" }, { status: 400 });
    }
    const name = parsed.data.name.trim();
    const dupe = await prisma.vehicleType.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (dupe) return NextResponse.json({ error: `“${dupe.name}” already exists.` }, { status: 409 });
    const type = await prisma.vehicleType.create({
      data: { name, slug: await uniqueSlug(slugifyName(name)) }
    });
    await prisma.auditLog.create({ data: { actor, action: `Added vehicle type ${name}`, entity: "VehicleType", entityId: type.id } });
    return NextResponse.json({ ok: true, type });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not create vehicle type." }, { status: 500 });
  }
}
