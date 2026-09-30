import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: Request): Promise<NextResponse> {
  // Same-origin redirect so sign-out works on any port/host (no env dependency).
  const res = NextResponse.redirect(new URL("/admin/login", req.url), 303);
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  return POST(req);
}
