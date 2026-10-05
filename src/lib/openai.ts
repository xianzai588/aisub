// 凭证验证：用客户提交的凭证调用 OpenAI 接口核对真伪与当前套餐。
// Cookie 型凭证先换 session 拿 accessToken；统一 15s 超时；失败返回可读提示。
// 付款环节（卡 + 3DS）无法也不应自动化，仍由运营人工完成——本模块只做"核对"。

const CHATGPT_ORIGIN = "https://chatgpt.com";
const TIMEOUT_MS = 15_000;

export interface VerifyResult {
  ok: boolean;
  planType?: string;
  email?: string;
  status?: number;
  hint?: string;
}

function hintFor(status: number): string {
  if (status === 401) return "凭证已失效（401）：accessToken 过期或被撤销，请让客户重新提交";
  if (status === 403) return "被风控/Cloudflare 拦截（403）：请在浏览器环境人工核对";
  if (status === 429) return "请求过于频繁（429）：稍后重试";
  return `上游返回 HTTP ${status}`;
}

async function checkAccounts(accessToken: string): Promise<VerifyResult> {
  const res = await fetch(`${CHATGPT_ORIGIN}/backend-api/accounts/check/v4-2023-04-27`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, status: res.status, hint: hintFor(res.status) };
  const j = (await res.json()) as {
    accounts?: Record<string, { account?: { plan_type?: string; email?: string } }>;
  };
  const first = Object.values(j.accounts ?? {})[0];
  return {
    ok: true,
    planType: first?.account?.plan_type,
    email: first?.account?.email,
  };
}

export async function verifyCredential(raw: string): Promise<VerifyResult> {
  const trimmed = raw.trim();

  // 1) session JSON：直接取 accessToken（解析失败才走下方判断；网络错误向上抛）
  if (trimmed.startsWith("{")) {
    let accessToken: string | undefined;
    let email: string | undefined;
    try {
      const j = JSON.parse(trimmed) as {
        accessToken?: string;
        user?: { email?: string };
      };
      accessToken = j.accessToken;
      email = j.user?.email;
    } catch {
      // 不是合法 JSON → 继续走下方判断
    }
    if (accessToken) {
      const r = await checkAccounts(accessToken);
      return { ...r, email: r.email ?? email };
    }
  }

  // 2) Cookie：先换 session 拿 accessToken，再核对
  const m = trimmed.match(/__Secure-next-auth\.session-token=([^;\s]+)/);
  if (m) {
    const res = await fetch(`${CHATGPT_ORIGIN}/api/auth/session`, {
      headers: { Cookie: `__Secure-next-auth.session-token=${m[1]}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, hint: hintFor(res.status) };
    const j = (await res.json()) as { accessToken?: string; user?: { email?: string } };
    if (!j.accessToken) {
      return {
        ok: false,
        hint: "Cookie 已失效：session 接口未返回 accessToken，请让客户重新提交",
      };
    }
    const r = await checkAccounts(j.accessToken);
    return { ...r, email: r.email ?? j.user?.email };
  }

  // 3) 裸 JWT accessToken
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(trimmed)) {
    return checkAccounts(trimmed);
  }

  return {
    ok: false,
    hint: "无法识别凭证类型：请提交 /api/auth/session 的完整 JSON 或 __Secure-next-auth.session-token Cookie",
  };
}
