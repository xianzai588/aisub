import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { getSetting } from "@/lib/store";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getSetting("site_name", "AISub")} · AI 订阅自助平台`,
    description: "基于 Sign in with ChatGPT（OAuth 2.0 + PKCE）的订阅下单演示平台",
  };
}

const NAV = [
  { href: "/", label: "首页" },
  { href: "/subscribe", label: "订阅" },
  { href: "/orders", label: "我的订单" },
  { href: "/balance", label: "余额 / 充值" },
  { href: "/invite", label: "我的邀请" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const siteName = getSetting("site_name", "AISub");
  const logoUrl = getSetting("logo_url", "");

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user?.provider === "demo" && (
          <div className="bg-amber-400 text-amber-950 text-center text-sm py-1.5 px-4">
            演示登录模式：仅用于本地跑通流程，未连接真实 OpenAI 账号
          </div>
        )}
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">
                  AI
                </span>
              )}
              <span>{siteName}</span>
            </Link>
            <div className="hidden gap-4 text-sm text-zinc-600 sm:flex">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-zinc-950">
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Link href="/admin" className="text-zinc-400 hover:text-zinc-600">
                管理
              </Link>
              {user ? (
                <>
                  <span className="hidden text-zinc-600 sm:inline">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="inline h-6 w-6 rounded-full align-middle"
                      />
                    ) : null}
                    <span className="ml-1.5">{user.email || user.name || "已登录"}</span>
                  </span>
                  <form action="/api/auth/signout" method="post">
                    <button className="rounded-lg border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50">
                      退出
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/subscribe"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
                >
                  登录 / 注册
                </Link>
              )}
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-5 text-zinc-400">
            本项目为脚手架演示：价格与品牌均为占位，订单履约为人工流程占位。
            登录采用官方 Sign in with ChatGPT（OAuth 2.0 + PKCE），平台不收集账号密码与
            session JSON。请遵守 OpenAI / Anthropic 的服务条款与当地法规。
          </div>
        </footer>
      </body>
    </html>
  );
}
