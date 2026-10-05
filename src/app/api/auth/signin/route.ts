import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, createTx } from "@/lib/oidc";
import { APP_URL, OPENAI_CLIENT_ID } from "@/lib/env";

export const dynamic = "force-dynamic";

// 发起登录：生成 PKCE 事务（服务端保存），跳转 auth.openai.com
export async function GET(req: NextRequest) {
  if (!OPENAI_CLIENT_ID) {
    return NextResponse.redirect(`${APP_URL}/?error=not_configured`, 303);
  }
  const ref = req.nextUrl.searchParams.get("ref") || undefined;
  const { id, tx } = createTx(ref);

  const res = NextResponse.redirect(buildAuthorizeUrl(tx), 303);
  res.cookies.set({
    name: "siwc_tx",
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
