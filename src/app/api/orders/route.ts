import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createOrder } from "@/lib/db";
import { getPlanByKey } from "@/lib/store";

export const dynamic = "force-dynamic";

// 创建订阅订单（待支付）
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { planKey?: string } = {};
  try {
    body = (await req.json()) as { planKey?: string };
  } catch {
    // 允许空 body，走 unknown_plan 分支
  }
  const plan = getPlanByKey(body.planKey ?? "");
  if (!plan) return NextResponse.json({ error: "unknown_plan" }, { status: 400 });

  const order = createOrder({
    userId: user.id,
    kind: "subscription",
    planKey: plan.key,
    title: plan.name,
    amountCents: plan.priceCents,
  });
  return NextResponse.json({ id: order.id });
}
