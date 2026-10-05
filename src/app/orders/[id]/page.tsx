import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getOrder } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import PayButton from "@/components/PayButton";
import CredentialForm from "@/components/CredentialForm";
import { yuan } from "@/lib/plans";

export const dynamic = "force-dynamic";

const FLOW = ["pending", "paid", "fulfilling", "completed"] as const;
const FLOW_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  fulfilling: "处理中",
  completed: "已完成",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const { id } = await params;
  const order = getOrder(id);
  if (!order || order.user_id !== user.id) notFound();

  const flowIndex = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const abnormal = order.status === "cancelled" || order.status === "refunded";

  // 凭证指引按商品平台区分：Claude 收 Claude 的 Cookie，ChatGPT 收 session JSON，
  // 自定义商品给通用说明（具体以商品描述为准）
  const guide = order.plan_key.startsWith("claude")
    ? {
        steps: [
          <>1. 在本浏览器登录 <a className="text-indigo-600 hover:underline" href="https://claude.ai" target="_blank" rel="noreferrer">claude.ai</a></>,
          <>2. 按 F12 打开开发者工具 → Application（应用）→ Cookies → <span className="break-all">https://claude.ai</span></>,
          <>3. 找到 <span className="font-mono">sessionKey</span>（以 sk-ant-sid01- 开头），完整复制粘贴到下方提交</>,
        ],
        risk: "该 Cookie 等同于你 Claude 账号的登录态，仅用于本次开通。开通完成后建议在 Claude 设置中登出所有会话，使旧凭证失效。",
        placeholder: "粘贴 sessionKey 完整值（sk-ant-sid01-…）",
      }
    : order.plan_key.startsWith("custom-")
      ? {
          steps: [
            <>1. 按商品说明准备对应平台的账号凭证（Cookie 或 session 信息）</>,
            <>2. 如不确定获取方式，先联系客服确认，再操作</>,
            <>3. 粘贴到下方提交；提交后可在订单完成前重新提交覆盖</>,
          ],
          risk: "凭证等同于对应账号的操作权限，仅用于本次开通。完成后建议登出对应平台所有会话，使旧凭证失效。",
          placeholder: "粘贴对应平台的账号凭证（Cookie 或 session 信息）…",
        }
      : {
          steps: [
            <>1. 在本浏览器登录 <a className="text-indigo-600 hover:underline" href="https://chatgpt.com" target="_blank" rel="noreferrer">chatgpt.com</a></>,
            <>2. 打开 <a className="break-all text-indigo-600 hover:underline" href="https://chatgpt.com/api/auth/session" target="_blank" rel="noreferrer">chatgpt.com/api/auth/session</a></>,
            <>3. 页面内全选（Ctrl/Cmd+A）复制（Ctrl/Cmd+C），粘贴到下方提交</>,
          ],
          risk: "这段 JSON 里的 accessToken 等同于账号网页端的操作权限，仅用于本次开通。开通完成后建议在 ChatGPT 设置中登出所有设备，使旧凭证失效。",
          placeholder: "在这里粘贴从 https://chatgpt.com/api/auth/session 复制的完整 JSON…",
        };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">订单详情</h1>
        <Link href="/orders" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← 返回列表
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">{order.title}</div>
            <div className="mt-1 text-xs text-zinc-400">订单号 {order.id}</div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="mt-6 text-3xl font-bold">¥{yuan(order.amount_cents)}</div>

        <dl className="mt-6 space-y-2 text-sm text-zinc-500">
          <div className="flex justify-between">
            <dt>创建时间</dt>
            <dd>{order.created_at.slice(0, 19).replace("T", " ")}</dd>
          </div>
          <div className="flex justify-between">
            <dt>最近更新</dt>
            <dd>{order.updated_at.slice(0, 19).replace("T", " ")}</dd>
          </div>
          {order.payment_ref && (
            <div className="flex justify-between">
              <dt>支付凭证</dt>
              <dd className="font-mono text-xs">
                {order.payment_provider} · {order.payment_ref}
              </dd>
            </div>
          )}
          {order.note && (
            <div className="flex justify-between gap-8">
              <dt className="shrink-0">运营备注</dt>
              <dd className="text-right">{order.note}</dd>
            </div>
          )}
        </dl>

        {order.status === "pending" && (
          <div className="mt-8">
            <PayButton orderId={order.id} />
          </div>
        )}
      </div>

      {order.kind === "subscription" && !abnormal && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-medium text-zinc-700">开通信息（人工履约）</h2>
          {order.status === "pending" ? (
            <p className="mt-3 text-sm text-zinc-500">
              支付完成后，此处会开放提交 ChatGPT 账号信息的入口。
            </p>
          ) : order.status === "completed" ? (
            <p className="mt-3 text-sm text-emerald-600">
              {order.credential_cleared_at
                ? "✓ 订单已完成，你提交的账号信息已按约定自动删除。"
                : "✓ 订单已完成。"}
            </p>
          ) : (
            <div className="mt-4">
              <ol className="mb-4 space-y-1.5 text-sm leading-6 text-zinc-600">
                {guide.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <CredentialForm
                orderId={order.id}
                submittedAt={order.credential_submitted_at}
                placeholder={guide.placeholder}
              />
              <p className="mt-3 text-xs leading-5 text-rose-500">
                风险提示：{guide.risk}
              </p>
            </div>
          )}
        </div>
      )}

      {abnormal ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          该订单已{order.status === "cancelled" ? "取消" : "退款"}。
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-medium text-zinc-700">进度</h2>
          <ol className="mt-4 flex items-center gap-2">
            {FLOW.map((s, i) => {
              const done = flowIndex >= i && flowIndex !== -1;
              return (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium ${
                      done ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`hidden text-xs sm:inline ${
                      done ? "text-zinc-800" : "text-zinc-400"
                    }`}
                  >
                    {FLOW_LABEL[s]}
                  </span>
                  {i < FLOW.length - 1 && (
                    <div
                      className={`h-px flex-1 ${flowIndex > i ? "bg-indigo-400" : "bg-zinc-200"}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-xs leading-5 text-zinc-400">
            付款到账后，运营会在后台核对并推进状态（paid → fulfilling → completed）。
            演示环境可用管理员账号登录 /admin 手动推进，体验完整流水线。
          </p>
        </div>
      )}
    </div>
  );
}
