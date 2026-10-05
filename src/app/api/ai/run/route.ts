import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// 「使用用户自己的 ChatGPT plan 跑推理」演示端点。
//
// 注意：网站身份登录（openid profile email）只返回 id_token，没有 access_token。
// 要用用户的 Plus/Pro plan 调 Responses API，需要走官方的 token-sharing 授权，
// 这是单独的注册/审核流程，见：
//   https://developers.openai.com/siwc/token-sharing-open-source/sign-in
// 拿到带 plan scope 的 access token 后，在这里用它调用：
//   POST https://api.openai.com/v1/responses  (Authorization: Bearer <user access_token>)
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json(
    {
      error: "plan_usage_not_enabled",
      message:
        "身份登录已完成，但「使用用户 ChatGPT plan」需要额外申请 token-sharing 授权；启用前本端点固定返回 501。",
      docs: "https://developers.openai.com/siwc/token-sharing-open-source/sign-in",
    },
    { status: 501 }
  );
}
