import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/session";
import { getOrder, updateOrderStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

// 模拟支付回调：把 pending 订单标记为 paid。
// 接入真实支付（Stripe / 易支付等）时，这里的逻辑应改为验签后的 webhook。
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
