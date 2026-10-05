import { getCurrentUser } from "@/lib/session";
import LoginOptions from "@/components/LoginOptions";
import SubscribeButton from "@/components/SubscribeButton";
import { yuan } from "@/lib/plans";
import { listPlans } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const user = await getCurrentUser();
  const plans = listPlans();

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold">先登录，再订阅</h1>
        <p className="mt-2 text-sm text-zinc-500">
          订单会关联到你的账号。使用 ChatGPT 账号授权登录即可，无需密码。
        </p>
        <div className="mt-8">
          <LoginOptions />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {welcome && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          登录成功，欢迎，{user.name || user.email || "用户"}！
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold">选择套餐</h1>
        <p className="mt-1 text-sm text-zinc-500">
          付款完成后由运营人工核对开通（演示流程）；开通到当前登录账号：{user.email || user.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className="relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6"
          >
            {plan.badge && (
              <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                {plan.badge}
              </span>
            )}
            {plan.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={plan.imageUrl}
                alt=""
                className="mb-4 h-32 w-full rounded-xl object-cover"
              />
            )}
            <h2 className="font-semibold">{plan.name}</h2>
            <div className="mt-2 text-3xl font-bold">¥{yuan(plan.priceCents)}</div>
            <p className="mt-1 text-sm text-zinc-500">{plan.tagline}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-600">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <SubscribeButton planKey={plan.key} className="mt-5" />
          </div>
        ))}
      </div>
    </div>
  );
}
