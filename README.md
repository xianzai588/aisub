# AISub · AI 订阅自助平台（脚手架）

参考 WildAI（bewild.ai）的订阅站形态、但改用 **官方 Sign in with ChatGPT（OAuth 2.0 + PKCE）** 做登录的 Next.js 演示项目。
用户在 auth.openai.com 亲自登录授权，平台只拿到**经过验签的身份信息**（sub / email / name / 头像），全程不收集账号密码，也不需要用户粘贴 `/api/auth/session` 的 JSON（那段 JSON 里的 accessToken 等于整个账号的网页端操作权限，让用户交出它对双方都是风险）。

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 登录 | Sign in with ChatGPT（Authorization Code + PKCE，`openid profile email`）；未配置 client id 时可用「演示登录」跑通全站 |
| 订阅下单 | 套餐目录（`src/lib/plans.ts` 占位数据）→ 创建订单 → 支付 |
| 支付 | 内置**模拟支付**（直接把订单标记为已支付）；**生产 fail-closed**：仅当显式设置 `PAYMENT_PROVIDER=mock` 才启用，否则 403 拒绝——防止忘接真实支付时用户免费下单。接真实支付时替换 `src/app/api/orders/[id]/pay/route.ts` 为收银台跳转 + webhook 验签 |
| 履约流水线 | 订单状态机 `pending → paid → fulfilling → completed`（含 cancelled / refunded），运营在 `/admin` 用口令登录后推进 |
| 余额 | 充值订单、余额展示、订单抵扣位（预留） |
| 邀请 | 每用户专属邀请码/链接；被邀请人首单完成 → 邀请人自动入账 ¥10 奖励（reward 订单） |
| AI 能力位 | `/api/ai/run` 预留：要「用用户自己的 ChatGPT plan 跑推理」需另行申请 token-sharing 授权，见下文 |

## 快速开始

```bash
npm install
npm run build
npm run start        # http://localhost:3000
```

开发模式 `npm run dev`。

默认 `.env.local`（不含 OPENAI_CLIENT_ID）会自动开启**演示登录**：
首页 →「演示登录」→ 选套餐 → 模拟支付 → 用口令 `admin123`（`ADMIN_PASSWORD`）进 `/admin` 推进订单状态，即可体验完整闭环。

## 接入官方 Sign in with ChatGPT

1. 到 <https://developers.openai.com/siwc/request-client-id> 申请 client id（形如 `oaiapp_...`；网站身份登录目前为 limited trial，以官方页面为准）。
2. 注册的回调 URL 必须与实际**完全一致**：`{APP_URL}/api/auth/callback`。
3. 填 `.env.local`：

   ```
   OPENAI_CLIENT_ID=oaiapp_xxx
   OPENAI_CLIENT_SECRET=...        # confidential client 才需要；secret 只走 HTTP Basic
   ```

4. 重启后首页出现 **Continue with ChatGPT** 按钮。

端点与校验规则（authorize/token/JWKS、nonce、state、clockTolerance 5s 等）来自官方文档
<https://developers.openai.com/siwc/website>，实现见 `src/lib/oidc.ts`。身份登录的 token 响应**只保证有 `id_token`**（没有 refresh token），本项目的会话是自签的第一方 Cookie（HS256 JWT，8 小时），与 OpenAI token 生命周期解耦。

## 架构

```text
浏览器
  │ ① GET /api/auth/signin          生成 state/PKCE/nonce（服务端事务，10 分钟）
  │ ② 302 → auth.openai.com/authorize  用户登录并授权
  │ ③ GET /api/auth/callback        code + state 回调
  │      ├─ token 端点换 id_token（public: 纯 PKCE / confidential: HTTP Basic）
  │      ├─ jose 验签（JWKS + iss/aud/exp + nonce）
  │      └─ 按 (provider, sub) upsert 用户 → 签发本站会话 Cookie
  ▼
Next.js App Router（server components + route handlers）
  ├─ SQLite（node:sqlite 内置模块，零原生依赖）：users / orders
  ├─ 订单状态机 + 邀请奖励逻辑：src/lib/db.ts
  └─ 管理后台：口令 Cookie，履约操作台 /admin
```

目录：

```text
src/lib/       env / db(SQLite+状态机) / plans(套餐占位) / session / oidc
src/app/       首页、subscribe、orders、balance、invite、admin
src/app/api/   auth(signin|callback|signout|demo)、orders、balance、admin、ai/run
```

## 履约怎么落地（重要）

OAuth 身份登录**不可能**替用户改订阅——这正是它安全的原因。因此「开通/续费」这一步在站外由运营人工完成，平台负责的是：

1. 收单与对账（订单、金额、支付凭证）；
2. 状态推进（`/admin`）与用户可见的进度；
3. 留痕（payment_ref、note）。

**凭证链路（人工履约）**：客户支付后，在订单页提交 ChatGPT 凭证（`chatgpt.com/api/auth/session` 的完整 JSON，或 `__Secure-next-auth.session-token` Cookie）→ AES-256-GCM 加密落库（密钥 `CREDENTIAL_SECRET`，解密只发生在服务端）→ 后台「凭证」面板按需解密（邮箱/套餐/过期时间/accessToken 概要 + 完整原文复制）→「验证凭证」调 OpenAI accounts/check 核对真伪与当前套餐（Cookie 会先换 session；401/403/429 给出可读提示）→ 运营在浏览器导入 Cookie 或用 token 核对后人工完成开通 →「标记已使用」→ 订单进入完成/取消/退款终态时**凭证自动删除**（`credential_cleared_at` 由状态机触发）。付款环节（卡 + 3DS）无法也不应自动化。

如果想把「用用户的 ChatGPT plan 跑 AI 请求」做成产品能力（Codex 类应用的模式），走官方
[token-sharing / 开源应用授权](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
流程，拿到带 plan scope 的 access token 后在 `src/app/api/ai/run/route.ts` 里调用 Responses API 即可。

## 接真实支付

`POST /api/orders/[id]/pay` 目前是模拟通道。接 Stripe / 易支付等任一渠道：

1. 下单后跳转渠道收银台（带订单号）；
2. 渠道回调（webhook）里**验签**后调用 `updateOrderStatus(id, "paid", { paymentProvider, paymentRef })`；
3. 对账脚本用 `payment_ref` 关联渠道流水。

## 安全与合规注意

- **fail-closed 三件套**：生产环境（`NODE_ENV=production`）默认拒绝——未显式 `PAYMENT_PROVIDER=mock` 时的模拟支付（403）、未显式 `AUTH_DEMO_LOGIN=1` 时的演示登录、默认 `ADMIN_PASSWORD` 的后台登录、默认 `SESSION_SECRET` 的会话签发。
- 后台登录带单 IP 失败限速（5 次 / 锁 15 分钟）；生产建议再加 MFA 与操作审计。

- 生产必须换 `SESSION_SECRET` 与 `ADMIN_PASSWORD`，并全程 HTTPS（Cookie 已按 production 加 `Secure`）。
- OAuth 事务（verifier/nonce）当前存进程内存，生产放 Redis/DB 并绑定浏览器会话。
- 平台不保存任何 OpenAI 凭证；`id_token` 验签后只保留 claims。
- 代订阅业务本身违反 OpenAI/Anthropic 服务条款，存在封号与支付拒付风险，用户账号承担主要后果；请自行评估合规性并明示用户。
- 官方 devkit（`openai/sign-in-with-chatgpt-devkit`）为 **Noncommercial** 许可，商用站点不要直接复用其代码；本项目按官方 OIDC 文档独立实现（`src/lib/oidc.ts`）。
- 本项目以 **AGPL-3.0** 开源：他人（含你的竞争者）用这份代码开站或二次开发后对外提供服务，必须同样开源其修改；你作为版权人不受限，可自行商用或另行授权。
- 演示价格/品牌均为占位，上线前替换 `src/lib/plans.ts` 并接入真实客服与退款流程。

## 参考

- Sign in with ChatGPT（网站）：https://developers.openai.com/siwc/website
- Quickstart：https://developers.openai.com/siwc/quickstart
- 官方 DevKit（本地应用，非商用许可）：https://github.com/openai/sign-in-with-chatgpt-devkit
- 社区实现（非官方，Apache-2.0）：https://github.com/EvanZhouDev/openai-oauth
