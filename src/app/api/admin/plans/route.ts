import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { listPlans, parsePlanBody, savePlan } from "@/lib/store";

export const dynamic = "force-dynamic";

// 新增商品（管理员）
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
  const plan = savePlan(parsed.value);
  return NextResponse.json({ ok: true, plan });
}

// 商品列表（含停用，管理员）
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ plans: listPlans(true) });
}
