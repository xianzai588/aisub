import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/session";
import { getOrder, updateOrderStatus } from "@/lib/db";
import { IS_PRODUCTION, PAYMENT_PROVIDER } from "@/lib/env";

export const dynamic = "force-dynamic";

// 模拟支付回调：把 pending 订单标记为 paid。
// 接入真实支付（Stripe / 易支付等）时，这里的逻辑应改为验签后的 webhook。
//
// fail-closed：生产环境只允许显式设置 PAYMENT_PROVIDER=mock 时使用模拟支付，
// 防止"忘接真实支付 → 用户免费下单"的上线事故。
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (IS_PRODUCTION && PAYMENT_PROVIDER !== "mock") {
    return NextResponse.json(
      {
        error: "payment_provider_not_configured",
        message: "生产环境未接入真实支付渠道，模拟支付已禁用（如需演示请显式设置 PAYMENT_PROVIDER=mock）",
      },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = getOrder(id);
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "order_not_payable" }, { status: 409 });
  }

  const result = updateOrderStatus(id, "paid", {
    paymentProvider: "mock",
    paymentRef: `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
