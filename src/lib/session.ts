import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_SECRET, ADMIN_PASSWORD } from "./env";
import { getUserById, type User } from "./db";

const secretKey = new TextEncoder().encode(SESSION_SECRET);
const SESSION_COOKIE = "siwc_session";
const ADMIN_COOKIE = "siwc_admin";
const EIGHT_HOURS = 60 * 60 * 8;

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EIGHT_HOURS}s`)
    .sign(secretKey);
}

export async function setSessionCookie(response: NextResponse, userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EIGHT_HOURS,
  });
}

// 页面（Server Component）里读取当前登录用户；未登录返回 null
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    const uid = typeof payload.uid === "string" ? payload.uid : "";
    if (!uid) return null;
    return getUserById(uid) ?? null;
  } catch {
    return null;
  }
}

export async function clearSessionCookie(response: NextResponse): Promise<void> {
  response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
}

// ---------- 管理后台鉴权（简单口令 + 摘要 Cookie，演示级） ----------

function adminToken(): string {
  return createHash("sha256").update(`siwc-admin:${ADMIN_PASSWORD}`).digest("hex");
}

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function adminCookieValue(): string {
  return adminToken();
}

export function isAdminCookie(value: string | undefined): boolean {
  return !!value && value === adminCookieValue();
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isAdminCookie(store.get(ADMIN_COOKIE)?.value);
}
