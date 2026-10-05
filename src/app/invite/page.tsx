import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { countUsersReferredBy, sumRewardCents } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const link = `${APP_URL}/?ref=${user.referral_code}`;
  const invited = countUsersReferredBy(user.referral_code);
  const rewards = sumRewardCents(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">我的邀请</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-500">
          把链接分享给朋友：TA 注册并完成首个订阅订单后，你的余额将收到 ¥10.00 奖励。
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <code className="flex-1 truncate text-sm">{link}</code>
          <CopyButton text={link} label="复制链接" />
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm text-zinc-500">
          邀请码
          <code className="rounded bg-zinc-100 px-2 py-1 font-mono">{user.referral_code}</code>
          <CopyButton text={user.referral_code} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">已邀请用户</div>
          <div className="mt-1 text-3xl font-bold">{invited}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm text-zinc-500">累计奖励</div>
          <div className="mt-1 text-3xl font-bold">¥{(rewards / 100).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
