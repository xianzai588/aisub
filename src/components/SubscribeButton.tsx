"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscribeButton({
  planKey,
  label = "立即订阅",
  className = "",
}: {
  planKey: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (res.ok && data.id) {
        router.push(`/orders/${data.id}`);
      } else {
        setError(data.error ?? "创建订单失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={create}
        disabled={loading}
        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "创建中…" : label}
      </button>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
