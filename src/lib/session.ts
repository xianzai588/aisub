import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_SECRET, ADMIN_PASSWORD, IS_PRODUCTION } from "./env";
import { getUserById, type User } from "./db";

const secretKey = new TextEncoder().encode(SESSION_SECRET);
const SESSION_COOKIE = "siwc_session";
const ADMIN_COOKIE = "siwc_admin";
const EIGHT_HOURS = 60 * 60 * 8;

// fail-closed：生产环境使用默认密钥时直接拒绝签发/校验会话，
// 避免"忘配密钥 → 任何人可伪造 session"的部署事故。
function ensureSafeSecret(): void {
  if (IS_PRODUCTION && SESSION_SECRET.startsWith("dev-only")) {
    throw new Error(
      "SESSION_SECRET 仍为默认开发值：生产环境必须在环境变量中设置随机密钥后重启"
    );
  }
}

export async function signSessionToken(userId: string): Promise<string> {
  ensureSafeSecret();
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
  ensureSafeSecret();
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

// ---------- 管理后台鉴权 ----------
// 登录成功后签发随机服务端会话令牌（内存存储，8 小时过期）。
// 不再用"密码派生固定 Cookie"：否则密码不改，Cookie 永久有效且可被离线算出。
// 注意：内存存储仅适用单实例；多实例部署需移到 Redis 等共享存储。

const adminSessions = (() => {
  // Next 生产构建中页面与路由是独立模块实例，模块级 Map 会各持一份；
  // 挂到 globalThis 保证登录签发与页面校验共享同一份会话表。
  const g = globalThis as unknown as { __siwcAdminSessions?: Map<string, number> };
  return (g.__siwcAdminSessions ??= new Map<string, number>());
})(); // token -> expiresAt(ms)
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function createAdminSession(): { token: string; maxAgeSeconds: number } {
  const token = randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  for (const [k, exp] of adminSessions) {
    if (exp < Date.now()) adminSessions.delete(k);
  }
  return { token, maxAgeSeconds: ADMIN_SESSION_TTL_MS / 1000 };
}

export function isAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const exp = adminSessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isAdminToken(store.get(ADMIN_COOKIE)?.value);
}
