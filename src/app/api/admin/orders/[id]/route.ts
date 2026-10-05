import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { db, updateOrderStatus, type OrderStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID: OrderStatus[] = [
  "pending",
  "paid",
  "fulfilling",
  "completed",
  "cancelled",
  "refunded",
];

// 运营更新订单状态（履约流水线：paid → fulfilling → completed）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { status?: string; note?: string } = {};
  try {
    body = (await req.json()) as { status?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const status = body.status as OrderStatus | undefined;
  if (status && !VALID.includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  let result: { ok: boolean; error?: string } = { ok: true };
  if (status) {
    result = updateOrderStatus(id, status, { note: body.note || undefined });
  } else if (body.note) {
    // 只补备注的场景：直接更新 note 字段
    db.prepare("UPDATE orders SET note = ?, updated_at = ? WHERE id = ?").run(
      body.note,
      new Date().toISOString(),
      id
    );
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
