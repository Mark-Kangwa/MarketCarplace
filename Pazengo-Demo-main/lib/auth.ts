import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

/** One-time temp password shown to the admin (never stored or emailed). */
export function generateTempPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const COOKIE = "cmp_admin_session";
const USER_COOKIE = "cmp_user_session";

export type UserSession = { id: string; email: string; name: string; role: string; avatarUrl: string };

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? "local-dev-secret-min-32-chars-long-123456";
  return new TextEncoder().encode(s);
}

export async function createSession(email: string): Promise<string> {
  return await new SignJWT({ email, role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function getSession(): Promise<{ email: string } | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    // The admin cookie must carry an ADMIN role claim — a correctly-signed
    // token of any other role (e.g. a buyer session) is not sufficient.
    if (String(payload.role ?? "") !== "ADMIN") return null;
    const email = String(payload.email);
    // DB admins are verified live: a demoted or blocked admin row loses
    // access on the next request. Env credentials have no User row and
    // always pass (the permanent backdoor).
    const row = await prisma.user.findUnique({ where: { email }, select: { role: true, status: true } });
    if (row && (row.role !== "ADMIN" || row.status !== "ACTIVE")) return null;
    return { email };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<string> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s.email;
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function createUserSession(user: { id: string; email: string; name: string; role: string; avatarUrl?: string | null }): Promise<string> {
  return await new SignJWT({ sub: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function getUserSession(): Promise<UserSession | null> {
  const token = cookies().get(USER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = String(payload.role ?? "");
    if (role !== "BUYER" && role !== "DEALER") return null;
    // Blocking revokes immediately: re-checked on every request, not just
    // at sign-in, so a blocked user loses access before cookie expiry.
    const id = String(payload.sub ?? "");
    if (!id) return null;
    const row = await prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true, role: true, status: true, avatarUrl: true }
    });
    if (!row || row.status !== "ACTIVE" || (row.role !== "BUYER" && row.role !== "DEALER")) return null;
    return {
      id,
      email: row.email,
      name: row.name,
      role: row.role,
      avatarUrl: row.avatarUrl ?? ""
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<UserSession> {
  const s = await getUserSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

export function userSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${USER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function clearUserSessionCookie(): string {
  return `${USER_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (email.toLowerCase().trim() !== adminEmail) return false;
  // Support plaintext env password (seeded) and bcrypt hash
  if (password === adminPassword) return true;
  try {
    if (adminPassword.startsWith("$2")) return await bcrypt.compare(password, adminPassword);
  } catch {
    return false;
  }
  return false;
}
