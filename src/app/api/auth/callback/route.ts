import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, takeTx, verifyIdToken } from "@/lib/oidc";
import { upsertUserBySub } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";
import { APP_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

// OAuth 回调：校验 state/error → 换 token → 验证 id_token（JWKS + nonce）
// → 按 sub 落库/登录 → 发放第一方会话 Cookie
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fail = (reason: string) =>
    NextResponse.redirect(`${APP_URL}/?error=${encodeURIComponent(reason)}`, 303);

  if (sp.get("error")) return fail(`oauth_${sp.get("error")}`);

  // 事务一次性：取出即删除，缺失/过期/重放都直接终止登录
  const tx = takeTx(req.cookies.get("siwc_tx")?.value);
  if (!tx) return fail("tx_expired");
  if (!sp.get("state") || sp.get("state") !== tx.state) return fail("state_mismatch");

  const code = sp.get("code");
  if (!code) return fail("missing_code");

  try {
    const tokens = await exchangeCode(code, tx.codeVerifier);
    const claims = await verifyIdToken(tokens.id_token, tx.nonce);

    const user = upsertUserBySub({
      provider: "openai",
      sub: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : "",
      name: typeof claims.name === "string" ? claims.name : "",
      avatarUrl: typeof claims.picture === "string" ? claims.picture : "",
      ref: tx.ref,
    });

    const res = NextResponse.redirect(`${APP_URL}/subscribe?welcome=1`, 303);
    await setSessionCookie(res, user.id);
    res.cookies.set({ name: "siwc_tx", value: "", path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("[auth/callback]", e);
    return fail("token_failed");
  }
}
