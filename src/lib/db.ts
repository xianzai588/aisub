import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DB_PATH } from "./env";
import { PLAN_SEED } from "./plans";

// Node 22.13+ 内置 SQLite，无需原生依赖；生产可平滑换成 Postgres/MySQL。
mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);

// build/dev 多 worker 并发打开同一个库文件：先设 busy_timeout 让锁竞争排队等待，
// 再做 journal_mode 与 DDL，否则并发执行 PRAGMA/CREATE TABLE 会报 database is locked。
db.exec("PRAGMA busy_timeout = 10000");

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,             -- 'openai' | 'demo'
  sub           TEXT NOT NULL,             -- OIDC subject，账号稳定标识
  email         TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT NOT NULL DEFAULT '',
  balance_cents INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by   TEXT,                      -- 邀请人的 referral_code
  created_at    TEXT NOT NULL,
  UNIQUE(provider, sub)
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  kind             TEXT NOT NULL,          -- subscription | topup | reward
  plan_key         TEXT NOT NULL DEFAULT '',
  title            TEXT NOT NULL,
  amount_cents     INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT NOT NULL DEFAULT '',
  payment_ref      TEXT NOT NULL DEFAULT '',
  note             TEXT NOT NULL DEFAULT '',
  credential_enc   TEXT NOT NULL DEFAULT '',  -- 客户提交的账号凭证（AES-GCM 密文）
  credential_submitted_at TEXT,
  credential_used_at      TEXT,
  credential_cleared_at   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id          TEXT PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  features    TEXT NOT NULL DEFAULT '[]',
  badge       TEXT NOT NULL DEFAULT '',
  fulfill_url TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);
`);

// 轻量迁移：旧库补列（build 时并发 worker 都会执行，列已存在则跳过）
{
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has("credential_enc")) db.exec("ALTER TABLE orders ADD COLUMN credential_enc TEXT NOT NULL DEFAULT ''");
  if (!has("credential_submitted_at")) db.exec("ALTER TABLE orders ADD COLUMN credential_submitted_at TEXT");
  if (!has("credential_used_at")) db.exec("ALTER TABLE orders ADD COLUMN credential_used_at TEXT");
  if (!has("credential_cleared_at")) db.exec("ALTER TABLE orders ADD COLUMN credential_cleared_at TEXT");
}

// plans 表补列（旧库升级：image_url 为商品图片）
{
  const pcols = db.prepare("PRAGMA table_info(plans)").all() as { name: string }[];
  if (!pcols.some((c) => c.name === "image_url")) {
    db.exec("ALTER TABLE plans ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
  }
}

// 商品目录种子：首次启动（plans 空表）写入 GPT/Claude 默认商品，后台「店铺设置」可改
{
  const cnt = (db.prepare("SELECT COUNT(*) AS c FROM plans").get() as { c: number }).c;
  if (cnt === 0) {
    const ins = db.prepare(
      `INSERT OR IGNORE INTO plans (id, key, name, price_cents, tagline, features, badge, fulfill_url, sort_order, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const ts = new Date().toISOString();
    PLAN_SEED.forEach((p, i) =>
      ins.run(p.id, p.key, p.name, p.priceCents, p.tagline, JSON.stringify(p.features), p.badge, p.fulfillUrl, i, 1, ts)
    );
  }
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilling"
  | "completed"
  | "cancelled"
  | "refunded";

export interface User {
  id: string;
  provider: string;
  sub: string;
  email: string;
  name: string;
  avatar_url: string;
  balance_cents: number;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  kind: "subscription" | "topup" | "reward";
  plan_key: string;
  title: string;
  amount_cents: number;
  status: OrderStatus;
  payment_provider: string;
  payment_ref: string;
  note: string;
  credential_enc: string;
  credential_submitted_at: string | null;
  credential_used_at: string | null;
  credential_cleared_at: string | null;
  created_at: string;
  updated_at: string;
}

const now = () => new Date().toISOString();

export function generateReferralCode(): string {
  return randomBytes(5).toString("hex").toUpperCase(); // 10 位，足够演示用
}

export function getUserById(id: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function getUserBySub(provider: string, sub: string): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE provider = ? AND sub = ?")
    .get(provider, sub) as User | undefined;
}

export function getUserByReferralCode(code: string): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE referral_code = ?")
    .get(code) as User | undefined;
}

export function createUser(input: {
  provider: string;
  sub: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  ref?: string;
}): User {
  let referredBy: string | null = null;
  if (input.ref) {
    const referrer = getUserByReferralCode(input.ref.toUpperCase());
    if (referrer && referrer.sub !== input.sub) referredBy = referrer.referral_code;
  }
  const user: User = {
    id: randomUUID(),
    provider: input.provider,
    sub: input.sub,
    email: input.email ?? "",
    name: input.name ?? "",
    avatar_url: input.avatarUrl ?? "",
    balance_cents: 0,
    referral_code: generateReferralCode(),
    referred_by: referredBy,
    created_at: now(),
  };
  db.prepare(
    `INSERT INTO users (id, provider, sub, email, name, avatar_url, balance_cents, referral_code, referred_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id, user.provider, user.sub, user.email, user.name,
    user.avatar_url, user.balance_cents, user.referral_code, user.referred_by, user.created_at
  );
  return user;
}

// 登录即注册：按 (provider, sub) 找人，找不到且 ref 有效则带上邀请关系
export function upsertUserBySub(input: {
  provider: string;
  sub: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  ref?: string;
}): User {
  const existing = getUserBySub(input.provider, input.sub);
  if (existing) {
    // 资料有变化时做一次轻量同步（email/name 可能随时间变化）
    if (
      (input.email && input.email !== existing.email) ||
      (input.name && input.name !== existing.name)
    ) {
      db.prepare("UPDATE users SET email = COALESCE(NULLIF(?, ''), email), name = COALESCE(NULLIF(?, ''), name) WHERE id = ?")
        .run(input.email ?? "", input.name ?? "", existing.id);
      return getUserById(existing.id)!;
    }
    return existing;
  }
  return createUser(input);
}

export function createOrder(input: {
  userId: string;
  kind: Order["kind"];
  planKey?: string;
  title: string;
  amountCents: number;
  status?: OrderStatus;
}): Order {
  const order: Order = {
    id: randomUUID(),
    user_id: input.userId,
    kind: input.kind,
    plan_key: input.planKey ?? "",
    title: input.title,
    amount_cents: input.amountCents,
    status: input.status ?? "pending",
    payment_provider: "",
    payment_ref: "",
    note: "",
    credential_enc: "",
    credential_submitted_at: null,
    credential_used_at: null,
    credential_cleared_at: null,
    created_at: now(),
    updated_at: now(),
  };
  db.prepare(
    `INSERT INTO orders (id, user_id, kind, plan_key, title, amount_cents, status, payment_provider, payment_ref, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?)`
  ).run(
    order.id, order.user_id, order.kind, order.plan_key, order.title,
    order.amount_cents, order.status, order.created_at, order.updated_at
  );
  return order;
}

export function getOrder(id: string): Order | undefined {
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
}

export function listUserOrders(userId: string): Order[] {
  return db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as unknown as Order[];
}

export function listAllOrders(): Order[] {
  return db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200")
    .all() as unknown as Order[];
}

export function countCompletedSubscriptions(userId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE user_id = ? AND kind = 'subscription' AND status = 'completed'")
    .get(userId) as { c: number };
  return row.c;
}

export function addBalance(userId: string, deltaCents: number): void {
  db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").run(
    deltaCents,
    userId
  );
}

// 订单状态机：合法流转才允许更新
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["fulfilling", "refunded", "cancelled"],
  fulfilling: ["completed", "refunded"],
  completed: [],
  cancelled: [],
  refunded: [],
};

export function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  extra?: { paymentProvider?: string; paymentRef?: string; note?: string }
): { ok: boolean; error?: string } {
  const order = getOrder(orderId);
  if (!order) return { ok: false, error: "order_not_found" };
  if (order.status === next) return { ok: true };
  if (!STATUS_TRANSITIONS[order.status]?.includes(next)) {
    return { ok: false, error: `illegal_transition_${order.status}_to_${next}` };
  }
  db.prepare(
    `UPDATE orders SET status = ?,
       payment_provider = CASE WHEN ? != '' THEN ? ELSE payment_provider END,
       payment_ref      = CASE WHEN ? != '' THEN ? ELSE payment_ref END,
       note             = CASE WHEN ? != '' THEN ? ELSE note END,
       updated_at = ?
     WHERE id = ?`
  ).run(
    next,
    extra?.paymentProvider ?? "", extra?.paymentProvider ?? "",
    extra?.paymentRef ?? "", extra?.paymentRef ?? "",
    extra?.note ?? "", extra?.note ?? "",
    now(), orderId
  );

  // 订单完成即销毁客户凭证（最小保留原则）
  if (next === "completed") {
    db.prepare(
      "UPDATE orders SET credential_enc = '', credential_cleared_at = ? WHERE id = ? AND credential_enc != ''"
    ).run(now(), orderId);
  }

  // 凭证生命周期：进入任何终态（完成/取消/退款）都立即销毁，最小保留
  if (next === "completed" || next === "cancelled" || next === "refunded") {
    db.prepare(
      "UPDATE orders SET credential_enc = '', credential_cleared_at = ? WHERE id = ? AND credential_enc != ''"
    ).run(now(), orderId);
  }

  // 充值单完成 → 真实入账余额
  if (next === "completed" && order.kind === "topup") {
    addBalance(order.user_id, order.amount_cents);
  }

  // 首个完成的订阅单 → 给邀请人发一次性奖励（直接以 reward 订单入余额）
  if (next === "completed" && order.kind === "subscription") {
    const buyer = getUserById(order.user_id);
    if (buyer?.referred_by && countCompletedSubscriptions(buyer.id) === 1) {
      const referrer = getUserByReferralCode(buyer.referred_by);
      if (referrer && referrer.id !== buyer.id) {
        createOrder({
          userId: referrer.id,
          kind: "reward",
          title: `邀请奖励 · ${buyer.email || buyer.name || "新用户"} 首单完成`,
          amountCents: 1000,
          status: "completed",
        });
        addBalance(referrer.id, 1000);
      }
    }
  }
  return { ok: true };
}

// ---------- 订单凭证（客户提交的 ChatGPT session/Cookie，密文落库） ----------

export function setOrderCredential(orderId: string, enc: string): void {
  db.prepare(
    "UPDATE orders SET credential_enc = ?, credential_submitted_at = ?, credential_cleared_at = NULL WHERE id = ?"
  ).run(enc, now(), orderId);
}

export function markCredentialUsed(orderId: string): void {
  db.prepare("UPDATE orders SET credential_used_at = ? WHERE id = ?").run(now(), orderId);
}

export function clearOrderCredential(orderId: string): void {
  db.prepare(
    "UPDATE orders SET credential_enc = '', credential_cleared_at = ? WHERE id = ?"
  ).run(now(), orderId);
}

export function countUsersReferredBy(code: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE referred_by = ?")
    .get(code) as { c: number };
  return row.c;
}

export function sumRewardCents(userId: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM orders WHERE user_id = ? AND kind = 'reward' AND status = 'completed'")
    .get(userId) as { s: number };
  return row.s;
}

export function countUsers(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  return row.c;
}

export interface OrderDetailed extends Order {
  email: string;
  name: string;
  has_credential: number; // SQL 计算列：credential_enc != ''
}

// 管理后台用：订单 + 下单人信息 + 是否已提交凭证
export function listAllOrdersDetailed(): OrderDetailed[] {
  return db
    .prepare(
      `SELECT o.*, (o.credential_enc != '') AS has_credential, u.email AS email, u.name AS name
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 200`
    )
    .all() as unknown as OrderDetailed[];
}
