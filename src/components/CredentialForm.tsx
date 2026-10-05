"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 客户提交 ChatGPT 账号凭证（session JSON / Cookie）。提交后可在开通前重新提交覆盖。
export default function CredentialForm({
  orderId,
  submittedAt,
}: {
  orderId: string;
  submittedAt: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    setDone(false);
    try {
      const res = await fetch(`/api/orders/${orderId}/credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok) {
        setValue("");
        setDone(true);
        router.refresh();
      } else {
        setError(data.message ?? data.error ?? "提交失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {submittedAt && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          已于 {submittedAt.slice(0, 19).replace("T", " ")} 提交过凭证。可重新提交覆盖；订单完成后系统会自动删除。
        </p>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="在这里粘贴从 https://chatgpt.com/api/auth/session 复制的完整 JSON…"
        className="w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-xs"
      />
      <button
        onClick={submit}
        disabled={loading || value.trim().length < 30}
        className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "提交中…" : "提交账号信息"}
      </button>
      {done && (
        <p className="mt-2 text-center text-xs text-emerald-600">
          已提交，运营会尽快处理。
        </p>
      )}
      {error && <p className="mt-2 text-center text-xs text-rose-600">{error}</p>}
    </div>
  );
}
