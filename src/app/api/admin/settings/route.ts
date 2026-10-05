import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { getSetting, setSetting } from "@/lib/store";

export const dynamic = "force-dynamic";

// 店铺设置：站名 / Logo（URL 或 data:image） / 充值金额（逗号分隔的元）
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { site_name?: unknown; logo_url?: unknown; topup_amounts?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (body.site_name !== undefined) {
    const v = typeof body.site_name === "string" ? body.site_name.trim() : "";
    if (!v || v.length > 40) {
      return NextResponse.json({ error: "站点名需 1-40 字" }, { status: 400 });
    }
    setSetting("site_name", v);
  }

  if (body.logo_url !== undefined) {
    const v = typeof body.logo_url === "string" ? body.logo_url.trim() : "";
    const okShape = v === "" || /^https?:\/\//.test(v) || /^data:image\//.test(v);
    if (!okShape || v.length > 400_000) {
      return NextResponse.json(
        { error: "Logo 需为 http(s) 图片地址或 ≤400KB 的图片数据" },
        { status: 400 }
      );
    }
    setSetting("logo_url", v);
  }

  if (body.topup_amounts !== undefined) {
    const v = typeof body.topup_amounts === "string" ? body.topup_amounts.trim() : "";
    if (!/^\d{1,4}(\.\d{1,2})?(\s*,\s*\d{1,4}(\.\d{1,2})?){0,9}$/.test(v)) {
      return NextResponse.json(
        { error: "充值金额格式：逗号分隔的元数，如 50,100,500（最多 10 个）" },
        { status: 400 }
      );
    }
    setSetting("topup_amounts", v);
  }

  return NextResponse.json({ ok: true });
}

// 读取当前设置（登录管理员）
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    site_name: getSetting("site_name", "AISub"),
    logo_url: getSetting("logo_url", ""),
    topup_amounts: getSetting("topup_amounts", "50,100,500"),
  });
}
