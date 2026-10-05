import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listUserOrders } from "@/lib/db";
import TopupButtons from "@/components/TopupButtons";
import StatusBadge from "@/components/StatusBadge";
import { yuan } from "@/lib/plans";
import { topupAmountsFromSetting } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BalancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const walletOrders = listUserOrders(user.id).filter((o) => o.kind !== "subscription");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">余额</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="text-sm text-zinc-500">当前余额</div>
        <div className="mt-1 text-4xl font-bold">¥{yuan(user.balance_cents)}</div>
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          余额可用于抵扣订单（演示架构预留，尚未在下单流程启用抵扣）。
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium">充值</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">
          充值会创建一张充值订单，走同一套支付/到账流水线。
        </p>
        <TopupButtons amounts={topupAmountsFromSetting()} />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-3 font-medium">充值 / 奖励记录</h2>
        {walletOrders.length === 0 ? (
          <p className="text-sm text-zinc-400">暂无记录</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {walletOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div>{o.title}</div>
                  <div className="text-xs text-zinc-400">
                    {o.created_at.slice(0, 16).replace("T", " ")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="whitespace-nowrap">¥{yuan(o.amount_cents)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
