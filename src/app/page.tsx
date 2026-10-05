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
          用官方 Sign in with ChatGPT 登录本站，全程不经手你的账号密码。
          下单支付后，按商品指引提交对应平台的账号凭证，由运营人工开通——
          凭证加密存储、仅用于本单履约、完成后自动删除。
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

      {/* 安全说明 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-semibold">账号安全是怎么处理的？</h2>
        <p className="mt-2 text-sm text-zinc-500">
          登录和履约是两件事，分开处理、各自最小化：
        </p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="font-medium text-emerald-700">✓ 登录：官方 OAuth + PKCE</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
              <li>· 在 auth.openai.com 亲自登录并授权，平台不经手账号密码</li>
              <li>· 平台只拿到经过验签的身份信息（sub / email / name）</li>
              <li>· 不保存任何 OpenAI 登录凭证，id_token 验签后即弃</li>
            </ul>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-5">
            <div className="font-medium text-sky-700">✓ 履约：凭证单独提交、用完即删</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
              <li>· 支付后按商品指引提交对应平台凭证（不是账号密码）</li>
              <li>· AES-256-GCM 加密存储，仅运营为你的订单履约时解密</li>
              <li>· 订单完成 / 取消 / 退款自动删除；也可随时要求手动删除</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-400">
          老式代充要求账号密码、长期共享会话、用完不删——这些我们都不做。
          提交凭证前请确认你信任本站；也可以选择自行开通。
        </p>
      </section>
    </div>
  );
}
