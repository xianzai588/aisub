import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { deletePlan, parsePlanBody, savePlan } from "@/lib/store";

export const dynamic = "force-dynamic";

// 更新商品（全量字段）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = parsePlanBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const plan = savePlan({ ...parsed.value, id });
  return NextResponse.json({ ok: true, plan });
}

// 删除商品（订单保留快照，不受影响）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  deletePlan(id);
  return NextResponse.json({ ok: true });
}
