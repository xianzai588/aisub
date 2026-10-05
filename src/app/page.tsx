import Link from "next/link";
import LoginOptions from "@/components/LoginOptions";
import { yuan } from "@/lib/plans";
import { listPlans } from "@/lib/store";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_configured: "尚未配置 OPENAI_CLIENT_ID：请先在 OpenAI 申请 client id 并填入 .env.local（详见 README），或使用演示登录。",
  demo_disabled: "演示登录已被关闭。",
  tx_expired: "登录会话已过期或被重放，请重新发起登录。",
  state_mismatch: "state 校验失败，登录已终止（防 CSRF 保护）。",
  missing_code: "回调缺少授权码。",
  token_failed: "换取 token 或校验 id_token 失败，请查看服务端日志。",
  oauth_access_denied: "你在 OpenAI 侧拒绝了授权。",
};

const STEPS = [
  { n: "1", title: "用 ChatGPT 登录", desc: "点击 Continue with ChatGPT，在 auth.openai.com 完成授权，全程不经手密码。" },
  { n: "2", title: "选择套餐下单", desc: "挑好套餐创建订单，系统记录订单并与你的账号关联。" },
  { n: "3", title: "完成支付", desc: "接你有渠道的支付方式付款（演示环境内置模拟支付）。" },
  { n: "4", title: "核对开通", desc: "运营在后台核对到账后推进订单状态，完成开通。" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; error?: string }>;
}) {
  const { ref, error } = await searchParams;
  const plans = listPlans().slice(0, 4);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-10 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          AI 会员订阅
          <span className="text-indigo-600">自助开通</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-500">
          用官方 Sign in with ChatGPT 登录，选套餐、付款、等待开通。
          平台全程不接触你的账号密码，也不需要粘贴 session JSON。
        </p>
        <div id="login" className="mt-8">
          <LoginOptions ref={ref} />
        </div>
        {ref && (
          <p className="mt-3 text-sm text-emerald-600">
            已记录邀请码 {ref}，登录后完成首单可给邀请人发放奖励。
          </p>
        )}
        {error && (
          <p className="mx-auto mt-4 max-w-xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ERRORS[error] ?? `登录失败：${error}`}
          </p>
        )}
      </section>

      {/* 流程 */}
      <section>
        <h2 className="text-center text-2xl font-semibold">四步完成订阅</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 font-semibold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 套餐预览 */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">热门套餐</h2>
          <Link href="/subscribe" className="text-sm text-indigo-600 hover:underline">
            查看全部 →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.key} className="rounded-2xl border border-zinc-200 bg-white p-5">
              {plan.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={plan.imageUrl}
                  alt=""
                  className="mb-3 h-20 w-full rounded-lg object-cover"
                />
              )}
              <div className="text-sm text-zinc-500">{plan.name}</div>
              <div className="mt-1 text-2xl font-bold">¥{yuan(plan.priceCents)}</div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{plan.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 安全对比 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-semibold">为什么不让用户「复制 session JSON」？</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5">
            <div className="font-medium text-rose-700">✗ 老式做法：粘贴 /api/auth/session</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
              <li>· accessToken ≈ 整个账号的网页端操作权限</li>
              <li>· 平台服务器必须保存用户有效凭证，泄露即账号泄露</li>
              <li>· 用户无法最小化授权，也无法随时撤销</li>
              <li>· 平台侧合规与信任成本极高</li>
            </ul>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="font-medium text-emerald-700">✓ 本项目：官方 OAuth + PKCE</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
              <li>· 用户在 auth.openai.com 亲自登录并授权</li>
              <li>· 平台只拿到经过验证的身份信息（sub/email/name）</li>
              <li>· 不保存任何 ChatGPT 凭证，id_token 验签后即弃</li>
              <li>· scope 最小化，符合 OpenAI 官方集成规范</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
