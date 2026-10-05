// 集中读取环境变量，全部带开发默认值；生产请在 .env / 部署平台覆盖。
// 各变量含义见 .env.example 与 README。

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export const OPENAI_CLIENT_ID = process.env.OPENAI_CLIENT_ID || "";
export const OPENAI_CLIENT_SECRET = process.env.OPENAI_CLIENT_SECRET || "";
export const OPENAI_REDIRECT_URI =
  process.env.OPENAI_REDIRECT_URI || `${APP_URL}/api/auth/callback`;

// 生产务必设置 32 字节以上随机值：openssl rand -base64 32
export const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-only-insecure-session-secret-change-me";

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
export const DB_PATH = process.env.DB_PATH || "./data/app.db";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

// 支付渠道标识：**未设置 = 未接入支付**（生产环境支付接口将 fail-closed 403）。
// 仅当显式设置 PAYMENT_PROVIDER=mock 时，生产环境才放行模拟支付（本地演示用）。
// 注意不要写成 `|| "mock"` 兜底——那会让"漏配"和"显式 mock"无法区分。
export const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || "";

// 演示登录：生产环境必须显式 AUTH_DEMO_LOGIN=1 才开启（避免忘配 client id 时全站共用演示账号）；
// 开发环境未配 client id 时自动开启，便于先跑通全站流程。
export const demoLoginEnabled =
  process.env.AUTH_DEMO_LOGIN === "1" || (!OPENAI_CLIENT_ID && !IS_PRODUCTION);
