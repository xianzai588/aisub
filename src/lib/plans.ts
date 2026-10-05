// 客户端安全的共享常量与小工具（不碰数据库；服务端套餐目录见 src/lib/store.ts）。

// 商品种子数据：首次启动且 plans 表为空时由 db.ts 写入。
// 管理员可在后台「店铺设置」里改名、改价、增删其它 AI 商品。
export interface PlanSeed {
  id: string;
  key: string;
  name: string;
  priceCents: number;
  tagline: string;
  features: string[];
  badge: string;
  fulfillUrl: string;
}

export const PLAN_SEED: PlanSeed[] = [
  {
    id: "seed-plus-monthly",
    key: "plus-monthly",
    name: "ChatGPT Plus · 单月",
    priceCents: 19900,
    tagline: "官方 $20/月，开通到你自己的账号",
    features: ["GPT 旗舰模型", "更高对话上限", "开通到本人账号，非共享车"],
    badge: "",
    fulfillUrl: "https://chatgpt.com/#pricing",
  },
  {
    id: "seed-plus-quarterly",
    key: "plus-quarterly",
    name: "ChatGPT Plus · 季付",
    priceCents: 54900,
    tagline: "一次付三月，价格更优",
    features: ["含 3 个月 Plus", "季度续费提醒", "开通到本人账号"],
    badge: "省 ¥48",
    fulfillUrl: "https://chatgpt.com/#pricing",
  },
  {
    id: "seed-pro-monthly",
    key: "pro-monthly",
    name: "ChatGPT Pro · 单月",
    priceCents: 149900,
    tagline: "更高用量上限的重度套餐",
    features: ["Pro 级模型与用量", "优先体验新功能", "开通到本人账号"],
    badge: "",
    fulfillUrl: "https://chatgpt.com/#pricing",
  },
  {
    id: "seed-claude-monthly",
    key: "claude-pro-monthly",
    name: "Claude Pro · 单月",
    priceCents: 16800,
    tagline: "Anthropic Claude Pro 代订阅",
    features: ["Claude 旗舰模型", "Projects 等功能", "开通到本人账号"],
    badge: "",
    fulfillUrl: "https://claude.ai/upgrade",
  },
];

export const DEFAULT_TOPUP_AMOUNTS = [5000, 10000, 50000]; // 分

// 订单状态展示
export const STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "已支付 · 待处理",
  fulfilling: "处理中",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
};

export const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  fulfilling: "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-100 text-zinc-600",
  refunded: "bg-rose-100 text-rose-700",
};

export function yuan(cents: number): string {
  return (cents / 100).toFixed(2);
}
