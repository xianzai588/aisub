import { OPENAI_CLIENT_ID, demoLoginEnabled } from "@/lib/env";

// 登录入口：官方 SIWC（已配置 client id 时）+ 本地演示登录
export default function LoginOptions({ ref }: { ref?: string }) {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const hasOfficial = !!OPENAI_CLIENT_ID;

  if (!hasOfficial && !demoLoginEnabled) {
    return (
      <p className="text-sm text-rose-600">
        未配置 OPENAI_CLIENT_ID，且演示登录已关闭：请在 .env.local 填入 client id，
        或设置 AUTH_DEMO_LOGIN=1。
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {hasOfficial && (
        <a
          href={`/api/auth/signin${qs}`}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm-1-13h2v6.4l4.2 2.5-1 1.7L11 14.5Z" />
          </svg>
          Continue with ChatGPT
        </a>
      )}
      {demoLoginEnabled && (
        <a
          href={`/api/auth/demo${qs}`}
          className={
            hasOfficial
              ? "inline-flex items-center rounded-xl border border-zinc-300 bg-white px-5 py-3 font-medium text-zinc-700 hover:bg-zinc-50"
              : "inline-flex items-center rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-500"
          }
        >
          演示登录（本地测试）
        </a>
      )}
    </div>
  );
}
