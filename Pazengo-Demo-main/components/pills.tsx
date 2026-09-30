export function Pill({ tone, children }: { tone: "green" | "red" | "blue" | "gray" | "amber"; children: React.ReactNode }): JSX.Element {
  const map: Record<string, string> = {
    green: "bg-green-100 text-green-800 border-green-300",
    red: "bg-red-100 text-red-800 border-red-300",
    blue: "bg-blue-50 text-trader border-blue-200",
    gray: "bg-gray-100 text-gray-700 border-gray-300",
    amber: "bg-amber-100 text-amber-900 border-amber-300"
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

export function carStatusTone(s: string): "green" | "red" | "blue" | "gray" | "amber" {
  if (s === "PUBLISHED") return "green";
  if (s === "BLOCKED") return "red";
  if (s === "SOLD") return "blue";
  return "gray";
}

export function listingTone(featured: boolean): "amber" | "gray" {
  return featured ? "amber" : "gray";
}

export function paymentTone(s: string): "green" | "red" | "blue" | "gray" | "amber" {
  if (s === "APPROVED") return "green";
  if (s === "REJECTED") return "red";
  return "amber";
}
