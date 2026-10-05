import { NextRequest, NextResponse } from "next/server";
import { adminCookieValue, checkAdminPassword } from "@/lib/session";
import { APP_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  if (!checkAdminPassword(password)) {
    return NextResponse.redirect(`${APP_URL}/admin?error=1`, 303);
  }
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
