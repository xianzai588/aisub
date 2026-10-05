"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { yuan } from "@/lib/plans";

export default function TopupButtons({ amounts }: { amounts: number[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function topup(amountCents: number) {
    setLoading(amountCents);
    setError("");
    try {
      const res = await fetch("/api/balance/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (res.ok && data.id) {
        router.push(`/orders/${data.id}`);
      } else {
        setError(data.error ?? "创建充值单失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {amounts.map((cents) => (
          <button
            key={cents}
            onClick={() => topup(cents)}
            disabled={loading !== null}
            className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 font-medium hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50"
          >
            {loading === cents ? "创建中…" : `充 ¥${yuan(cents)}`}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
