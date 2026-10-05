import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOrder, setOrderCredential } from "@/lib/db";
import { encryptText } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// 客户提交账号凭证（ChatGPT session JSON 或 Cookie），密文落库，供运营人工开通。
// 约束：仅订单本人、仅订阅单、支付后（paid/fulfilling）才可提交；completed 后自动清除。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = getOrder(id);
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.kind !== "subscription") {
    return NextResponse.json({ error: "not_a_subscription" }, { status: 400 });
  }
  if (order.status !== "paid" && order.status !== "fulfilling") {
    return NextResponse.json(
      { error: "credential_not_accepted", message: "订单支付后才能提交账号信息" },
      { status: 409 }
    );
  }

  let value = "";
  try {
    value = ((await req.json()) as { value?: string }).value ?? "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  value = (value ?? "").trim();
  if (value.length < 30 || value.length > 20000) {
    return NextResponse.json(
      { error: "invalid_credential", message: "内容长度不符：请完整粘贴 /api/auth/session 页面的全部 JSON" },
      { status: 400 }
    );
  }

  setOrderCredential(order.id, encryptText(value));
  return NextResponse.json({ ok: true });
}
