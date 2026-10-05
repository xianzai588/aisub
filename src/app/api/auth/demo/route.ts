import { NextRequest, NextResponse } from "next/server";
import { demoLoginEnabled, APP_URL } from "@/lib/env";
import { upsertUserBySub } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

// 演示登录：仅在未配置 OPENAI_CLIENT_ID 或显式 AUTH_DEMO_LOGIN=1 时可用。
// 用固定演示账号直接建立会话，便于本地跑通「下单 → 支付 → 履约」全流程。
async function handle(req: NextRequest) {
  if (!demoLoginEnabled) {
    return NextResponse.redirect(`${APP_URL}/?error=demo_disabled`, 303);
  }
  const ref = req.nextUrl.searchParams.get("ref") || undefined;
  const user = upsertUserBySub({
    provider: "demo",
    sub: "demo-user",
    email: "demo@example.com",
    name: "演示用户",
    ref,
  });
  const res = NextResponse.redirect(`${APP_URL}/subscribe?welcome=1&demo=1`, 303);
  await setSessionCookie(res, user.id);
  return res;
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
