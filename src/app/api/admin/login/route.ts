import { NextRequest, NextResponse } from "next/server";
import { adminCookieValue, checkAdminPassword } from "@/lib/session";
import { APP_URL, ADMIN_PASSWORD, IS_PRODUCTION } from "@/lib/env";

export const dynamic = "force-dynamic";

// 简易失败限速：单 IP 连续失败 5 次锁定 15 分钟（演示级；生产建议 MFA + 审计）
const fails = new Map<string, { count: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rec = fails.get(ip);
  if (rec && rec.until > Date.now()) {
    const mins = Math.ceil((rec.until - Date.now()) / 60000);
    return NextResponse.redirect(`${APP_URL}/admin?error=rate&mins=${mins}`, 303);
  }

  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  // fail-closed：生产环境拒绝默认口令，避免"忘改密码 → 后台失守"
  if (IS_PRODUCTION && ADMIN_PASSWORD === "admin123") {
    return NextResponse.redirect(`${APP_URL}/admin?error=default_password`, 303);
  }

  if (!checkAdminPassword(password)) {
    const count = (rec?.count ?? 0) + 1;
    fails.set(ip, {
      count,
      until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0,
    });
    return NextResponse.redirect(`${APP_URL}/admin?error=1`, 303);
  }
  fails.delete(ip);

  const res = NextResponse.redirect(`${APP_URL}/admin`, 303);
  res.cookies.set({
    name: "siwc_admin",
    value: adminCookieValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
