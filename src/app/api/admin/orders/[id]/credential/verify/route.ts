import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { getOrder } from "@/lib/db";
import { decryptText } from "@/lib/crypto";
import { verifyCredential } from "@/lib/openai";

export const dynamic = "force-dynamic";

// 后台验证凭证：解密 →（Cookie 先换 session）→ 调 OpenAI accounts/check 核对真伪与套餐。
// 成功返回 { ok, planType, email }；失败返回 { ok:false, hint }（可读原因）。
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (!order.credential_enc) {
    return NextResponse.json({ present: false });
  }

  let raw = "";
  try {
    raw = decryptText(order.credential_enc);
  } catch {
    return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
  }

  try {
    const result = await verifyCredential(raw);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "验证失败";
    const hint = /fetch failed|ENOTFOUND|ECONNREFUSED|aborted|timeout/i.test(msg)
      ? `无法访问 chatgpt.com（${msg}）：请检查服务器出网，或改在浏览器人工核对`
      : msg;
    return NextResponse.json({ ok: false, hint });
  }
}
