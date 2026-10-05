"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, yuan } from "@/lib/plans";

export interface AdminOrder {
  id: string;
  kind: string;
  title: string;
  amount_cents: number;
  status: string;
  note: string;
  payment_ref: string;
  email: string;
  name: string;
  created_at: string;
  hasCredential: boolean;
  fulfillUrl?: string;
}

const KIND_LABEL: Record<string, string> = {
  subscription: "订阅",
  topup: "充值",
  reward: "奖励",
};

function planBadge(planType: string): { label: string; cls: string } {
  const p = planType.toLowerCase();
  if (p.includes("pro")) return { label: "Pro", cls: "bg-purple-100 text-purple-800" };
  if (p.includes("plus")) return { label: "Plus", cls: "bg-emerald-100 text-emerald-800" };
  if (p.includes("free")) return { label: "Free", cls: "bg-zinc-100 text-zinc-600" };
  return { label: planType, cls: "bg-zinc-100 text-zinc-600" };
}

interface CredentialData {
  present: boolean;
  value?: string;
  summary?: Record<string, string>;
  submittedAt?: string | null;
  usedAt?: string | null;
  clearedAt?: string | null;
}

export default function AdminOrderRow({
  order,
  transitions,
}: {
  order: AdminOrder;
  transitions: string[];
}) {
  const router = useRouter();
  // 下拉默认指向第一个合法的下一步状态；终态（无流转）时保持当前状态
  const [status, setStatus] = useState(transitions[0] ?? order.status);
  const [note, setNote] = useState(order.note);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [cred, setCred] = useState<CredentialData | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<
    | { ok: boolean; planType?: string; email?: string; hint?: string }
    | null
  >(null);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: status !== order.status ? status : undefined,
          note: note !== order.note ? note : undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setMessage(res.ok && data.ok ? "已保存" : `失败：${data.error ?? res.status}`);
      if (res.ok && data.ok) router.refresh();
    } catch {
      setMessage("网络错误");
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setCredLoading(true);
    setCredError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/credential`);
      const data = (await res.json()) as CredentialData & { error?: string };
      if (!res.ok) {
        setCred(null);
        setCredError(data.error ?? `加载失败（${res.status}）`);
      } else {
        setCred(data);
      }
    } catch {
      setCredError("网络错误");
    } finally {
      setCredLoading(false);
    }
  }

  async function runVerify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/credential/verify`);
      setVerifyResult(
        (await res.json()) as {
          ok: boolean;
          planType?: string;
          email?: string;
          hint?: string;
        }
      );
    } catch {
      setVerifyResult({ ok: false, hint: "网络错误" });
    } finally {
      setVerifying(false);
    }
  }

  async function credAction(action: "used" | "clear") {
    const res = await fetch(`/api/admin/orders/${order.id}/credential`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setCredError(`操作失败（${res.status}）`);
      return;
    }
    if (action === "clear") {
      setExpanded(false);
      setCred(null);
    } else if (cred) {
      setCred({ ...cred, usedAt: new Date().toISOString() });
    }
    router.refresh();
  }

  const changed = status !== order.status || note !== order.note;
  const time = order.created_at.slice(0, 16).replace("T", " ");

  return (
    <>
      <tr className="border-t border-zinc-100 align-middle text-sm">
        <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{order.id.slice(0, 8)}</td>
        <td className="px-3 py-2.5">{time}</td>
        <td className="px-3 py-2.5">{order.email || order.name || "-"}</td>
        <td className="px-3 py-2.5">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
            {KIND_LABEL[order.kind] ?? order.kind}
          </span>{" "}
          {order.title}
          {order.payment_ref && (
            <div className="text-xs text-zinc-400">ref: {order.payment_ref}</div>
          )}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">¥{yuan(order.amount_cents)}</td>
        <td className="px-3 py-2.5">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={transitions.length === 0}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs disabled:opacity-40"
          >
            {transitions.length === 0 && <option value={status}>{STATUS_LABEL[status]}</option>}
            {transitions.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注（卡号 / 处理记录）"
            className="w-40 rounded-lg border border-zinc-300 px-2 py-1 text-xs"
          />
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {order.hasCredential && (
              <button
                onClick={toggleExpand}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  expanded
                    ? "bg-indigo-600 text-white"
                    : "border border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                凭证
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || (!changed && !message)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
          {message && <div className="mt-1 text-xs text-zinc-500">{message}</div>}
        </td>
      </tr>

      {expanded && (
        <tr className="border-t border-indigo-100 bg-indigo-50/40">
          <td colSpan={8} className="px-6 py-4">
            {credLoading && <p className="text-sm text-zinc-500">解密读取中…</p>}
            {credError && <p className="text-sm text-rose-600">{credError}</p>}
            {cred && !cred.present && (
              <p className="text-sm text-zinc-500">该订单当前没有已提交的凭证（可能已被清除）。</p>
            )}
            {cred?.present && (
              <div className="space-y-3">
                <div>
                  <button
                    onClick={runVerify}
                    disabled={verifying}
                    className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {verifying ? "验证中…" : "验证凭证（调 OpenAI 核对）"}
                  </button>
                </div>
                {verifyResult && (
                  <div
                    className={`rounded-xl border p-3 text-sm ${
                      verifyResult.ok
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-rose-200 bg-rose-50"
                    }`}
                  >
                    {verifyResult.ok ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {verifyResult.planType && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              planBadge(verifyResult.planType).cls
                            }`}
                          >
                            {planBadge(verifyResult.planType).label}
                          </span>
                        )}
                        {verifyResult.email && (
                          <span className="text-zinc-600">{verifyResult.email}</span>
                        )}
                        <span className="font-medium text-emerald-700">✓ 凭证有效</span>
                      </div>
                    ) : (
                      <p className="text-rose-700">验证失败：{verifyResult.hint ?? "未知错误"}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span>提交时间：{cred.submittedAt?.slice(0, 19).replace("T", " ") ?? "-"}</span>
                  {cred.usedAt && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                      已标记使用
                    </span>
                  )}
                  <div className="ml-auto flex gap-2">
                    <a
                      href={order.fulfillUrl || "https://chatgpt.com/#pricing"}
                      target="_blank"
                      rel="noreferrer"
                      title="浏览器导入 Cookie 后点此打开升级页，用你的卡完成付款"
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      进入充值页 ↗
                    </a>
                    {!cred.usedAt && (
                      <button
                        onClick={() => credAction("used")}
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 hover:bg-zinc-50"
                      >
                        标记已使用
                      </button>
                    )}
                    <button
                      onClick={() => credAction("clear")}
                      className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-rose-600 hover:bg-rose-50"
                    >
                      立即清除
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {Object.entries(cred.summary ?? {}).map(([k, v]) => (
                    <span key={k}>
                      <span className="text-zinc-400">{k}：</span>
                      <span className="font-medium">{v}</span>
                    </span>
                  ))}
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs">
                  {cred.value}
                </pre>
                <p className="text-xs text-zinc-400">
                  凭证等同于该账号网页端的操作权限，仅用于本单履约；订单标记完成时会自动删除。
                </p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
