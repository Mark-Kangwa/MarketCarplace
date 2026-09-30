import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth";
import { YEAR_OPTIONS } from "../lib/validators";
import { ZAMBIA_TOWNS } from "../lib/zambia";
import { absorbObservedOptions, getAssignments } from "../lib/vehicle-validation";

async function main(): Promise<void> {
  // Demo buyer password for testing sign-in: Buyer123!
  const demoPasswordHash = await hashPassword("Buyer123!");
  const buyers = [
    { name: "Thandi Mokoena", email: "thandi.buyer@example.co.za", phone: "082 555 0141", role: "BUYER" as const, status: "ACTIVE" as const, passwordHash: demoPasswordHash },
    { name: "Pieter van Wyk", email: "pieter.buyer@example.co.za", phone: "083 555 0192", role: "BUYER" as const, status: "ACTIVE" as const },
    { name: "Sipho Dlamini", email: "sipho.blocked@example.co.za", phone: "079 555 0117", role: "BUYER" as const, status: "BLOCKED" as const, blockedReason: "Suspected payment fraud — duplicate EFT slips" }
  ];
  const dealers = [
    { name: "Autohaus Beyers", email: "sales@autohausbeyers.co.za", phone: "012 555 0101", role: "DEALER" as const, status: "ACTIVE" as const },
    { name: "Mit Mak Motors", email: "leads@mitmak.co.za", phone: "011 555 0163", role: "DEALER" as const, status: "ACTIVE" as const }
  ];
  for (const u of [...buyers, ...dealers]) {
    await prisma.user.upsert({ where: { email: u.email }, update: { ...u }, create: { ...u } });
  }

  // Listing products (editable data, never code): free and paid packages.
  // update: {} keeps admin edits — reseed never overwrites them.
  const products = [
    {
      name: "List for free",
      description: "You are able to list on Pazengo for 7 days for free and the price is K0 and the duration is 7 days.",
      priceZmw: 0,
      durationDays: 7
    },
    {
      name: "Special listing",
      description: "This product allows you to upload a listing for two weeks, the price is K150.",
      priceZmw: 150,
      durationDays: 14
    }
  ];
  for (const p of products) {
    await prisma.listingProduct.upsert({ where: { name: p.name }, update: {}, create: { ...p } });
  }

  // Marketplace header nav (managed under System Settings → Menu pages).
  // update: {} preserves admin renames/reorders — reseed never overwrites.
  const headerMenu = [
    { key: "buy", label: "Buy a car", href: "/", emphasized: false },
    { key: "sell", label: "Sell my car", href: "/sell-my-car", emphasized: true },
    { key: "value", label: "Value my car", href: null, emphasized: false },
    { key: "news", label: "News & reviews", href: "/news", emphasized: false },
    { key: "tools", label: "Tools & services", href: null, emphasized: false }
  ];
  let menuPos = 0;
  for (const m of headerMenu) {
    await prisma.menuItem.upsert({
      where: { scope_key: { scope: "header", key: m.key } },
      update: {},
      create: { scope: "header", key: m.key, label: m.label, href: m.href, emphasized: m.emphasized, position: menuPos++ }
    });
  }

  // System settings defaults (today's behavior). update: {} keeps admin
  // changes — reseed never overwrites them.
  const settingDefaults: Record<string, number> = {
    soldGraceDays: 5,
    featuredTake: 3,
    landingTake: 8,
    maxPhotos: 10,
    freeLiveLimit: 1,
    maxSavedSearches: 20
  };
  for (const [key, value] of Object.entries(settingDefaults)) {
    await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value: String(value) } });
  }

  // Vehicle types + shared form-field library. Field `key` values are stable
  // identifiers; `binding` maps system fields to Car columns (null = custom).
  const vehicleTypes = ["Car", "Motorbike", "Boats", "Trucks"];
  for (const name of vehicleTypes) {
    await prisma.vehicleType.upsert({
      where: { name },
      update: {},
      create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }
    });
  }

  type SeedField = {
    key: string; label: string; kind: "TEXT" | "NUMBER" | "SELECT" | "MULTI_SELECT" | "BOOLEAN" | "DATE" | "LONG_TEXT";
    binding: string | null; required: boolean; options?: string[]; unit?: string; minValue?: number; maxValue?: number;
    dynamic?: boolean; help?: string;
  };
  const COLOR_PRESET = ["White", "Silver", "Black", "Grey", "Red", "Blue", "Green", "Brown", "Beige", "Gold", "Orange", "Yellow"];
  const COUNTRY_PRESET = ["Japan", "South Africa", "Germany", "United Kingdom", "China", "USA", "India", "South Korea", "Thailand", "France", "Italy", "Sweden", "UAE", "Botswana", "Namibia", "Zimbabwe", "Mozambique", "Zambia"];
  const SAFETY_PRESET = ["ABS", "Airbags", "Stability control", "ISOFIX child anchors", "Reverse camera", "Parking sensors", "Blind spot monitor", "Cruise control"];
  const INTERIOR_PRESET = ["Black", "Grey", "Beige", "Brown", "White", "Red", "Blue", "Cream", "Charcoal", "Tan"];
  const library: SeedField[] = [
    { key: "make", label: "Make", kind: "SELECT", binding: "make", required: true, dynamic: true, help: "Options come from your inventory — new makes via Other." },
    { key: "model", label: "Model", kind: "SELECT", binding: "model", required: true, dynamic: true, help: "Options follow the chosen make — new models via Other." },
    { key: "variant", label: "Variant", kind: "TEXT", binding: "variant", required: false },
    { key: "year", label: "Year", kind: "SELECT", binding: "year", required: true, options: YEAR_OPTIONS, minValue: 1990, maxValue: 2027 },
    { key: "price_zwm", label: "Price (ZMW)", kind: "NUMBER", binding: "priceZmw", required: true, minValue: 1000, maxValue: 50000000 },
    { key: "mileage_km", label: "Mileage (km)", kind: "NUMBER", binding: "mileageKm", required: true, minValue: 0, maxValue: 2000000, unit: "km" },
    { key: "seats", label: "Number of seats", kind: "SELECT", binding: "seats", required: true, options: ["2", "4", "5", "7", "8", "9", "14", "16"] },
    { key: "transmission", label: "Gearbox", kind: "SELECT", binding: "transmission", required: true, options: ["MANUAL", "AUTOMATIC"] },
    { key: "fuel", label: "Fuel", kind: "SELECT", binding: "fuel", required: true, options: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC"] },
    { key: "body_type", label: "Body type", kind: "SELECT", binding: "bodyType", required: true, options: ["Hatchback", "Sedan", "SUV", "Bakkie", "Coupe", "Van"] },
    { key: "drivetrain", label: "Drivetrain", kind: "SELECT", binding: "drivetrain", required: true, options: ["4x2", "4x4", "AWD", "FWD", "RWD"] },
    { key: "condition", label: "Condition", kind: "SELECT", binding: "condition", required: true, options: ["NEW", "USED", "DEMO"] },
    { key: "chassis_no", label: "Chassis number", kind: "TEXT", binding: "chassisNo", required: false },
    { key: "color", label: "Colour", kind: "SELECT", binding: "color", required: false, options: COLOR_PRESET },
    { key: "location", label: "Location", kind: "SELECT", binding: "location", required: true, dynamic: true, options: ZAMBIA_TOWNS, help: "Options come from the Zambia town list — other towns via Other." },
    { key: "service_history", label: "Service history", kind: "SELECT", binding: "serviceHistory", required: true, options: ["FULL_FRANCHISE", "FULL", "PARTIAL", "NONE", "UNKNOWN"] },
    { key: "additional_information", label: "Additional information", kind: "LONG_TEXT", binding: null, required: false },
    { key: "country_of_origin", label: "Country of origin", kind: "SELECT", binding: null, required: true, options: COUNTRY_PRESET },
    { key: "description", label: "Description", kind: "LONG_TEXT", binding: null, required: false },
    { key: "doors", label: "Doors", kind: "SELECT", binding: null, required: true, options: ["2", "3", "4", "5"] },
    { key: "engine_size", label: "Engine size", kind: "TEXT", binding: null, required: true, help: "e.g. 2.0L, 1998cc, 1.5T" },
    { key: "fuel_capacity", label: "Fuel capacity", kind: "NUMBER", binding: null, required: false, unit: "L", minValue: 0, maxValue: 500 },
    { key: "interior_color", label: "Interior colour", kind: "SELECT", binding: null, required: false, options: INTERIOR_PRESET },
    { key: "safety", label: "Safety", kind: "MULTI_SELECT", binding: null, required: false, options: SAFETY_PRESET, help: "Tick all that apply." }
  ];
  for (const f of library) {
    const existing = await prisma.formField.findUnique({ where: { key: f.key } });
    // Kind/dynamic/help always follow the seed; options only seed into empty
    // lists so admin customisations are never overwritten on reseed.
    const seedOptions = f.options ?? [];
    const optionsUpdate = !existing || ((existing.options as unknown as string[]) ?? []).length === 0
      ? { options: seedOptions }
      : {};
    if (!existing) {
      await prisma.formField.create({
        data: {
          key: f.key,
          label: f.label,
          kind: f.kind,
          binding: f.binding,
          options: seedOptions,
          unit: f.unit ?? null,
          minValue: f.minValue ?? null,
          maxValue: f.maxValue ?? null,
          help: f.help ?? null,
          dynamic: f.dynamic ?? false
        }
      });
    } else {
      await prisma.formField.update({
        where: { key: f.key },
        data: { label: f.label, kind: f.kind, help: f.help ?? null, dynamic: f.dynamic ?? false, ...optionsUpdate }
      });
    }
  }

  // Assign the full library to every vehicle type in form order.
  const allTypes = await prisma.vehicleType.findMany();
  for (const vt of allTypes) {
    let position = 0;
    for (const f of library) {
      const field = await prisma.formField.findUnique({ where: { key: f.key } });
      if (!field) continue;
      const pos = position++;
      await prisma.vehicleTypeField.upsert({
        where: { vehicleTypeId_fieldId: { vehicleTypeId: vt.id, fieldId: field.id } },
        update: {},
        create: { vehicleTypeId: vt.id, fieldId: field.id, required: f.required, position: pos }
      });
    }
  }
  {
    // Every existing listing becomes a Car; columns already hold their data.
    const carType = await prisma.vehicleType.findUnique({ where: { name: "Car" } });
    if (carType) {
      await prisma.car.updateMany({ where: { vehicleTypeId: null }, data: { vehicleTypeId: carType.id } });
    }
  }

  const cars = [
    { make: "Toyota", model: "Hilux", variant: "2.8GD-6 Double Cab Raider", year: 2023, priceZmw: 589900, mileageKm: 45200, transmission: "AUTOMATIC" as const, fuel: "DIESEL" as const, bodyType: "Bakkie", drivetrain: "4x4", condition: "USED" as const, chassisNo: "AHTFW22G206012341", color: "Glacier White", location: "Lusaka", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/interior-drive.jpg"], features: ["Tow bar", "Leather seats", "Reverse camera"], status: "PUBLISHED" as const, isFeatured: true, featuredAt: new Date() },
    { make: "Volkswagen", model: "Polo", variant: "1.0TSI Comfortline", year: 2022, priceZmw: 289900, mileageKm: 38100, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Hatchback", drivetrain: "FWD", condition: "USED" as const, chassisNo: "WVWZZZ6RZNY012342", color: "Reef Blue", location: "Kitwe", seats: 5, serviceHistory: "PARTIAL" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/interior-drive.jpg"], features: ["Apple CarPlay", "Park sensors"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Ford", model: "Ranger", variant: "2.0Bi-Turbo Wildtrak 4x4", year: 2024, priceZmw: 789900, mileageKm: 12500, transmission: "AUTOMATIC" as const, fuel: "DIESEL" as const, bodyType: "Bakkie", drivetrain: "4x4", condition: "USED" as const, chassisNo: "AFAPXXMJ2PRY12343", color: "Meteor Grey", location: "Ndola", seats: 5, serviceHistory: "FULL_FRANCHISE" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/night-911.jpg"], features: ["360 camera", "Adaptive cruise"], status: "DRAFT" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Corolla Cross", variant: "1.8 XS Hybrid", year: 2023, priceZmw: 485000, mileageKm: 32500, transmission: "AUTOMATIC" as const, fuel: "HYBRID" as const, bodyType: "SUV", drivetrain: "FWD", condition: "USED" as const, chassisNo: "AHTXA10G206012344", color: "Silver Metallic", location: "Lusaka", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-crv.jpg", "/seed-cars/interior-drive.jpg"], features: ["Hybrid synergy drive", "Reverse camera", "Cruise control"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Fortuner", variant: "2.8GD-6 4x4 Auto", year: 2021, priceZmw: 620000, mileageKm: 78500, transmission: "AUTOMATIC" as const, fuel: "DIESEL" as const, bodyType: "SUV", drivetrain: "4x4", condition: "USED" as const, chassisNo: "AHTFU22G206012345", color: "Phantom Brown", location: "Kitwe", seats: 7, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/silver-911.jpg"], features: ["7 seats", "Leather interior", "Downhill assist"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Land Cruiser Prado", variant: "2.8GD TX-L", year: 2020, priceZmw: 895000, mileageKm: 92000, transmission: "AUTOMATIC" as const, fuel: "DIESEL" as const, bodyType: "SUV", drivetrain: "4x4", condition: "USED" as const, chassisNo: "AHTGDJ15006012346", color: "Pearl White", location: "Lusaka", seats: 7, serviceHistory: "FULL_FRANCHISE" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/road-panamera.jpg"], features: ["Sunroof", "7 seats", "Crawl control"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "RAV4", variant: "2.0 GX", year: 2021, priceZmw: 465000, mileageKm: 54800, transmission: "AUTOMATIC" as const, fuel: "PETROL" as const, bodyType: "SUV", drivetrain: "FWD", condition: "USED" as const, chassisNo: "AHTXA52G206012347", color: "Attitude Black", location: "Ndola", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-crv.jpg", "/seed-cars/night-911.jpg"], features: ["Lane assist", "Apple CarPlay", "Power tailgate"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Starlet", variant: "1.4 XR Auto", year: 2024, priceZmw: 245000, mileageKm: 50, transmission: "AUTOMATIC" as const, fuel: "PETROL" as const, bodyType: "Hatchback", drivetrain: "FWD", condition: "NEW" as const, chassisNo: "AHTGW12G306012348", color: "Mystic Pearl", location: "Lusaka", seats: 5, serviceHistory: "FULL_FRANCHISE" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/silver-911.jpg"], features: ["Balance of warranty", "Touchscreen", "Fog lamps"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Corolla Quest", variant: "1.8", year: 2021, priceZmw: 265000, mileageKm: 68900, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Sedan", drivetrain: "FWD", condition: "USED" as const, chassisNo: "AHTBB42E206012349", color: "Silver", location: "Kabwe", seats: 5, serviceHistory: "PARTIAL" as const, photos: ["/seed-cars/coupe-bmw.jpg", "/seed-cars/interior-drive.jpg"], features: ["Aircon", "Power steering", "CD player"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Urban Cruiser", variant: "1.5 XR Auto", year: 2023, priceZmw: 335000, mileageKm: 27400, transmission: "AUTOMATIC" as const, fuel: "PETROL" as const, bodyType: "SUV", drivetrain: "FWD", condition: "USED" as const, chassisNo: "AHTUL11F306012350", color: "Rustic Brown", location: "Livingstone", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-crv.jpg", "/seed-cars/road-gtr.jpg"], features: ["Reverse camera", "Alloy wheels", "Keyless entry"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Toyota", model: "Hiace", variant: "2.5 Sesfikile 16-seater", year: 2020, priceZmw: 420000, mileageKm: 118000, transmission: "MANUAL" as const, fuel: "DIESEL" as const, bodyType: "Van", drivetrain: "RWD", condition: "USED" as const, chassisNo: "AHTLH172600601235", color: "White", location: "Kitwe", seats: 14, serviceHistory: "PARTIAL" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/interior-drive.jpg"], features: ["High roof", "Aircon throughout", "Tow bar"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Ford", model: "Everest", variant: "2.0Bi-Turbo XLT 4x4", year: 2022, priceZmw: 595000, mileageKm: 61200, transmission: "AUTOMATIC" as const, fuel: "DIESEL" as const, bodyType: "SUV", drivetrain: "4x4", condition: "USED" as const, chassisNo: "AFAPXXMJ2PRL12352", color: "Aluminium Metallic", location: "Solwezi", seats: 7, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/road-gtr.jpg"], features: ["7 seats", "Terrain management", "Tow bar"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Volkswagen", model: "Polo Vivo", variant: "1.4 Comfortline", year: 2022, priceZmw: 235000, mileageKm: 44300, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Hatchback", drivetrain: "FWD", condition: "USED" as const, chassisNo: "WVWZZZ6RZNY012353", color: "Candy White", location: "Lusaka", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/night-911.jpg"], features: ["Aircon", "Electric windows", "Alloy wheels"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Nissan", model: "Navara", variant: "2.5 LE Double Cab", year: 2021, priceZmw: 455000, mileageKm: 71600, transmission: "MANUAL" as const, fuel: "DIESEL" as const, bodyType: "Bakkie", drivetrain: "4x2", condition: "USED" as const, chassisNo: "JN1CPUD2310601235", color: "Storm Grey", location: "Chingola", seats: 5, serviceHistory: "PARTIAL" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/silver-911.jpg"], features: ["Bin liner", "Tow bar", "Fog lamps"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Nissan", model: "Qashqai", variant: "1.2T Acenta", year: 2020, priceZmw: 325000, mileageKm: 83400, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "SUV", drivetrain: "FWD", condition: "USED" as const, chassisNo: "JN1FBAT3210601235", color: "Gun Metallic", location: "Lusaka", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-crv.jpg", "/seed-cars/road-panamera.jpg"], features: ["360 camera", "Panoramic roof", "Heated seats"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Isuzu", model: "D-Max", variant: "1.9 LS Double Cab 4x4", year: 2022, priceZmw: 475000, mileageKm: 58900, transmission: "MANUAL" as const, fuel: "DIESEL" as const, bodyType: "Bakkie", drivetrain: "4x4", condition: "USED" as const, chassisNo: "JAATFS40H20601235", color: "Titanium Silver", location: "Solwezi", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-expedition.jpg", "/seed-cars/night-911.jpg"], features: ["Diff lock", "Bin liner", "Cruise control"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Suzuki", model: "Swift", variant: "1.2 GLX", year: 2023, priceZmw: 215000, mileageKm: 23800, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Hatchback", drivetrain: "FWD", condition: "USED" as const, chassisNo: "JSAAZC13S30601235", color: "Burning Red", location: "Lusaka", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/road-gtr.jpg"], features: ["Push start", "Alloy wheels", "Fog lamps"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Suzuki", model: "Ertiga", variant: "1.5 GL", year: 2022, priceZmw: 285000, mileageKm: 49700, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Van", drivetrain: "FWD", condition: "USED" as const, chassisNo: "JSANC15S206012358", color: "Pearl White", location: "Chipata", seats: 7, serviceHistory: "PARTIAL" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/road-panamera.jpg"], features: ["7 seats", "Rear aircon", "Roof rails"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Hyundai", model: "Grand i10", variant: "1.0 Motion", year: 2022, priceZmw: 175000, mileageKm: 51200, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Hatchback", drivetrain: "FWD", condition: "USED" as const, chassisNo: "KMHB351ABNU123509", color: "Polar White", location: "Kabwe", seats: 5, serviceHistory: "NONE" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/silver-911.jpg"], features: ["Aircon", "Power steering"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Kia", model: "Picanto", variant: "1.2 Smart", year: 2023, priceZmw: 195000, mileageKm: 29600, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "Hatchback", drivetrain: "FWD", condition: "USED" as const, chassisNo: "KNAJA815AP7012361", color: "Honey Bee", location: "Livingstone", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/night-911.jpg"], features: ["Touchscreen", "Reverse camera", "Alloy wheels"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Kia", model: "Sonet", variant: "1.5 EX", year: 2023, priceZmw: 295000, mileageKm: 31400, transmission: "MANUAL" as const, fuel: "PETROL" as const, bodyType: "SUV", drivetrain: "FWD", condition: "USED" as const, chassisNo: "KNADE815AP7012361", color: "Intense Red", location: "Ndola", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/suv-crv.jpg", "/seed-cars/silver-911.jpg"], features: ["Sunroof", "Cruise control", "LED lights"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Mercedes-Benz", model: "C-Class", variant: "C200 AMG Line", year: 2019, priceZmw: 445000, mileageKm: 96700, transmission: "AUTOMATIC" as const, fuel: "PETROL" as const, bodyType: "Sedan", drivetrain: "RWD", condition: "USED" as const, chassisNo: "WDDWF4KB0KF012612", color: "Obsidian Black", location: "Lusaka", seats: 5, serviceHistory: "FULL_FRANCHISE" as const, photos: ["/seed-cars/coupe-merc.jpg", "/seed-cars/night-911.jpg"], features: ["AMG styling", "Ambient lighting", "Blind spot assist"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "BMW", model: "3 Series", variant: "320i M Sport", year: 2020, priceZmw: 465000, mileageKm: 88300, transmission: "AUTOMATIC" as const, fuel: "PETROL" as const, bodyType: "Sedan", drivetrain: "RWD", condition: "USED" as const, chassisNo: "WBA5R12070F012613", color: "Portimao Blue", location: "Kitwe", seats: 5, serviceHistory: "FULL" as const, photos: ["/seed-cars/sedan-bmw.jpg", "/seed-cars/coupe-bmw-grey.png"], features: ["M Sport package", "Sunroof", "Harman Kardon"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null },
    { make: "Haval", model: "Jolion", variant: "1.5T Premium", year: 2023, priceZmw: 345000, mileageKm: 8900, transmission: "AUTOMATIC" as const, fuel: "PETROL" as const, bodyType: "SUV", drivetrain: "FWD", condition: "DEMO" as const, chassisNo: "LGWEE4A5730101261", color: "Hamilton White", location: "Lusaka", seats: 5, serviceHistory: "FULL_FRANCHISE" as const, photos: ["/seed-cars/suv-crv.jpg", "/seed-cars/interior-drive.jpg"], features: ["360 camera", "Adaptive cruise", "Balance of plan"], status: "PUBLISHED" as const, isFeatured: false, featuredAt: null }
  ];
  for (const c of cars) {
    // Never overwrite photos on update: galleries may hold admin-uploaded
    // originals, and a reseed must not revert them to stock images.
    // New cars still receive seed photos via `create`.
    const { photos, ...rest } = c;
    await prisma.car.upsert({ where: { chassisNo: c.chassisNo }, update: { ...rest }, create: { ...c } });
  }

  // Convergence: every observed option value joins its field's shared list,
  // so the options manager starts with in-stock values included.
  {
    const carType = await prisma.vehicleType.findUnique({ where: { name: "Car" } });
    if (carType) {
      const carAssignments = await getAssignments(carType.id);
      for (const c of cars) {
        try {
          await absorbObservedOptions(carAssignments, { ...c, isFeatured: c.isFeatured ?? false }, {});
        } catch (e: unknown) {
          console.error("seed absorb failed:", e instanceof Error ? e.message : e);
        }
      }
    }
  }

  // Backfill: any car (e.g. older rows) left without photos gets generic gallery shots.
  const fallback: Record<string, string[]> = {
    Bakkie: ["/seed-cars/suv-expedition.jpg", "/seed-cars/interior-drive.jpg"],
    SUV: ["/seed-cars/suv-crv.jpg", "/seed-cars/interior-drive.jpg"],
    Sedan: ["/seed-cars/sedan-bmw.jpg", "/seed-cars/interior-drive.jpg"],
    Hatchback: ["/seed-cars/hatch-fiat.jpg", "/seed-cars/interior-drive.jpg"],
    Van: ["/seed-cars/suv-expedition.jpg", "/seed-cars/interior-drive.jpg"],
    Coupe: ["/seed-cars/coupe-merc.jpg", "/seed-cars/interior-drive.jpg"]
  };
  const all = await prisma.car.findMany({ select: { id: true, bodyType: true, photos: true } });
  for (const car of all) {
    const photos = Array.isArray(car.photos) ? car.photos : [];
    if (photos.length === 0) {
      await prisma.car.update({
        where: { id: car.id },
        data: { photos: fallback[car.bodyType] ?? ["/seed-cars/suv-crv.jpg", "/seed-cars/interior-drive.jpg"] }
      });
    }
  }

  const buyer = await prisma.user.findUnique({ where: { email: "thandi.buyer@example.co.za" } });
  if (buyer) {
    const existing = await prisma.payment.findFirst({ where: { userId: buyer.id, reference: "EFT-88231" } });
    if (!existing) {
      await prisma.payment.create({
        data: { userId: buyer.id, kind: "DEPOSIT", amountZar: 15000, method: "EFT", reference: "EFT-88231", proofUrl: "", status: "PENDING" }
      });
    }
  }
  console.log("Seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
