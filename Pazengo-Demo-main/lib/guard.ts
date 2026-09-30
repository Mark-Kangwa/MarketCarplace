import { redirect } from "next/navigation";
import { getSession } from "./auth";

export async function guard(): Promise<string> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s.email;
}
