"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { yuan } from "@/lib/plans";

export interface PlanItem {
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

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm";
const labelCls = "text-xs font-medium text-zinc-500";

function readImage(file: File | undefined, apply: (dataUrl: string) => void, onError: (msg: string) => void) {
  if (!file) return;
  if (file.size > 300 * 1024) {
    onError("图片请小于 300KB");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => apply(String(reader.result ?? ""));
  reader.readAsDataURL(file);
}

// 前台预览：按订阅页商品卡的样式实时渲染当前编辑内容
function PreviewCard({ d }: { d: PlanItem }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-dashed border-zinc-200 px-3 py-1.5 text-[11px] text-zinc-400">
        前台预览 · 订阅页效果（实时）
      </div>
      <div className="p-4">
        <div className="relative flex flex-col rounded-2xl border border-zinc-200 p-4">
          {d.badge && (
            <span className="absolute right-3 top-3 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              {d.badge}
            </span>
          )}
          {d.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.imageUrl}
              alt=""
              className="mb-3 h-28 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="mb-3 grid h-28 w-full place-items-center rounded-xl bg-gradient-to-br from-indigo-100 to-sky-100 text-2xl font-bold text-indigo-400">
              {d.name ? d.name.slice(0, 1) : "AI"}
            </div>
          )}
          <div className="truncate font-semibold">{d.name || "商品名称"}</div>
          <div className="mt-1 text-2xl font-bold">¥{yuan(d.priceCents)}</div>
          <p className="mt-1 truncate text-xs text-zinc-500">{d.tagline || "一句话介绍"}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
            {(d.features.length ? d.features.slice(0, 4) : ["卖点一", "卖点二"]).map((f, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-emerald-500">✓</span>
                <span className="truncate">{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-indigo-600/80 py-2 text-center text-xs font-medium text-white">
            立即订阅
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSettings({
  settings,
  plans,
}: {
  settings: Record<string, string>;
  plans: PlanItem[];
}) {
  const router = useRouter();

  // ---- 品牌 ----
  const [brand, setBrand] = useState({
    site_name: settings.site_name ?? "AISub",
    logo_url: settings.logo_url ?? "",
    topup_amounts: settings.topup_amounts ?? "50,100,500",
  });
  const [brandMsg, setBrandMsg] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);

  async function saveBrand() {
    setSavingBrand(true);
    setBrandMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setBrandMsg(res.ok && data.ok ? "已保存，刷新前台生效" : `失败：${data.error ?? res.status}`);
      if (res.ok) router.refresh();
    } catch {
      setBrandMsg("网络错误");
    } finally {
      setSavingBrand(false);
    }
  }

  function onLogoFile(file: File | undefined) {
    readImage(file, (dataUrl) => setBrand((b) => ({ ...b, logo_url: dataUrl })), setBrandMsg);
  }

  // ---- 商品 ----
  const [drafts, setDrafts] = useState<Record<string, PlanItem>>(() =>
    Object.fromEntries(plans.map((p) => [p.id, { ...p }]))
  );
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");

  function patchDraft(id: string, patch: Partial<PlanItem>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function planBody(d: PlanItem) {
    return {
      name: d.name,
      price: d.priceCents / 100,
      tagline: d.tagline,
      features: d.features,
      badge: d.badge,
      fulfillUrl: d.fulfillUrl,
      imageUrl: d.imageUrl,
      enabled: d.enabled,
      sortOrder: d.sortOrder,
    };
  }

  async function savePlan(id: string) {
    setBusy(id);
    setRowMsg((m) => ({ ...m, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planBody(drafts[id])),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setRowMsg((m) => ({ ...m, [id]: res.ok && data.ok ? "已保存" : `失败：${data.error ?? res.status}` }));
      if (res.ok) router.refresh();
    } catch {
      setRowMsg((m) => ({ ...m, [id]: "网络错误" }));
    } finally {
      setBusy("");
    }
  }

  async function removePlan(id: string) {
    if (!window.confirm("确认删除该商品？历史订单不受影响。")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/plans/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        setRowMsg((m) => ({ ...m, [id]: `删除失败（${res.status}）` }));
      }
    } finally {
      setBusy("");
    }
  }

  // ---- 新增商品 ----
  const emptyPlan = (): PlanItem => ({
    id: "__new__",
    key: "",
    name: "",
    priceCents: 9900,
    tagline: "",
    features: [],
    badge: "",
    fulfillUrl: "",
    imageUrl: "",
    sortOrder: 99,
    enabled: true,
  });
  const [adding, setAdding] = useState<PlanItem | null>(null);
  const [addMsg, setAddMsg] = useState("");

  async function addPlan() {
    if (!adding) return;
    setBusy("__new__");
    setAddMsg("");
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planBody(adding)),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setAdding(null);
        router.refresh();
      } else {
        setAddMsg(`失败：${data.error ?? res.status}`);
      }
    } catch {
      setAddMsg("网络错误");
    } finally {
      setBusy("");
    }
  }

  function planFields(d: PlanItem, set: (patch: Partial<PlanItem>) => void, onError: (msg: string) => void) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className={labelCls}>商品名称（≤40字）</div>
          <input className={inputCls} value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <div className={labelCls}>价格（元）</div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className={inputCls}
            value={(d.priceCents / 100).toString()}
            onChange={(e) =>
              set({ priceCents: Math.round(parseFloat(e.target.value || "0") * 100) })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <div className={labelCls}>一句话介绍（≤80字）</div>
          <input className={inputCls} value={d.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </div>
        <div>
          <div className={labelCls}>卖点（每行一条，最多 8 条）</div>
          <textarea
            rows={3}
            className={inputCls}
            value={d.features.join("\n")}
            onChange={(e) => set({ features: e.target.value.split("\n") })}
          />
        </div>
        <div className="space-y-3">
          <div>
            <div className={labelCls}>角标（如「省 ¥48」，可空）</div>
            <input className={inputCls} value={d.badge} onChange={(e) => set({ badge: e.target.value })} />
          </div>
          <div>
            <div className={labelCls}>充值页链接（履约时「进入充值页」按钮跳这里）</div>
            <input
              className={inputCls}
              placeholder="https://..."
              value={d.fulfillUrl}
              onChange={(e) => set({ fulfillUrl: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
            上架（前台可见可购买）
          </label>
        </div>
        <div className="sm:col-span-2">
          <div className={labelCls}>商品图片：图片地址或本地上传（≤300KB，留空显示默认占位）</div>
          <div className="flex items-center gap-3">
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover" />
            ) : (
              <span className="grid h-10 w-16 place-items-center rounded-lg bg-zinc-100 text-xs text-zinc-400">
                无图
              </span>
            )}
            <input
              className={inputCls}
              placeholder="https://... 或留空"
              value={d.imageUrl.startsWith("data:") ? "（已上传本地图片）" : d.imageUrl}
              readOnly={d.imageUrl.startsWith("data:")}
              onChange={(e) => set({ imageUrl: e.target.value })}
            />
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => readImage(e.target.files?.[0], (dataUrl) => set({ imageUrl: dataUrl }), onError)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 品牌设置 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold">品牌</h2>
        <p className="mt-1 text-xs text-zinc-400">站名与 Logo 显示在导航栏、页面标题；改完保存后刷新前台生效。</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className={labelCls}>网站名称（≤40字）</div>
            <input
              className={inputCls}
              value={brand.site_name}
              onChange={(e) => setBrand({ ...brand, site_name: e.target.value })}
            />
          </div>
          <div>
            <div className={labelCls}>充值金额（逗号分隔的元，如 50,100,500）</div>
            <input
              className={inputCls}
              value={brand.topup_amounts}
              onChange={(e) => setBrand({ ...brand, topup_amounts: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <div className={labelCls}>Logo 图片：填图片地址，或本地上传（≤300KB）</div>
            <div className="flex items-center gap-3">
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="logo 预览" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-sm text-white">AI</span>
              )}
              <input
                className={inputCls}
                placeholder="https://... 或留空用默认"
                value={brand.logo_url.startsWith("data:") ? "（已上传本地图片）" : brand.logo_url}
                readOnly={brand.logo_url.startsWith("data:")}
                onChange={(e) => setBrand({ ...brand, logo_url: e.target.value })}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onLogoFile(e.target.files?.[0])}
                className="text-xs"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveBrand}
            disabled={savingBrand}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {savingBrand ? "保存中…" : "保存品牌设置"}
          </button>
          {brandMsg && <span className="text-xs text-zinc-500">{brandMsg}</span>}
        </div>
      </section>

      {/* 商品管理 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">商品管理（{plans.length} 个）</h2>
          <button
            onClick={() => setAdding(adding ? null : emptyPlan())}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {adding ? "收起" : "＋ 添加商品"}
          </button>
        </div>

        {adding && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
            <h3 className="mb-3 text-sm font-medium">新商品</h3>
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              {planFields(adding, (patch) => setAdding({ ...adding, ...patch }), setAddMsg)}
              <PreviewCard d={adding} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={addPlan}
                disabled={busy === "__new__"}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy === "__new__" ? "创建中…" : "创建商品"}
              </button>
              {addMsg && <span className="text-xs text-rose-600">{addMsg}</span>}
            </div>
          </div>
        )}

        {plans.map((p) => {
          const d = drafts[p.id] ?? p;
          const set = (patch: Partial<PlanItem>) => patchDraft(p.id, patch);
          return (
            <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono">{p.key}</span>
                {!d.enabled && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">已下架</span>
                )}
                {d.enabled && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">在售</span>
                )}
                <span>前台展示价 ¥{yuan(d.priceCents)}</span>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                {planFields(d, set, (msg) => setRowMsg((m) => ({ ...m, [p.id]: msg })))}
                <PreviewCard d={d} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => savePlan(p.id)}
                  disabled={busy === p.id}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {busy === p.id ? "保存中…" : "保存"}
                </button>
                <button
                  onClick={() => removePlan(p.id)}
                  disabled={busy === p.id}
                  className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  删除
                </button>
                {rowMsg[p.id] && <span className="text-xs text-zinc-500">{rowMsg[p.id]}</span>}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
