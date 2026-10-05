"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板权限被拒时静默失败，用户可手动选择文本复制
    }
  }

  return (
    <button
      onClick={copy}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
    >
      {copied ? "已复制 ✓" : label}
    </button>
  );
}
