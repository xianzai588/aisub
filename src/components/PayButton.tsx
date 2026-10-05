"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setError(data.error ?? "支付失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={pay}
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? "支付中…" : "模拟支付（测试通道）"}
      </button>
      <p className="mt-1.5 text-center text-xs text-zinc-400">
        演示用模拟支付；接入真实支付后替换为收银台跳转 / webhook 回调。
      </p>
      {error && <p className="mt-1 text-center text-xs text-rose-600">{error}</p>}
    </div>
  );
}
