"use strict";
const VERSION = 2,
  STORAGE_KEY = "xw_dashboard_v2";
const DEFAULT_WEIGHTS = {
  circle: 5,
  moat: 20,
  predict: 10,
  capitalEfficiency: 15,
  allocation: 10,
  reinvest: 10,
  balance: 10,
  valuation: 15,
  policy: 5,
};
const DEFAULT_PENALTIES = { cyclical: 1.25, policyDependency: 1.25 };
const labels = {
  circle: "能力圈",
  moat: "护城河",
  predict: "可预测性",
  capitalEfficiency: "资本效率",
  allocation: "资本配置",
  reinvest: "再投资空间",
  balance: "资产负债表",
  valuation: "估值粗筛",
  policy: "政策相关度",
};
const scoreLabels = {
  ...labels,
  cyclical: "周期性风险",
  policyDependency: "政策依赖风险",
};
const stages = {
  idea: "初筛",
  reading: "读年报",
  valuing: "研究估值",
  tracking: "持续跟踪",
  paused: "暂缓",
};
const statusLabels = {
  strengthened: "🟢 增强",
  unchanged: "⚪ 未改变",
  weakened: "🟡 削弱",
  broken: "🔴 失效",
};
const basisLabels = {
  annual: "全年",
  ytd: "累计",
  quarter: "单季",
  ttm: "TTM",
};
const currencies = ["CNY", "HKD", "USD"];
const $ = (id) => document.getElementById(id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const num = (x) =>
  x === null || x === undefined || String(x).trim() === ""
    ? null
    : Number.isFinite(Number(x))
      ? Number(x)
      : null;
const fmt = (x, d = 1) =>
  num(x) === null
    ? "—"
    : Number(x).toLocaleString("zh-CN", { maximumFractionDigits: d });
const pct = (x) => (num(x) === null ? "—" : fmt(x, 2) + "%");
const peFmt = (x) =>
  num(x) === null ? "—" : x < 0 ? "亏损" : x === 0 ? "不适用" : fmt(x, 1) + "×";
const safeText = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
const clamp = (x, a, b) => Math.max(a, Math.min(b, Number(x)));
const validDate = (d) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  Number.isFinite(Date.parse(d)) &&
  new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
const safeURL = (u) => {
  try {
    const v = new URL(u);
    return ["https:", "http:"].includes(v.protocol) ? v.href : "";
  } catch {
    return "";
  }
};
const sourceLink = (u, label = "查看来源") =>
  safeURL(u)
    ? `<a href="${safeText(safeURL(u))}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : "未附来源";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  Date.now() + "-" + Math.random().toString(36).slice(2);
function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}
function stringField(v, label, max = 20000) {
  assert(
    v === undefined || v === null || typeof v === "string",
    label + " 必须为文字",
  );
  const t = v ?? "";
  assert(t.length <= max, label + " 过长");
  return t;
}
function dateField(v, label) {
  const t = stringField(v, label, 10);
  assert(!t || validDate(t), label + " 日期无效");
  return t;
}
function numericField(v, label, min = -1e12, max = 1e12) {
  if (v === undefined || v === null || v === "") return null;
  assert(
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max,
    label + " 数值无效",
  );
  return v;
}
function urlField(v, label) {
  const t = stringField(v, label, 4000);
  assert(!t || safeURL(t), label + " 仅支持 http / https 链接");
  return t;
}
function normalizeCompany(c) {
  assert(c && typeof c === "object" && !Array.isArray(c), "公司记录无效");
  for (const k of ["ticker", "name", "theme", "role"])
    assert(
      typeof c[k] === "string" && c[k].trim() && c[k].length < 200,
      "公司缺少有效 " + k,
    );
  assert(
    /^[A-Za-z0-9.^_-]{1,32}$/.test(c.ticker) &&
      !["__proto__", "constructor", "prototype"].includes(c.ticker),
    "Ticker 格式无效",
  );
  assert(c.scores && typeof c.scores === "object", "公司缺少 scores");
  const out = {};
  for (const k of ["ticker", "name", "theme", "role", "thesis", "bear"])
    out[k] = stringField(c[k], k);
  for (const k of ["price", "mcap", "pe", "pb", "div"])
    out[k] = numericField(
      c[k],
      k,
      ["price", "mcap", "div"].includes(k) ? 0 : -1e12,
    );
  out.scores = {};
  for (const k of Object.keys(scoreLabels).filter((k) => k !== "valuation")) {
    out.scores[k] = numericField(c.scores[k], "评分 " + k, 1, 5);
    assert(out.scores[k] !== null, "缺少评分 " + k);
  }
  const m = c.meta || {};
  assert(typeof m === "object" && !Array.isArray(m), "数据口径无效");
  out.meta = {
    currency: stringField(m.currency, "市值币种", 10),
    quoteCurrency: stringField(m.quoteCurrency, "报价币种", 10),
    asOf: dateField(m.asOf, "快照"),
    source: urlField(m.source, "数据来源"),
    basis: stringField(m.basis, "数据口径"),
    verification: m.verification === "verified" ? "verified" : "unverified",
    verifiedAt: dateField(m.verifiedAt, "核验"),
    updatedAt: stringField(m.updatedAt, "修改时间", 80),
  };
  assert(
    !out.meta.currency || currencies.includes(out.meta.currency),
    "市值币种无效",
  );
  assert(
    !out.meta.quoteCurrency || currencies.includes(out.meta.quoteCurrency),
    "报价币种无效",
  );
  if (out.meta.verification === "verified")
    assert(
      out.meta.currency &&
        out.meta.quoteCurrency &&
        out.meta.asOf &&
        out.meta.source &&
        out.meta.basis,
      "已核验记录缺少币种、日期、来源或口径",
    );
  return out;
}
function normalizeProfile(p = {}) {
  assert(p && typeof p === "object" && !Array.isArray(p), "研究卡格式无效");
  return {
    watch: p.watch === true,
    stage: Object.hasOwn(stages, p.stage) ? p.stage : "idea",
    failure: stringField(p.failure, "失效条件"),
    evidence: stringField(p.evidence, "研究证据"),
    nextReview: dateField(p.nextReview, "下次复盘"),
  };
}
function validateData(d) {
  assert(d && typeof d === "object" && !Array.isArray(d), "不是有效的看板数据");
  assert(
    d.version === undefined || d.version === 1 || d.version === 2,
    "不支持此数据版本",
  );
  assert(
    Array.isArray(d.companies) &&
      d.companies.length > 0 &&
      d.companies.length <= 1000,
    "companies 需包含 1–1000 家公司",
  );
  const companies = d.companies.map(normalizeCompany),
    tickers = new Set(companies.map((c) => c.ticker));
  assert(tickers.size === companies.length, "存在重复 Ticker");
  const weights = {},
    penalties = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) {
    weights[k] = numericField(
      d.weights?.[k] ?? DEFAULT_WEIGHTS[k],
      "权重",
      0,
      40,
    );
  }
  for (const k of Object.keys(DEFAULT_PENALTIES))
    penalties[k] = numericField(
      d.penalties?.[k] ?? DEFAULT_PENALTIES[k],
      "扣分",
      0,
      3,
    );
  const profiles = {};
  for (const c of companies)
    profiles[c.ticker] = normalizeProfile(d.profiles?.[c.ticker]);
  const valuationAssumptions = {};
  assert(
    !d.valuationAssumptions || typeof d.valuationAssumptions === "object",
    "估值记录格式无效",
  );
  for (const [t, v] of Object.entries(d.valuationAssumptions || {})) {
    assert(tickers.has(t) && v && typeof v === "object", "估值记录公司不存在");
    const out = {};
    for (const k of [
      "ownerEarnings",
      "requiredYield",
      "g1",
      "g2",
      "gt",
      "disc",
      "fxRate",
      "targetMos",
    ])
      out[k] = numericField(v[k], k);
    out.currency = stringField(v.currency || "CNY", "OE 币种", 10);
    assert(currencies.includes(out.currency), "OE 币种无效");
    out.date = dateField(v.date, "假设");
    out.evidence = stringField(v.evidence, "估值依据");
    out.scopeConfirmed = v.scopeConfirmed === true;
    valuationAssumptions[t] = out;
  }
  const reviews = d.reviews ?? [];
  assert(
    Array.isArray(reviews) && reviews.length <= 10000,
    "复盘记录格式无效或数量过多",
  );
  const ids = new Set();
  const cleanReviews = reviews.map((r) => {
    assert(
      r && tickers.has(r.ticker) && Object.hasOwn(statusLabels, r.status),
      "复盘公司或状态无效",
    );
    const date = dateField(r.date, "复盘");
    assert(date, "复盘缺少日期");
    const id = stringField(r.id || uid(), "记录 ID", 100);
    assert(!ids.has(id), "记录 ID 重复");
    ids.add(id);
    const out = {
      id,
      ticker: r.ticker,
      date,
      status: r.status,
      note: stringField(r.note, "复盘正文"),
      source: urlField(r.source, "复盘来源"),
      invalidation: stringField(r.invalidation, "复盘失效条件"),
      createdAt: stringField(r.createdAt, "创建时间", 80),
    };
    if (r.financial) {
      const f = r.financial;
      assert(
        Object.hasOwn(basisLabels, f.basis) && currencies.includes(f.currency),
        "财务期间或币种无效",
      );
      out.financial = {
        period: stringField(f.period, "报表期", 100),
        basis: f.basis,
        currency: f.currency,
      };
      assert(out.financial.period, "财务记录缺少报表期");
      for (const k of ["roic", "roe", "cfo", "capex"])
        out.financial[k] = numericField(f[k], k, k === "capex" ? 0 : -1e12);
    }
    return out;
  });
  return {
    companies,
    weights,
    penalties,
    profiles,
    valuationAssumptions,
    reviews: cleanReviews,
    sort: { key: "score", dir: "desc" },
  };
}
let bootWarning = "",
  storageAvailable = true;
function loadState() {
  const initial = {
    companies: BASE_COMPANIES,
    weights: DEFAULT_WEIGHTS,
    penalties: DEFAULT_PENALTIES,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return validateData(JSON.parse(raw));
    const old = {
      weights: "xw_weights",
      penalties: "xw_penalties",
      valuationAssumptions: "xw_vals",
      reviews: "xw_reviews",
    };
    for (const [k, key] of Object.entries(old)) {
      const v = localStorage.getItem(key);
      if (v) initial[k] = JSON.parse(v);
    }
    if (Object.values(old).some((k) => localStorage.getItem(k)))
      bootWarning = "已读取旧版自定义数据；保存或导出后可保留在新版中。";
    return validateData(initial);
  } catch (e) {
    storageAvailable = false;
    bootWarning =
      "本地记录无法读取或格式损坏，当前展示初始研究池；原存储未自动覆盖。请导出当前工作，并先核对已有备份。";
    return validateData({ companies: BASE_COMPANIES });
  }
}
let state = loadState(),
  drawerTicker = null,
  previousFocus = null,
  drawerDirty = false,
  pendingImport = null;
function payload() {
  return {
    version: VERSION,
    app: "berkshire-fifteen-five",
    exportedAt: new Date().toISOString(),
    companies: state.companies,
    weights: state.weights,
    penalties: state.penalties,
    profiles: state.profiles,
    valuationAssumptions: state.valuationAssumptions,
    reviews: state.reviews,
  };
}
function notify(msg, bad = false) {
  $("saveStatus").textContent = msg;
  $("saveStatus").classList.toggle("danger", bad);
}
function persist(msg = "已保存到当前浏览器") {
  try {
    if (!storageAvailable) throw new Error("存储不可用");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    notify(msg + " · " + new Date().toLocaleTimeString("zh-CN"));
    return true;
  } catch (e) {
    notify(
      "当前修改只保留在本次页面中，浏览器存储不可用或容量不足。请立即导出 JSON 备份。",
      true,
    );
    return false;
  }
}
const companyByTicker = (t) => state.companies.find((c) => c.ticker === t);
const profile = (t) =>
  state.profiles[t] || (state.profiles[t] = normalizeProfile());
const themeList = () => [...new Set(state.companies.map((c) => c.theme))];
const roleList = () => [...new Set(state.companies.map((c) => c.role))];
const latestReview = (t) =>
  state.reviews
    .filter((r) => r.ticker === t)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.createdAt || "").localeCompare(a.createdAt || ""),
    )[0];
function dueInfo(c) {
  const p = profile(c.ticker);
  if (p.nextReview) return { date: p.nextReview, due: p.nextReview <= today() };
  const r = latestReview(c.ticker);
  if (!r) return { date: "尚未复盘", due: true };
  const dt = new Date(r.date + "T12:00:00");
  dt.setDate(dt.getDate() + 90);
  const d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return { date: d, due: d <= today() };
}
const verified = (c) => c.meta.verification === "verified";
function stale(c) {
  return (
    c.meta.asOf &&
    (Date.parse(today()) - Date.parse(c.meta.asOf)) / 86400000 > 30
  );
}
function verificationTag(c) {
  return `<span class="pill ${verified(c) ? "good" : "warn"}">${verified(c) ? "用户已核验" : "待核验"}</span><small class="muted" style="display:block">${safeText(c.meta.asOf || "日期待核验")}${stale(c) ? " · 超过30天" : ""}</small>`;
}
function valuationScore(c) {
  const peS =
    c.pe === null
      ? null
      : c.pe <= 0
        ? 1
        : c.pe <= 8
          ? 5
          : c.pe <= 12
            ? 4.5
            : c.pe <= 18
              ? 4
              : c.pe <= 25
                ? 3.5
                : c.pe <= 35
                  ? 2.8
                  : c.pe <= 50
                    ? 2
                    : 1;
  const pbS =
    c.pb === null
      ? null
      : c.pb <= 0
        ? 1
        : c.pb <= 1
          ? 5
          : c.pb <= 2
            ? 4
            : c.pb <= 3
              ? 3.4
              : c.pb <= 5
                ? 2.6
                : c.pb <= 8
                  ? 1.8
                  : 1;
  const dS =
    c.div === null
      ? null
      : c.div >= 6
        ? 5
        : c.div >= 4
          ? 4
          : c.div >= 2
            ? 3.2
            : c.div >= 1
              ? 2.3
              : 1.3;
  return [peS, pbS, dS].some((x) => x === null)
    ? null
    : +(0.55 * peS + 0.2 * pbS + 0.25 * dS).toFixed(2);
}
function scoreCompany(c) {
  const s = { ...c.scores, valuation: valuationScore(c) };
  const tw = Object.values(state.weights).reduce((a, b) => a + b, 0);
  if (!tw) return null;
  let v = 0;
  for (const [k, w] of Object.entries(state.weights)) {
    if (w && num(s[k]) === null) return null;
    v += ((s[k] || 0) * w) / tw;
  }
  return +clamp(
    v * 20 -
      (s.cyclical - 1) * state.penalties.cyclical -
      (s.policyDependency - 1) * state.penalties.policyDependency,
    0,
    100,
  ).toFixed(1);
}
const grade = (v) =>
  v === null ? "—" : v >= 80 ? "A" : v >= 70 ? "B" : v >= 60 ? "C" : "D";
const scoreMarkup = (c) => {
  const s = scoreCompany(c);
  return `<span class="score ${grade(s).toLowerCase()}">${fmt(s)}${s === null ? "" : " / " + grade(s)}</span>`;
};
function renderKPIs() {
  const watched = state.companies.filter((c) => profile(c.ticker).watch);
  const items = [
    ["研究公司", state.companies.length, "原版研究池持续维护"],
    ["研究主题", themeList().length, "政策线索 ≠ 盈利保证"],
    ["重点关注", watched.length, "由你手动选定"],
    [
      "待核验",
      state.companies.filter((c) => !verified(c)).length,
      "补齐来源与日期",
    ],
    [
      "关注池待复盘",
      watched.filter((c) => dueInfo(c).due).length,
      "未复盘或已到计划日期",
    ],
    [
      "逻辑削弱 / 失效",
      state.companies.filter((c) =>
        ["weakened", "broken"].includes(latestReview(c.ticker)?.status),
      ).length,
      "需重新检查原始判断",
    ],
  ];
  $("kpis").innerHTML = items
    .map(
      ([l, v, s]) =>
        `<div class="card kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`,
    )
    .join("");
}
function renderQueue() {
  const watched = state.companies.filter((c) => profile(c.ticker).watch);
  const groups = [
    [
      "01 · 复盘日程",
      watched.filter((c) => dueInfo(c).due),
      (c) => dueInfo(c).date,
      "先在公司筛选中点 ☆，建立重点关注池。",
    ],
    [
      "02 · 核验证据",
      (watched.length ? watched : state.companies).filter((c) => !verified(c)),
      (c) => "补交易日、来源与币种",
      "当前范围已补齐核验字段。",
    ],
    [
      "03 · 重新检查逻辑",
      state.companies.filter((c) =>
        ["weakened", "broken"].includes(latestReview(c.ticker)?.status),
      ),
      (c) => statusLabels[latestReview(c.ticker).status],
      "尚无削弱 / 失效记录；这不代表风险不存在。",
    ],
  ];
  $("researchQueue").innerHTML = groups
    .map(
      ([title, arr, detail, empty]) =>
        `<div class="card"><b>${title}</b><small>${arr.length} 项${title.includes("核验") ? (watched.length ? " · 重点关注池" : " · 全研究池") : ""}</small>${
          arr.length
            ? arr
                .slice(0, 3)
                .map(
                  (c) =>
                    `<button class="btn" data-company="${safeText(c.ticker)}">${safeText(c.name)}<small>${safeText(detail(c))}</small></button>`,
                )
                .join("") +
              (arr.length > 3
                ? `<small>另有 ${arr.length - 3} 项，可在公司筛选中查看。</small>`
                : "")
            : `<p class="muted-line">${empty}</p>`
        }</div>`,
    )
    .join("");
  bindCompanyLinks($("researchQueue"));
}
function renderThemes() {
  const median = (a) => {
    a = a.sort((x, y) => x - y);
    return a.length
      ? (a[Math.floor((a.length - 1) / 2)] + a[Math.ceil((a.length - 1) / 2)]) /
          2
      : null;
  };
  $("themeGrid").innerHTML = themeList()
    .map((t) => {
      const arr = state.companies.filter((c) => c.theme === t);
      return `<button class="card theme-card" data-theme="${safeText(t)}" style="color:inherit;text-align:left"><h3>${safeText(t)}</h3><div class="metrics"><div class="metric"><b>${arr.length}</b><span>研究公司</span></div><div class="metric"><b>${fmt(median(arr.filter((c) => c.pe > 0).map((c) => c.pe)))}×</b><span>正 PE 中位数（粗筛）</span></div><div class="metric"><b>${arr.filter(verified).length} / ${arr.length}</b><span>数据已核验</span></div><div class="metric"><b>${arr.filter((c) => profile(c.ticker).watch).length}</b><span>重点关注</span></div></div></button>`;
    })
    .join("");
  $("themeGrid")
    .querySelectorAll("[data-theme]")
    .forEach(
      (el) =>
        (el.onclick = () => {
          resetFilters();
          $("themeFilter").value = el.dataset.theme;
          activateTab("explorer");
          renderTable();
        }),
    );
}
function ranked() {
  return [...state.companies].sort(
    (a, b) => (scoreCompany(b) ?? -1) - (scoreCompany(a) ?? -1),
  );
}
function hero(c, i) {
  return `<button class="hero-item" data-company="${safeText(c.ticker)}" style="color:inherit;text-align:left;font:inherit"><div><b>${i ? i + ". " : ""}${safeText(c.name)}</b><small>${safeText(c.ticker)} · ${safeText(c.theme)} · ${verified(c) ? "用户已核验" : "数据待核验"}</small></div>${scoreMarkup(c)}<div class="pe">${peFmt(c.pe)}</div></button>`;
}
function bindCompanyLinks(el) {
  el.querySelectorAll("[data-company]").forEach(
    (b) => (b.onclick = () => openDrawer(b.dataset.company)),
  );
}
function renderTop() {
  $("topList").innerHTML = ranked()
    .slice(0, 10)
    .map((c) => hero(c))
    .join("");
  bindCompanyLinks($("topList"));
}
function populateFilters() {
  for (const [id, values] of [
    ["themeFilter", themeList()],
    ["roleFilter", roleList()],
  ]) {
    const v = $(id).value;
    $(id).innerHTML =
      '<option value="">全部</option>' +
      values.map((x) => `<option>${safeText(x)}</option>`).join("");
    if (values.includes(v)) $(id).value = v;
  }
  for (const id of ["valCompany", "reviewCompany"]) {
    const prev = $(id).value;
    $(id).innerHTML = [...state.companies]
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
      .map(
        (c) =>
          `<option value="${safeText(c.ticker)}">${safeText(c.name)} · ${safeText(c.ticker)}</option>`,
      )
      .join("");
    if (companyByTicker(prev)) $(id).value = prev;
  }
}
function filteredCompanies() {
  const q = $("search").value.trim().toLowerCase(),
    th = $("themeFilter").value,
    role = $("roleFilter").value,
    min = num($("minScore").value) ?? 0,
    max = num($("maxPE").value);
  let arr = state.companies.filter(
    (c) =>
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.ticker.toLowerCase().includes(q)) &&
      (!th || th === c.theme) &&
      (!role || role === c.role) &&
      (!min || (scoreCompany(c) ?? -1) >= min) &&
      (max === null || (c.pe > 0 && c.pe <= max)) &&
      (!$("watchOnly").checked || profile(c.ticker).watch) &&
      (!$("unverifiedOnly").checked || !verified(c)),
  );
  const { key, dir } = state.sort;
  return arr.sort((a, b) => {
    const av = key === "score" ? scoreCompany(a) : a[key],
      bv = key === "score" ? scoreCompany(b) : b[key];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return (
      (typeof av === "string" ? av.localeCompare(bv, "zh-CN") : av - bv) *
      (dir === "asc" ? 1 : -1)
    );
  });
}
function renderTable() {
  const arr = filteredCompanies();
  $("filterCount").textContent =
    `显示 ${arr.length} / ${state.companies.length} 家`;
  document.querySelector("#companyTable tbody").innerHTML = arr.length
    ? arr
        .map(
          (c) =>
            `<tr data-ticker="${safeText(c.ticker)}" tabindex="0" aria-label="查看 ${safeText(c.name)}"><td><button class="watch-star" aria-label="${profile(c.ticker).watch ? "取消" : "加入"}重点关注 ${safeText(c.name)}" aria-pressed="${profile(c.ticker).watch}" data-watch="${safeText(c.ticker)}">${profile(c.ticker).watch ? "★" : "☆"}</button></td><td><b>${safeText(c.name)}</b><small class="muted" style="display:block">${stages[profile(c.ticker).stage]}</small></td><td>${safeText(c.ticker)}</td><td>${safeText(c.theme)}</td><td><span class="tag">${safeText(c.role)}</span></td><td>${scoreMarkup(c)}</td><td>${peFmt(c.pe)}</td><td>${fmt(c.pb, 2)}×</td><td>${pct(c.div)}</td><td>${fmt(c.mcap, 0)}<small class="muted" style="display:block">${safeText(c.meta.currency || "币种待核验")}</small></td><td>${verificationTag(c)}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="11" class="empty-row">没有匹配的公司。请调整筛选条件。</td></tr>';
  document
    .querySelectorAll("#companyTable tbody tr[data-ticker]")
    .forEach((el) => {
      el.onclick = () => openDrawer(el.dataset.ticker);
      el.onkeydown = (e) => {
        if (e.key === "Enter" && e.target === el) openDrawer(el.dataset.ticker);
      };
    });
  document.querySelectorAll("[data-watch]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        toggleWatch(b.dataset.watch);
      }),
  );
  document
    .querySelectorAll("th[data-sort]")
    .forEach((th) =>
      th.setAttribute(
        "aria-sort",
        th.dataset.sort === state.sort.key
          ? state.sort.dir === "asc"
            ? "ascending"
            : "descending"
          : "none",
      ),
    );
}
function resetFilters() {
  for (const id of ["search", "themeFilter", "roleFilter", "maxPE"])
    $(id).value = "";
  $("minScore").value = 0;
  $("watchOnly").checked = false;
  $("unverifiedOnly").checked = false;
  renderTable();
}
function refreshScores() {
  const tw = Object.values(state.weights).reduce((a, b) => a + b, 0);
  $("weightTotal").textContent = tw
    ? `权重合计 ${tw}，计算时归一化`
    : "全部权重为 0，暂停评分";
  $("cycPenaltyLabel").textContent = state.penalties.cyclical.toFixed(2);
  $("policyPenaltyLabel").textContent =
    state.penalties.policyDependency.toFixed(2);
  $("rankPreview").innerHTML = ranked()
    .slice(0, 12)
    .map((c, i) => hero(c, i + 1))
    .join("");
  bindCompanyLinks($("rankPreview"));
  renderKPIs();
  renderQueue();
  renderThemes();
  renderTop();
  renderTable();
}
function renderWeights() {
  $("weights").innerHTML = Object.entries(labels)
    .map(
      ([k, l]) =>
        `<div class="weight-row"><div class="top"><label for="w_${k}">${l}</label><b id="w_${k}_label">${state.weights[k]}</b></div><input id="w_${k}" data-key="${k}" type="range" min="0" max="40" step="1" value="${state.weights[k]}"></div>`,
    )
    .join("");
  $("weights")
    .querySelectorAll("input")
    .forEach((el) => {
      el.oninput = () => {
        state.weights[el.dataset.key] = Number(el.value);
        $("w_" + el.dataset.key + "_label").textContent = el.value;
        refreshScores();
      };
      el.onchange = () => persist("评分权重已保存");
    });
  for (const [id, key] of [
    ["cycPenalty", "cyclical"],
    ["policyPenalty", "policyDependency"],
  ]) {
    $(id).value = state.penalties[key];
    $(id).oninput = () => {
      state.penalties[key] = Number($(id).value);
      refreshScores();
    };
    $(id).onchange = () => persist();
  }
  refreshScores();
}
function toggleWatch(t) {
  profile(t).watch = !profile(t).watch;
  persist(profile(t).watch ? "已加入重点关注" : "已取消重点关注");
  refreshScores();
  if (drawerTicker === t)
    $("toggleWatch").textContent = profile(t).watch
      ? "★ 已重点关注 · 点击取消"
      : "☆ 加入重点关注";
}
function activateTab(id) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === id);
    b.setAttribute("aria-selected", b.dataset.tab === id ? "true" : "false");
  });
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.toggle("active", p.id === id));
}
function openDrawer(t) {
  const c = companyByTicker(t);
  if (!c) return;
  previousFocus = document.activeElement;
  drawerTicker = t;
  drawerDirty = false;
  const p = profile(t);
  $("dName").textContent = c.name;
  $("dSub").textContent = `${t} · ${c.theme} · ${c.role}`;
  $("toggleWatch").textContent = p.watch
    ? "★ 已重点关注 · 点击取消"
    : "☆ 加入重点关注";
  $("dMeta").innerHTML =
    `${verificationTag(c)}<div style="margin-top:8px">${sourceLink(c.meta.source)} · 市值币种：${safeText(c.meta.currency || "待核验")} · 报价币种：${safeText(c.meta.quoteCurrency || "待核验")}</div><div>${safeText(c.meta.basis || "尚未说明 PE / PB / 股息及市值范围。")}</div>`;
  $("dKv").innerHTML = [
    ["股价", fmt(c.price, 3) + " " + (c.meta.quoteCurrency || "?")],
    ["市值", fmt(c.mcap, 0) + " 亿 " + (c.meta.currency || "?")],
    ["PE", peFmt(c.pe)],
    ["PB", fmt(c.pb, 2) + "×"],
    ["股息率", pct(c.div)],
    ["研究评分", fmt(scoreCompany(c))],
  ]
    .map(
      ([l, v]) =>
        `<div class="box"><span>${l}</span><b>${safeText(v)}</b></div>`,
    )
    .join("");
  $("dThesis").textContent = c.thesis;
  $("dBear").textContent = c.bear;
  $("dTotal").innerHTML = scoreMarkup(c);
  const scores = { ...c.scores, valuation: valuationScore(c) };
  $("dScores").innerHTML = Object.entries(scoreLabels)
    .map(
      ([k, l]) =>
        `<div class="score-row"><span>${l}</span><b>${fmt(scores[k])}</b></div>`,
    )
    .join("");
  const fields = {
    editThesis: c.thesis,
    editBear: c.bear,
    editFailure: p.failure,
    editNext: p.nextReview,
    editStage: p.stage,
    editEvidence: p.evidence,
    editPrice: c.price,
    editQuoteCurrency: c.meta.quoteCurrency,
    editMcap: c.mcap,
    editCurrency: c.meta.currency,
    editPE: c.pe,
    editPB: c.pb,
    editDiv: c.div,
    editAsOf: c.meta.asOf,
    editSource: c.meta.source,
    editBasis: c.meta.basis,
    editVerification: c.meta.verification,
  };
  for (const [id, v] of Object.entries(fields)) $(id).value = v ?? "";
  $("scoreEditor").innerHTML = Object.entries(scoreLabels)
    .filter(([k]) => k !== "valuation")
    .map(
      ([k, l]) =>
        `<div class="score-row"><label for="edit_score_${k}">${l}</label><input id="edit_score_${k}" class="input" type="number" min="1" max="5" step="0.1" value="${c.scores[k]}"></div>`,
    )
    .join("");
  $("editError").textContent = "";
  $("drawer").classList.add("open");
  $("backdrop").classList.add("open");
  document.body.style.overflow = "hidden";
  $("closeDrawer").focus();
}
function closeDrawer(force = false) {
  if (drawerDirty && !force && !confirm("研究卡有未保存的修改，确认关闭？"))
    return false;
  $("drawer").classList.remove("open");
  $("backdrop").classList.remove("open");
  document.body.style.overflow = "";
  drawerTicker = null;
  drawerDirty = false;
  if (previousFocus?.isConnected) previousFocus.focus();
  return true;
}
function saveCompany() {
  try {
    const t = drawerTicker,
      c = clone(companyByTicker(t));
    assert(c, "未选择公司");
    c.thesis = $("editThesis").value.trim();
    c.bear = $("editBear").value.trim();
    for (const [id, k] of [
      ["editPrice", "price"],
      ["editMcap", "mcap"],
      ["editPE", "pe"],
      ["editPB", "pb"],
      ["editDiv", "div"],
    ]) {
      assert(!$(id).validity.badInput, "数字输入无效");
      c[k] = num($(id).value);
    }
    c.meta = {
      currency: $("editCurrency").value,
      quoteCurrency: $("editQuoteCurrency").value,
      asOf: $("editAsOf").value,
      source: $("editSource").value.trim(),
      basis: $("editBasis").value.trim(),
      verification: $("editVerification").value,
      verifiedAt: $("editVerification").value === "verified" ? today() : "",
      updatedAt: new Date().toISOString(),
    };
    assert(!c.meta.asOf || c.meta.asOf <= today(), "快照日期不能晚于今天");
    for (const k of Object.keys(c.scores))
      c.scores[k] = num($("edit_score_" + k).value);
    const clean = normalizeCompany(c),
      p = normalizeProfile({
        watch: profile(t).watch,
        stage: $("editStage").value,
        failure: $("editFailure").value.trim(),
        evidence: $("editEvidence").value.trim(),
        nextReview: $("editNext").value,
      });
    state.companies[state.companies.findIndex((x) => x.ticker === t)] = clean;
    state.profiles[t] = p;
    persist("公司研究卡已保存");
    refreshScores();
    updateValuationCompany();
    const focus = previousFocus;
    openDrawer(t);
    previousFocus = focus;
    drawerDirty = false;
  } catch (e) {
    $("editError").textContent = e.message;
  }
}
function dcf(oe, g1, g2, gt, d) {
  let e = oe,
    pv = 0;
  for (let y = 1; y <= 10; y++) {
    e *= 1 + (y <= 5 ? g1 : g2);
    pv += e / (1 + d) ** y;
  }
  const terminalPV = (e * (1 + gt)) / (d - gt) / (1 + d) ** 10;
  return { value: pv + terminalPV, terminalPV };
}
const valFields = [
  "ownerEarnings",
  "requiredYield",
  "g1",
  "g2",
  "gt",
  "disc",
  "fxRate",
  "targetMos",
];
function valuationInputs() {
  const v = {};
  for (const id of valFields) v[id] = num($(id).value);
  return {
    ...v,
    currency: $("oeCurrency").value,
    date: $("valDate").value,
    evidence: $("valEvidence").value.trim(),
    scopeConfirmed: $("scopeConfirmed").checked,
  };
}
function checkValuation(v) {
  if (!(v.ownerEarnings > 0)) return "请先输入大于 0 的标准化 Owner Earnings。";
  if (!(v.requiredYield > 0 && v.requiredYield <= 100))
    return "OE 要求收益率需大于 0 且不超过 100%。";
  if (
    v.g1 === null ||
    v.g2 === null ||
    v.g1 <= -100 ||
    v.g2 <= -100 ||
    v.g1 > 200 ||
    v.g2 > 200
  )
    return "两阶段增速需大于 −100%、不超过 200%，且不能留空。";
  if (v.gt === null || v.gt <= -100 || v.gt > 20)
    return "终值增速需大于 −100%、不超过 20%，且不能留空。";
  if (!(v.disc > 0 && v.disc <= 100 && v.disc > v.gt))
    return "折现率需为正、≤100%，并严格高于终值增速。";
  if (v.targetMos === null || v.targetMos < 0 || v.targetMos > 90)
    return "目标安全边际需在 0–90% 之间。";
  return "";
}
function updateFx() {
  const c = companyByTicker($("valCompany").value);
  if (c?.meta.currency === $("oeCurrency").value) {
    $("fxRate").value = 1;
    $("fxRate").disabled = true;
  } else {
    $("fxRate").disabled = false;
  }
}
function updateValuationCompany() {
  const t = $("valCompany").value,
    c = companyByTicker(t);
  if (!c) return;
  const v = state.valuationAssumptions[t] || {};
  $("currentMcap").value =
    fmt(c.mcap, 2) + " " + (c.meta.currency || "币种待核验");
  const defaults = {
    ownerEarnings: "",
    requiredYield: 8,
    g1: 5,
    g2: 3,
    gt: 2,
    disc: 10,
    fxRate: "",
    targetMos: 30,
  };
  for (const id of valFields) $(id).value = v[id] ?? defaults[id];
  $("oeCurrency").value = v.currency || "CNY";
  $("valDate").value = v.date || today();
  $("valEvidence").value = v.evidence || "";
  $("scopeConfirmed").checked = v.scopeConfirmed === true;
  updateFx();
  $("valDataStatus").innerHTML =
    `${verificationTag(c)} ${sourceLink(c.meta.source)}<br>全部金额单位为“亿”。估值结果采用 <b>OE 币种</b>；比较前将市值除以你填写的汇率换成 OE 币种。初始增速是演示假设，不是公司预测。`;
  calcValuation();
}
function calcValuation() {
  const c = companyByTicker($("valCompany").value);
  if (!c) return null;
  const v = valuationInputs();
  for (const id of ["yieldFair", "dcfFair"]) $(id).textContent = "—";
  for (const id of ["yieldMOS", "dcfMOS", "valDetails", "valError"])
    $(id).textContent = "";
  $("valuationLabel").textContent = "待输入";
  $("sensitivity").innerHTML =
    '<div class="empty">输入有效假设后显示敏感性表。</div>';
  const error = checkValuation(v);
  if (error) {
    $("valError").textContent = error;
    return null;
  }
  const fairY = v.ownerEarnings / (v.requiredYield / 100),
    res = dcf(
      v.ownerEarnings,
      v.g1 / 100,
      v.g2 / 100,
      v.gt / 100,
      v.disc / 100,
    );
  if (!Number.isFinite(res.value) || res.value <= 0) {
    $("valError").textContent = "计算结果无效，请检查假设。";
    return null;
  }
  const low = Math.min(fairY, res.value),
    canCompare =
      verified(c) &&
      c.meta.currency &&
      v.fxRate > 0 &&
      v.scopeConfirmed &&
      c.mcap > 0;
  $("yieldFair").textContent = fmt(fairY, 1) + " 亿 " + v.currency;
  $("dcfFair").textContent = fmt(res.value, 1) + " 亿 " + v.currency;
  let mos = null;
  if (canCompare) {
    const mc = c.mcap / v.fxRate;
    mos = 1 - mc / low;
    $("yieldMOS").textContent = "安全边际 " + pct((1 - mc / fairY) * 100);
    $("dcfMOS").textContent = "安全边际 " + pct((1 - mc / res.value) * 100);
    $("valuationLabel").textContent = pct(mos * 100);
    $("valuationLabel").className =
      mos < 0 ? "danger" : mos >= v.targetMos / 100 ? "good" : "warn";
    $("valDetails").textContent =
      `${mos < 0 ? "市值高于较低模型值。" : mos >= v.targetMos / 100 ? "达到你设定的折价阈值，仍需核对经营风险。" : "尚未达到你设定的折价阈值。"} 按 ${v.targetMos}% 安全边际，对应研究市值阈值 ${fmt(low * (1 - v.targetMos / 100), 1)} 亿 ${v.currency}。`;
  } else {
    $("valuationLabel").textContent = "仅假设估值";
    $("valuationLabel").className = "warn";
    $("yieldMOS").textContent = "暂不与行情比较";
    $("dcfMOS").textContent = "暂不与行情比较";
    $("valDetails").textContent =
      "完成公司数据核验、填写正汇率，并确认股权范围一致后，才显示安全边际。";
  }
  const terminalShare = (res.terminalPV / res.value) * 100;
  $("valDetails").textContent +=
    ` 终值占 DCF ${fmt(terminalShare)}%。若 OE 永久下降 20% 且其余假设不变，DCF 降至 ${fmt(res.value * 0.8, 1)} 亿 ${v.currency}。${terminalShare > 70 ? "终值权重较大，结论对远期假设敏感。" : ""}${stale(c) ? "快照已超过30天，请更新后再作价格比较。" : ""}${v.gt > 4 ? "永续增速高于 4%，请特别检查长期可持续性。" : ""}`;
  const gs = [-1, -0.5, 0, 0.5, 1].map((x) => v.gt + x),
    ds = [-2, -1, 0, 1, 2].map((x) => v.disc + x);
  $("sensitivity").innerHTML =
    `<table><thead><tr><th>折现率 / 永续增速</th>${gs.map((g) => `<th>${fmt(g)}%</th>`).join("")}</tr></thead><tbody>${ds
      .map(
        (d, i) =>
          `<tr><th>${fmt(d)}%</th>${gs
            .map((g, j) => {
              if (d <= 0 || d <= g || g <= -100) return "<td>不适用</td>";
              const r = dcf(
                v.ownerEarnings,
                v.g1 / 100,
                v.g2 / 100,
                g / 100,
                d / 100,
              ).value;
              const cl = canCompare
                ? 1 - c.mcap / v.fxRate / r >= v.targetMos / 100
                  ? "good"
                  : "danger"
                : "";
              return `<td class="${cl} ${i === 2 && j === 2 ? "base" : ""}">${fmt(r, 0)}</td>`;
            })
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table><p class="muted-line" style="padding:0 12px">描边为当前假设。${canCompare ? "绿色表示达到设定安全边际，红色表示尚未达到；并非买卖信号。" : "行情口径尚未确认，不标注折价颜色。"}</p>`;
  return { fairY, dcf: res.value, low, mos, canCompare };
}
function saveValuation() {
  const v = valuationInputs();
  const err = checkValuation(v);
  if (err) {
    $("valError").textContent = err;
    return;
  }
  if (!validDate(v.date) || v.date > today()) {
    $("valError").textContent = "请填写有效且不晚于今天的假设日期。";
    return;
  }
  state.valuationAssumptions[$("valCompany").value] = v;
  persist("该公司估值假设已保存");
  calcValuation();
}
function renderReviews() {
  const t = $("reviewCompany").value,
    arr = state.reviews
      .filter((r) => r.ticker === t)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.createdAt || "").localeCompare(a.createdAt || ""),
      );
  $("reviewList").innerHTML = arr.length
    ? arr
        .map(
          (r) =>
            `<article class="review status-${r.status}"><div class="meta"><span>${safeText(r.date)} · ${statusLabels[r.status]}</span><button class="btn small-btn" data-delete="${safeText(r.id)}">删除</button></div><div class="review-body">${safeText(r.note)}</div>${r.invalidation ? `<p class="muted-line review-body">失效条件 / 下一步：${safeText(r.invalidation)}</p>` : ""}<div class="muted-line">${sourceLink(r.source)}</div></article>`,
        )
        .join("")
    : '<div class="empty">暂无复盘。先写新证据与反方观点。</div>';
  $("reviewList")
    .querySelectorAll("[data-delete]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("删除这条复盘？此操作不改变已设置的下次复盘日期。")) {
            state.reviews = state.reviews.filter(
              (r) => r.id !== b.dataset.delete,
            );
            persist("复盘已删除");
            renderReviews();
            refreshScores();
          }
        }),
    );
  const fs = arr.filter((r) => r.financial);
  $("financialHistory").innerHTML = fs.length
    ? `<table><thead><tr><th>报表期 / 口径</th><th>ROIC</th><th>ROE</th><th>CFO</th><th>Capex</th><th>FCF</th><th>来源</th></tr></thead><tbody>${fs
        .map((r) => {
          const f = r.financial;
          return `<tr><td>${safeText(f.period)}<small class="muted" style="display:block">${basisLabels[f.basis]} · 亿 ${f.currency}</small></td><td>${pct(f.roic)}</td><td>${pct(f.roe)}</td><td>${fmt(f.cfo, 2)}</td><td>${fmt(f.capex, 2)}</td><td>${fmt(f.cfo !== null && f.capex !== null ? f.cfo - f.capex : null, 2)}</td><td>${sourceLink(r.source)}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : '<div class="empty">尚未录入财务观察，不填充示例财报。</div>';
}
function addReview() {
  try {
    const t = $("reviewCompany").value,
      date = $("reviewDate").value,
      note = $("reviewNote").value.trim(),
      source = $("reviewSource").value.trim();
    assert(validDate(date) && date <= today(), "复盘日期需有效且不晚于今天");
    assert(note, "请填写新证据 / Bear Case");
    urlField(source, "证据链接");
    const next = $("nextReview").value;
    assert(
      !next || (validDate(next) && next >= date),
      "下次复盘日期不能早于本次复盘",
    );
    const r = {
      id: uid(),
      ticker: t,
      date,
      status: $("reviewStatus").value,
      note,
      source,
      invalidation: $("reviewInvalidation").value.trim(),
      createdAt: new Date().toISOString(),
    };
    const nums = {
      roic: num($("finROIC").value),
      roe: num($("finROE").value),
      cfo: num($("finCFO").value),
      capex: num($("finCapex").value),
    };
    if (
      Object.values(nums).some((v) => v !== null) ||
      $("finPeriod").value.trim()
    ) {
      assert($("finPeriod").value.trim(), "填写财务数据时请注明报表期");
      assert(source, "财务观察需要来源链接");
      assert(
        nums.capex === null || nums.capex >= 0,
        "资本开支请按支出正数填写",
      );
      r.financial = {
        period: $("finPeriod").value.trim(),
        basis: $("finBasis").value,
        currency: $("finCurrency").value,
        ...nums,
      };
    }
    const proposed = validateData({
      ...payload(),
      reviews: [...state.reviews, r],
    });
    state.reviews = proposed.reviews;
    if (next) profile(t).nextReview = next;
    else {
      const dt = new Date(date + "T12:00:00");
      dt.setDate(dt.getDate() + 90);
      profile(t).nextReview =
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    }
    persist("复盘与下次计划已保存");
    for (const id of [
      "reviewNote",
      "reviewSource",
      "reviewInvalidation",
      "finPeriod",
      "finROIC",
      "finROE",
      "finCFO",
      "finCapex",
      "nextReview",
    ])
      $(id).value = "";
    $("reviewStatus").value = "unchanged";
    renderReviews();
    refreshScores();
  } catch (e) {
    notify(e.message, true);
  }
}
function download(name, text, type) {
  const a = document.createElement("a"),
    u = URL.createObjectURL(new Blob([text], { type }));
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}
function exportJson() {
  download(
    "十五五价值投资看板-v2-" + today() + ".json",
    JSON.stringify(payload(), null, 2),
    "application/json",
  );
  notify("已生成 JSON 备份，请保留下载文件。");
}
function csvCell(x) {
  let s = String(x ?? "");
  if (typeof x === "string" && /^[\s]*[=+@\-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
function exportCsv() {
  const cols = [
    "主题",
    "Ticker",
    "公司",
    "研究角色",
    "股价",
    "报价币种",
    "市值_亿",
    "市值币种",
    "PE",
    "PB",
    "股息率_%",
    "研究评分",
    "重点关注",
    "快照日期",
    "核验状态",
    "来源",
    "口径",
    "投资逻辑",
    "Bear_Case",
    "失效条件",
    "下次复盘",
  ];
  const rows = state.companies.map((c) => [
    c.theme,
    c.ticker,
    c.name,
    c.role,
    c.price,
    c.meta.quoteCurrency,
    c.mcap,
    c.meta.currency,
    c.pe,
    c.pb,
    c.div,
    scoreCompany(c),
    profile(c.ticker).watch ? "是" : "否",
    c.meta.asOf,
    verified(c) ? "用户已核验" : "待核验",
    c.meta.source,
    c.meta.basis,
    c.thesis,
    c.bear,
    profile(c.ticker).failure,
    profile(c.ticker).nextReview,
  ]);
  download(
    "十五五价值投资研究池-" + today() + ".csv",
    "\ufeff" +
      [cols, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
async function importJson(file) {
  $("importJson").value = "";
  try {
    assert(file.size <= 10 * 1024 * 1024, "JSON 超过 10 MB");
    const parsed = JSON.parse(await file.text());
    const candidate = validateData(parsed);
    pendingImport = candidate;
    $("importPreview").classList.remove("hidden");
    $("importPreview").innerHTML =
      `<b>导入预览</b><p>${candidate.companies.length} 家公司 · ${candidate.reviews.length} 条复盘 · ${Object.keys(candidate.valuationAssumptions).length} 组估值。</p><p class="muted-line">应用后会替换当前浏览器中的整个研究池及记录。请先备份，其他设备不会自动更新。</p><div class="actions"><button id="backupBeforeImport" class="btn">备份当前数据</button><button id="applyImport" class="btn primary">确认替换并导入</button><button id="cancelImport" class="btn">取消</button></div>`;
    $("backupBeforeImport").onclick = exportJson;
    $("cancelImport").onclick = () => {
      pendingImport = null;
      $("importPreview").classList.add("hidden");
    };
    $("applyImport").onclick = () => {
      state = pendingImport;
      pendingImport = null;
      storageAvailable = true;
      persist("导入成功");
      $("importPreview").classList.add("hidden");
      populateFilters();
      renderWeights();
      updateValuationCompany();
      renderReviews();
    };
    notify("文件校验通过，请在数据管理中确认导入。");
  } catch (e) {
    pendingImport = null;
    $("importPreview").classList.add("hidden");
    notify("导入失败，当前数据未改变：" + e.message, true);
  }
}
function init() {
  document
    .querySelectorAll(".tab")
    .forEach((b) => (b.onclick = () => activateTab(b.dataset.tab)));
  for (const id of [
    "search",
    "themeFilter",
    "roleFilter",
    "minScore",
    "maxPE",
    "watchOnly",
    "unverifiedOnly",
  ])
    $(id).addEventListener("input", renderTable);
  $("resetFilters").onclick = resetFilters;
  document.querySelectorAll("#companyTable th[data-sort]").forEach((th) => {
    th.tabIndex = 0;
    const sort = () => {
      state.sort = {
        key: th.dataset.sort,
        dir:
          state.sort.key === th.dataset.sort && state.sort.dir === "desc"
            ? "asc"
            : "desc",
      };
      renderTable();
    };
    th.onclick = sort;
    th.onkeydown = (e) => {
      if (e.key === "Enter") sort();
    };
  });
  $("closeDrawer").onclick = () => closeDrawer();
  $("cancelCompany").onclick = () => closeDrawer();
  $("backdrop").onclick = () => closeDrawer();
  $("drawer").addEventListener("input", () => (drawerDirty = true));
  document.addEventListener("keydown", (e) => {
    if (!drawerTicker) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
    }
    if (e.key === "Tab") {
      const els = [
        ...$("drawer").querySelectorAll(
          "button,input,textarea,select,summary,a[href]",
        ),
      ].filter((x) => !x.disabled && x.getClientRects().length);
      const first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });
  $("saveCompany").onclick = saveCompany;
  $("toggleWatch").onclick = () => toggleWatch(drawerTicker);
  for (const [button, tab, select] of [
    ["drawerVal", "valuation", "valCompany"],
    ["drawerReview", "reviews", "reviewCompany"],
  ])
    $(button).onclick = () => {
      const t = drawerTicker;
      if (!closeDrawer()) return;
      activateTab(tab);
      $(select).value = t;
      if (tab === "valuation") updateValuationCompany();
      else {
        renderReviews();
        $("nextReview").value = profile(t).nextReview;
      }
    };
  $("resetWeights").onclick = () => {
    state.weights = { ...DEFAULT_WEIGHTS };
    state.penalties = { ...DEFAULT_PENALTIES };
    renderWeights();
    persist("已恢复默认权重");
  };
  $("saveWeights").onclick = () => persist("评分权重已保存");
  $("valCompany").onchange = updateValuationCompany;
  for (const id of [...valFields, "scopeConfirmed"])
    $(id).addEventListener("input", calcValuation);
  $("oeCurrency").onchange = () => {
    $("fxRate").value = "";
    updateFx();
    calcValuation();
  };
  $("saveValuation").onclick = saveValuation;
  $("clearValuation").onclick = () => {
    if (confirm("清除该公司的已保存估值假设？")) {
      delete state.valuationAssumptions[$("valCompany").value];
      persist("估值假设已清除");
      updateValuationCompany();
    }
  };
  $("reviewCompany").onchange = () => {
    renderReviews();
    $("nextReview").value = profile($("reviewCompany").value).nextReview;
  };
  $("addReview").onclick = addReview;
  $("reviewDate").value = today();
  $("exportJson").onclick = exportJson;
  $("exportCsv").onclick = exportCsv;
  $("importJson").onchange = (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
  };
  $("resetLocal").onclick = () => {
    if (
      confirm(
        "将删除当前浏览器中的自定义公司数据、关注、权重、估值和复盘，恢复初始研究池。建议先导出 JSON。确认重置？",
      )
    ) {
      state = validateData({ companies: BASE_COMPANIES });
      try {
        localStorage.removeItem(STORAGE_KEY);
        for (const k of ["xw_weights", "xw_penalties", "xw_vals", "xw_reviews"])
          localStorage.removeItem(k);
        storageAvailable = true;
      } catch {}
      persist("已恢复初始研究池");
      populateFilters();
      renderWeights();
      updateValuationCompany();
      renderReviews();
    }
  };
  populateFilters();
  renderWeights();
  updateValuationCompany();
  renderReviews();
  activateTab("overview");
  notify(
    bootWarning || "就绪 · 修改保存在当前浏览器；请定期导出 JSON 备份。",
    !!bootWarning,
  );
}
// Allow pure model functions to be tested without a browser.
if (typeof document !== "undefined") init();
