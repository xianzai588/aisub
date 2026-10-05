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

// 演示登录：未配置 OPENAI_CLIENT_ID 时自动开启，便于先跑通全站流程
export const demoLoginEnabled =
  !OPENAI_CLIENT_ID || process.env.AUTH_DEMO_LOGIN === "1";
