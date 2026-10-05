import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { getSettings, listPlans } from "@/lib/store";
import AdminSettings from "@/components/AdminSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!(await isAdmin())) redirect("/admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">店铺设置</h1>
        <a href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← 返回订单履约
        </a>
      </div>
      <p className="text-sm text-zinc-500">
        站名/Logo/充值金额与全部商品都在这里改，保存后前台立即生效；历史订单使用下单时的快照，不受改价影响。
      </p>
      <AdminSettings settings={getSettings()} plans={listPlans(true)} />
    </div>
  );
}
