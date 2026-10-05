import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import {
  getOrder,
  markCredentialUsed,
  clearOrderCredential,
} from "@/lib/db";
import { decryptText } from "@/lib/crypto";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await isAdmin())) return false;
  return true;
}

// 运营查看凭证（服务端按需解密；密钥不下发到浏览器）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (!order.credential_enc) {
    return NextResponse.json({ present: false, clearedAt: order.credential_cleared_at });
  }

  let value = "";
  try {
    value = decryptText(order.credential_enc);
  } catch {
    return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
  }

  // 尽力解析 session JSON，给出概要（完整原文在 value 里供复制）
  let summary: Record<string, string> = {};
  try {
    const j = JSON.parse(value) as {
      user?: { email?: string };
      email?: string;
      planType?: string;
      account?: { planType?: string };
      expires?: string;
      accessToken?: string;
    };
    summary = {
      邮箱: j.user?.email ?? j.email ?? "（未解析到）",
      套餐: j.planType ?? j.account?.planType ?? "（未解析到）",
      过期时间: j.expires ?? "（未解析到）",
      ...(j.accessToken
        ? { accessToken: `${j.accessToken.slice(0, 24)}…（完整值在下方原文中）` }
        : {}),
    };
  } catch {
    summary = { 类型: "非 JSON 文本（可能是 Cookie 字符串）" };
  }

  return NextResponse.json({
    present: true,
    value,
    summary,
    submittedAt: order.credential_submitted_at,
    usedAt: order.credential_used_at,
  });
}

// 运营操作：标记已使用 / 立即清除
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  let action = "";
  try {
    action = ((await req.json()) as { action?: string }).action ?? "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (action === "used") {
    markCredentialUsed(order.id);
  } else if (action === "clear") {
    clearOrderCredential(order.id);
  } else {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
