import { NextResponse } from "next/server";
import { clearUserSessionCookie } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearUserSessionCookie());
  return res;
}
