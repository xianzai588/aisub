import { randomUUID } from "node:crypto";
import { db } from "./db";
import { DEFAULT_TOPUP_AMOUNTS } from "./plans";

// 服务端商品目录 + 店铺设置（数据库版）。客户端组件只准 import plans.ts 的纯工具。

export interface PlanRow {
  id: string;
  key: string;
  name: string;
  priceCents: number;
  tagline: string;
  features: string[];
  badge: string;
  fulfillUrl: string;
  imageUrl: string;
  sortOrder: number;
  enabled: boolean;
}

interface PlanDbRow {
  id: string;
  key: string;
  name: string;
  price_cents: number;
  tagline: string;
  features: string;
  badge: string;
  fulfill_url: string;
  image_url: string;
  sort_order: number;
  enabled: number;
  created_at: string;
}

function toPlan(r: PlanDbRow): PlanRow {
  let features: string[] = [];
  try {
    features = JSON.parse(r.features) as string[];
  } catch {
    features = [];
  }
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    priceCents: r.price_cents,
    tagline: r.tagline,
    features,
    badge: r.badge,
    fulfillUrl: r.fulfill_url,
    imageUrl: r.image_url,
    sortOrder: r.sort_order,
    enabled: !!r.enabled,
  };
}

export function listPlans(includeDisabled = false): PlanRow[] {
  const rows = (
    includeDisabled
      ? db.prepare("SELECT * FROM plans ORDER BY sort_order, created_at").all()
      : db.prepare("SELECT * FROM plans WHERE enabled = 1 ORDER BY sort_order, created_at").all()
  ) as unknown as PlanDbRow[];
  return rows.map(toPlan);
}

export function getPlanByKey(key: string): PlanRow | undefined {
  const r = db.prepare("SELECT * FROM plans WHERE key = ?").get(key) as
    | PlanDbRow
    | undefined;
  return r ? toPlan(r) : undefined;
}

export interface PlanInput {
  id?: string;
  name: string;
  priceCents: number;
  tagline?: string;
  features?: string[];
  badge?: string;
  fulfillUrl?: string;
  imageUrl?: string;
  sortOrder?: number;
  enabled?: boolean;
}

// 新增或更新（有 id 且存在 → 更新；否则新增，key 自动生成）
export function savePlan(input: PlanInput): PlanRow {
  const now = new Date().toISOString();
  if (input.id) {
    const existing = db.prepare("SELECT * FROM plans WHERE id = ?").get(input.id) as
      | PlanDbRow
      | undefined;
    if (existing) {
      db.prepare(
        `UPDATE plans SET name = ?, price_cents = ?, tagline = ?, features = ?, badge = ?, fulfill_url = ?, image_url = ?, sort_order = ?, enabled = ? WHERE id = ?`
      ).run(
        input.name,
        input.priceCents,
        input.tagline ?? "",
        JSON.stringify(input.features ?? []),
        input.badge ?? "",
        input.fulfillUrl ?? "",
        input.imageUrl ?? "",
        input.sortOrder ?? existing.sort_order,
        input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0,
        input.id
      );
      const updated = getPlanByKey(existing.key);
      if (!updated) throw new Error("plan update failed");
      return updated;
    }
  }
  const id = randomUUID();
  const key = `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
  db.prepare(
    `INSERT INTO plans (id, key, name, price_cents, tagline, features, badge, fulfill_url, image_url, sort_order, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    key,
    input.name,
    input.priceCents,
    input.tagline ?? "",
    JSON.stringify(input.features ?? []),
    input.badge ?? "",
    input.fulfillUrl ?? "",
    input.imageUrl ?? "",
    input.sortOrder ?? 99,
    input.enabled === false ? 0 : 1,
    now
  );
  const created = getPlanByKey(key);
  if (!created) throw new Error("plan insert failed");
  return created;
}

export function deletePlan(id: string): void {
  db.prepare("DELETE FROM plans WHERE id = ?").run(id);
}

// 后台表单校验：非法返回 error，合法返回归一化后的输入
export function parsePlanBody(body: {
  name?: unknown;
  price?: unknown; // 元
  tagline?: unknown;
  features?: unknown;
  badge?: unknown;
  fulfillUrl?: unknown;
  imageUrl?: unknown;
  enabled?: unknown;
  sortOrder?: unknown;
}): { ok: true; value: PlanInput } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40) return { ok: false, error: "名称需 1-40 字" };

  const price = typeof body.price === "number" ? body.price : NaN;
  if (!Number.isFinite(price) || price < 0.01 || price > 99999) {
    return { ok: false, error: "价格需在 0.01 - 99999 元之间" };
  }

  const tagline = typeof body.tagline === "string" ? body.tagline.trim().slice(0, 80) : "";

  const features = Array.isArray(body.features)
    ? body.features
        .map((f) => (typeof f === "string" ? f.trim().slice(0, 60) : ""))
        .filter((f) => f.length > 0)
        .slice(0, 8)
    : [];

  const badge = typeof body.badge === "string" ? body.badge.trim().slice(0, 12) : "";

  const fulfillUrl =
    typeof body.fulfillUrl === "string" && /^https?:\/\/\S+$/.test(body.fulfillUrl.trim())
      ? body.fulfillUrl.trim().slice(0, 300)
      : "";

  const imageUrlRaw = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (
    imageUrlRaw &&
    (!(/^(https?:\/\/|data:image\/)/.test(imageUrlRaw)) || imageUrlRaw.length > 400_000)
  ) {
    return { ok: false, error: "商品图片需为 http(s) 地址或 ≤400KB 的图片数据" };
  }
  const imageUrl = imageUrlRaw.slice(0, 400_000);

  const enabled = body.enabled === undefined ? true : !!body.enabled;
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.max(0, Math.min(999, Math.round(body.sortOrder)))
      : undefined;

  return {
    ok: true,
    value: {
      name,
      priceCents: Math.round(price * 100),
      tagline,
      features,
      badge,
      fulfillUrl,
      imageUrl,
      enabled,
      sortOrder,
    },
  };
}

// ---------- 店铺设置 ----------

export function getSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getSetting(key: string, fallback: string): string {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return r?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function topupAmountsFromSetting(): number[] {
  const raw = getSetting("topup_amounts", "50,100,500");
  const arr = raw
    .split(",")
    .map((x) => Math.round(parseFloat(x.trim()) * 100))
    .filter((n) => Number.isFinite(n) && n > 0);
  return arr.length ? arr.slice(0, 10) : DEFAULT_TOPUP_AMOUNTS;
}
