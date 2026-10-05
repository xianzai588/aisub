import { getCurrentUser, isAdmin } from "@/lib/session";
import {
  listAllOrdersDetailed,
  countUsers,
  STATUS_TRANSITIONS,
  type OrderStatus,
} from "@/lib/db";
import { STATUS_LABEL, yuan } from "@/lib/plans";
import { listPlans } from "@/lib/store";
import AdminOrderRow from "@/components/AdminOrderRow";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mins?: string }>;
}) {
  const { error, mins } = await searchParams;
  const user = await getCurrentUser();

  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-sm py-16">
        <h1 className="text-2xl font-semibold">管理后台</h1>
        <p className="mt-2 text-sm text-zinc-500">
          当前登录用户：{user ? user.email || user.name || "已登录" : "未登录"}（管理员身份独立于用户登录）
        </p>
        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error === "rate"
              ? `失败次数过多，请约 ${mins ?? "15"} 分钟后再试。`
              : error === "default_password"
                ? "ADMIN_PASSWORD 仍为默认值 admin123，生产环境已拒绝登录；请设置环境变量后重启服务。"
                : "口令错误，请重试。"}
          </p>
        )}
        <form action="/api/admin/login" method="post" className="mt-6 space-y-3">
          <input
            type="password"
            name="password"
            placeholder="管理口令（ADMIN_PASSWORD，默认 admin123）"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm"
          />
          <button className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-700">
            进入后台
          </button>
        </form>
      </div>
    );
  }

  const orders = listAllOrdersDetailed();
  const users = countUsers();
  const fulfillUrls = new Map(listPlans(true).map((p) => [p.key, p.fulfillUrl]));
  const paidCount = orders.filter((o) => o.status === "paid").length;
  const revenue = orders
    .filter((o) => ["paid", "fulfilling", "completed"].includes(o.status))
    .reduce((sum, o) => sum + o.amount_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">订单履约后台</h1>
        <a
          href="/admin/settings"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          店铺设置（品牌 / 商品 / 价格 / 充值页链接）
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "用户数", value: String(users) },
          { label: "待处理订单", value: String(paidCount) },
          { label: "有效流水", value: `¥${yuan(revenue)}` },
          { label: "订单总数", value: String(orders.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-400">{s.label}</div>
            <div className="mt-1 text-xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-zinc-400">
              <th className="px-3 py-3 font-medium">单号</th>
              <th className="px-3 py-3 font-medium">时间</th>
              <th className="px-3 py-3 font-medium">用户</th>
              <th className="px-3 py-3 font-medium">内容</th>
              <th className="px-3 py-3 font-medium">金额</th>
              <th className="px-3 py-3 font-medium">状态</th>
              <th className="px-3 py-3 font-medium">备注</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-zinc-400">
                  暂无订单
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <AdminOrderRow
                key={o.id}
                order={{
                  id: o.id,
                  kind: o.kind,
                  title: o.title,
                  amount_cents: o.amount_cents,
                  status: o.status,
                  note: o.note,
                  payment_ref: o.payment_ref,
                  email: o.email,
                  name: o.name,
                  created_at: o.created_at,
                  hasCredential: !!o.has_credential,
                  fulfillUrl: fulfillUrls.get(o.plan_key) ?? "",
                }}
                transitions={
                  STATUS_TRANSITIONS[o.status as OrderStatus]?.slice() ?? []
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-zinc-400">
        状态机：{Object.entries(STATUS_TRANSITIONS)
          .map(([k, v]) => `${STATUS_LABEL[k]}→[${v.map((s) => STATUS_LABEL[s]).join(", ")}]`)
          .join("；")}
      </p>
    </div>
  );
}
