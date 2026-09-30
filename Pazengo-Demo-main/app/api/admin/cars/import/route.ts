import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseCarCsv, csvRowToCarInput } from "@/lib/validators";
import { absorbObservedOptions, getAssignments } from "@/lib/vehicle-validation";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const actor = await requireAdmin();
    const { text, dryRun } = (await req.json()) as { text?: string; dryRun?: boolean };
    if (!text || text.length > 500_000) return NextResponse.json({ error: "CSV missing or too large" }, { status: 400 });
    const { rows, errors } = parseCarCsv(text);
    const bad: { line: number; error: string }[] = [];
    const good: ReturnType<typeof csvRowToCarInput>[] = [];
    rows.forEach((r, idx) => {
      try {
        good.push(csvRowToCarInput(r));
      } catch (e: unknown) {
        bad.push({ line: idx + 2, error: e instanceof Error ? e.message.slice(0, 140) : "Invalid row" });
      }
    });
    if (dryRun) return NextResponse.json({ ok: good.length, bad, errors });
    const carType = await prisma.vehicleType.findUnique({ where: { name: "Car" } });
    const carAssignments = carType ? await getAssignments(carType.id) : [];
    let imported = 0;
    let failed = bad.length;
    for (const g of good) {
      try {
        await prisma.car.create({
          data: {
            make: g.make, model: g.model, variant: g.variant || null,
            year: g.year, priceZmw: g.priceZmw, mileageKm: g.mileageKm,
            transmission: g.transmission, fuel: g.fuel, bodyType: g.bodyType, drivetrain: g.drivetrain, condition: g.condition,
            chassisNo: g.chassisNo || null, color: g.color || null, status: "DRAFT",
            location: g.location, seats: g.seats, serviceHistory: g.serviceHistory,
            photos: [], features: [], vehicleTypeId: carType?.id ?? null, createdBy: actor
          }
        });
        imported++;
        try {
          await absorbObservedOptions(carAssignments, { ...g, variant: g.variant ?? "", chassisNo: g.chassisNo ?? "", color: g.color ?? "", status: "DRAFT", isFeatured: false, photos: [], features: [] }, {});
        } catch (e: unknown) {
          console.error("absorbObservedOptions failed:", e instanceof Error ? e.message : e);
        }
      } catch {
        failed++;
      }
    }
    await prisma.auditLog.create({ data: { actor, action: `CSV import: ${imported} added, ${failed} failed`, entity: "Car", entityId: "bulk" } });
    return NextResponse.json({ imported, failed });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
