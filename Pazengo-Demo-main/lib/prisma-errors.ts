import { Prisma } from "@prisma/client";

/**
 * Maps Prisma unique-constraint failures on Car.chassisNo
 * to a message that names the conflicting value.
 * Returns null when the error is not a duplicate-key failure.
 */
export function duplicateCarMessage(e: unknown, chassisNo: string): string | null {
  const fallback = "Chassis number already exists.";
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = ((e.meta?.target as string[] | undefined) ?? []).join(",");
    if (target.includes("chassisNo") && chassisNo) {
      return `That chassis number is already on another car — check the number and save again.`;
    }
    return fallback;
  }
  if (e instanceof Error && e.message.includes("Unique constraint")) return fallback;
  return null;
}
