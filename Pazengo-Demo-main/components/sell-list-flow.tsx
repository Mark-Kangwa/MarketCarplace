"use client";
import { useRouter } from "next/navigation";
import CarForm from "@/components/car-form";
import type { AssignedField, VehicleTypeRef } from "@/lib/vehicle-validation";

export default function SellListFlow({
  productId,
  productName,
  creditId,
  vehicleTypes,
  assignments,
  makes,
  modelsByMake,
  libraryMakes,
  libraryLocations,
  inventoryLocations,
  maxPhotos
}: {
  productId: string;
  productName: string;
  creditId: string | null;
  vehicleTypes: VehicleTypeRef[];
  assignments: Record<string, AssignedField[]>;
  makes: string[];
  modelsByMake: Record<string, string[]>;
  libraryMakes: string[];
  libraryLocations: string[];
  inventoryLocations: string[];
  maxPhotos: number;
}): JSX.Element {
  const router = useRouter();

  function onIntercept(body: Record<string, unknown>): void {
    try {
      sessionStorage.setItem("sell-draft", JSON.stringify({ productId, paymentId: creditId, body, at: Date.now() }));
    } catch {
      /* storage full or blocked — checkout will redirect back to the form */
    }
    router.push("/sell-my-car/checkout");
  }

  return (
    <CarForm
      mode="user"
      submitLabel="Submit for review"
      intercept={onIntercept}
      makes={makes}
      modelsByMake={modelsByMake}
      vehicleTypes={vehicleTypes}
      assignments={assignments}
      libraryMakes={libraryMakes}
      libraryLocations={libraryLocations}
      inventoryLocations={inventoryLocations}
      maxPhotos={maxPhotos}
    />
  );
}
