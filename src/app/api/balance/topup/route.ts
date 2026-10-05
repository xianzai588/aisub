import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createOrder } from "@/lib/db";
import { yuan } from "@/lib/plans";
import { topupAmountsFromSetting } from "@/lib/store";

export const dynamic = "force-dynamic";

// 创建余额充值订单（走同一套订单/支付流水线）
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { amountCents?: number } = {};
  try {
    body = (await req.json()) as { amountCents?: number };
  } catch {
    // 允许空 body，走 invalid_amount 分支
  }
  if (!topupAmountsFromSetting().includes(body.amountCents ?? -1)) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const order = createOrder({
    userId: user.id,
    kind: "topup",
    title: `余额充值 ¥${yuan(body.amountCents!)}`,
    amountCents: body.amountCents!,
  });
  return NextResponse.json({ id: order.id });
}
