import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { slugifyName, vehicleTypeSchema } from "@/lib/validators";

async function ownType(id: string) {
  return prisma.vehicleType.findUnique({ where: { id }, include: { _count: { select: { cars: true } } } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const json = await req.json().catch(() => ({}));
    const parsed = vehicleTypeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid type" }, { status: 400 });
    }
    const type = await ownType(params.id);
    if (!type) return NextResponse.json({ error: "Vehicle type not found" }, { status: 404 });
    const name = parsed.data.name.trim();
    const dupe = await prisma.vehicleType.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id: type.id } }
    });
    if (dupe) return NextResponse.json({ error: `“${dupe.name}” already exists.` }, { status: 409 });
    let slug = type.slug;
    if (name.toLowerCase() !== type.name.toLowerCase()) {
      slug = slugifyName(name);
      let n = 2;
      for (;;) {
        const hit = await prisma.vehicleType.findUnique({ where: { slug } });
        if (!hit || hit.id === type.id) break;
        slug = `${slugifyName(name)}-${n++}`;
      }
    }
    await prisma.vehicleType.update({ where: { id: type.id }, data: { name, slug } });
    await prisma.auditLog.create({ data: { actor, action: `Renamed vehicle type to ${name}`, entity: "VehicleType", entityId: type.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not rename vehicle type." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const type = await ownType(params.id);
    if (!type) return NextResponse.json({ error: "Vehicle type not found" }, { status: 404 });
    if (type._count.cars > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${type._count.cars} listing${type._count.cars === 1 ? " is" : "s are"} assigned to “${type.name}”. Reassign them first.` },
        { status: 409 }
      );
    }
    await prisma.vehicleType.delete({ where: { id: type.id } });
    await prisma.auditLog.create({ data: { actor, action: `Deleted vehicle type ${type.name}`, entity: "VehicleType", entityId: type.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Could not delete vehicle type." }, { status: 500 });
  }
}
