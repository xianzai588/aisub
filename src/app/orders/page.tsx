import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listUserOrders } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { yuan } from "@/lib/plans";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  subscription: "订阅",
  topup: "充值",
  reward: "奖励",
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const orders = listUserOrders(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">我的订单</h1>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="text-zinc-500">还没有订单。</p>
          <Link
            href="/subscribe"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            去订阅
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-400">
                <th className="px-4 py-3 font-medium">订单</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">金额</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{o.title}</td>
                  <td className="px-4 py-3 text-zinc-500">{KIND_LABEL[o.kind] ?? o.kind}</td>
                  <td className="px-4 py-3 whitespace-nowrap">¥{yuan(o.amount_cents)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {o.created_at.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      详情 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
