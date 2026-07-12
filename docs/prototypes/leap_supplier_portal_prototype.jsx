import React, { useState, createContext, useContext } from "react";
import {
  LayoutGrid, PackageSearch, ShoppingBag, RotateCcw, MessageSquare, Wallet, Settings,
  Search, Bell, ChevronRight, ChevronLeft, TrendingUp, Plus, Upload, Download, Check, X,
  Star, MoreHorizontal, FileSpreadsheet, ImagePlus, Truck, Send, AlertTriangle, Store,
  BadgeCheck, Building2, CreditCard, Bike, Disc, BatteryMedium,
  Lightbulb, Wrench, Fan, Cog, Languages
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ============================================================
   LEAP 供应商门户 / Supplier Portal — bilingual (中文 / English)
   同一套品牌体系: Asphalt/Signal/Torque/Gauge/Amber/Red
   字体: Noto Sans SC (中文) · Inter (英文界面) · Barlow Condensed (数字)
   JetBrains Mono (单号/编码，双语言下保持不变)
   ============================================================ */

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";

const C = {
  ink: "#14171C", canvas: "#F5F6F8", card: "#FFFFFF", line: "#E4E6EA",
  signal: "#E8622C", torque: "#2A5FD9", gauge: "#1E9D6B", amber: "#B9791F", red: "#C0362C",
  muted: "#6B7280", gaugeBg: "#E4F5EC", amberBg: "#FCEFD8", torqueBg: "#E9EFFC", redBg: "#FBE7E5",
};
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };
// body font switches with language so CJK glyphs render properly in zh mode
function useBodyFont() {
  const { lang } = useLang();
  return { fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" };
}

/* ---------------- Language context ---------------- */

const LangContext = createContext({ lang: "zh", t: null, toggle: () => {} });
const useLang = () => useContext(LangContext);

/* ---------------- Bilingual copy dictionary ---------------- */

const STRINGS = {
  zh: {
    badge: "供应商", role: "店铺运营", searchPlaceholder: "搜索商品、订单编号…",
    nav: { overview: "概览", products: "商品管理", orders: "订单管理", returns: "退货/售后", messages: "消息中心", finance: "财务结算", settings: "店铺设置" },
    verifiedSince: (d) => `已认证供应商 · 入驻于 ${d}`,
    overview: {
      title: "概览", subtitle: "数据每 5 分钟更新一次",
      alert: (a, b, c) => (<span><b>{a}</b> 个新订单待确认，<b>{b}</b> 个商品正在翻译审核中，<b>{c}</b> 个售后案例待回复。</span>),
      kpiSales: "本周销售额", kpiSalesSub: "较上周 +9.4%",
      kpiPending: "待处理订单", kpiPendingSub: "其中 2 个待确认",
      kpiListings: "在架商品", kpiListingsSub: "共 6 个分类",
      kpiRating: "店铺评分", kpiRatingSub: "履约达标率 96%",
      trendTitle: "近 7 日销售趋势", topProductsTitle: "热销商品", notificationsTitle: "平台通知",
      stockLabel: "库存",
      days: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
      notifications: [
        ["新的采购要求", "Leap 平台已发布 2026 年 Q3 电子件类目采购指引", "3 小时前"],
        ["结算提醒", "7 月上半月结算将于 7 月 18 日到账", "1 天前"],
        ["翻译更新", "点火线圈总成 的多语言描述正在审核", "1 天前"],
      ],
    },
    products: {
      title: "商品管理", subtitle: (n) => `共 ${n} 个商品 · 平台展示语言由系统自动翻译`,
      bulkUpload: "批量上传", addProduct: "手动添加商品",
      thProduct: "商品", thCategory: "分类", thPrice: "价格", thStock: "库存", thFitment: "适配车型", thStatus: "状态",
      addForm: {
        title: "手动添加商品", nameLabel: "商品名称（中文）", namePlaceholder: "例如：RIDEX 前刹车盘（通风型 300mm）",
        categoryLabel: "商品分类", categories: ["刹车系统", "发动机", "电气系统", "滤清器", "悬挂系统", "照明系统"],
        oemLabel: "零件编号 / OEM 编号", oemPlaceholder: "例如：34116792218",
        priceLabel: "售价（¥ 人民币）", stockLabel: "库存数量",
        fitmentLabel: "适配车型（品牌 / 车型 / 年份）", fitmentPlaceholder: "例如：宝马 / 1系(F20) / 2015–2019",
        descLabel: "商品描述", descPlaceholder: "材质、工艺、认证信息等",
        imageLabel: "商品图片", imageHint: "点击或拖拽上传图片（建议 1000×1000px 以上）",
        cancel: "取消", submit: "提交平台审核",
      },
      bulk: {
        title: "批量上传商品", templateTitle: "批量导入模板（.xlsx）", templateSub: "包含商品信息与车型适配字段，请勿更改表头",
        download: "下载模板", dropHint: "点击选择文件，或将 .xlsx / .csv 文件拖拽至此", recent: "最近上传记录",
        thFile: "文件名", thRows: "行数", thSuccess: "成功", thFail: "失败", thStatus: "状态",
        viewErrors: "查看错误", partial: "部分失败", allSuccess: "全部成功",
        file1: "2026Q3_新品导入.xlsx", file2: "刹车系统补充.xlsx",
      },
    },
    orders: {
      title: "订单管理", subtitle: "订单仅通过平台系统分配，无法与买家直接联系",
      filters: ["全部", "待确认", "备货中", "已发货", "异常/纠纷"],
      thId: "订单编号", thRegion: "买家地区", thItems: "商品", thAmount: "金额", thStatus: "状态",
      detailTitle: "订单详情", itemsTitle: "商品明细", qty: "数量",
      shippingTitle: "发货信息", regionNote: (r) => `买家收货地区：${r}（系统不显示买家详细联系方式，如有问题请通过平台客服沟通）`,
      carrierLabel: "选择物流公司", carriers: ["顺丰国际 (SF International)", "中国邮政国际 (China Post)", "DHL Express", "第三方海外仓专线"],
      trackingLabel: "运单号", trackingPlaceholder: "请输入运单号", markShipped: "标记已发货",
      actionsTitle: "操作", acceptOrder: "确认接单", contactPlatform: "联系平台客服", markOOS: "标记缺货",
    },
    returns: {
      title: "退货 / 售后", subtitle: "所有售后案例均由平台受理并转达，供应商无需直接联系买家",
      relatedOrder: (o) => `关联订单 ${o}`, noteLabel: "平台备注",
      replyPlaceholder: "请输入回复内容，例如是否同意退货、补发或说明原因…",
      cancel: "取消", submitReply: "提交回复", replyButton: "回复平台",
    },
    messages: {
      title: "消息中心", subtitle: "仅可与 Leap 平台沟通，系统不提供与买家的直接聊天渠道",
      inputPlaceholder: "输入消息…",
      initial: "您好，这里是 Leap 平台运营。关于订单 LP-208205 的售后问题，能否请您核实一下该刹车片的适配车型数据？",
      autoReply: "收到，我们会尽快跟进并同步买家。",
    },
    finance: {
      title: "财务与结算", subtitle: "结算币种：人民币 (¥) · 结算周期：每半月一次",
      kpiPending: "待结算金额", kpiPendingSub: "预计 2026-07-18 到账",
      kpiLast: "上次结算", kpiLastSub: "2026-07-05 已到账",
      kpiCommission: "平均佣金比例", kpiCommissionSub: "刹车系统类目",
      recordsTitle: "结算记录",
      thPeriod: "结算周期", thOrders: "订单数", thSales: "销售额", thCommission: "平台佣金", thPayout: "应结金额", thStatus: "状态", thDate: "到账日期",
      bankTitle: "收款账户", bankLine1: "中国建设银行 尾号 8842", bankLine2: "户名：广州汽配有限公司 · 已通过平台验证",
      periods: ["2026年6月16日–6月30日", "2026年7月1日–7月15日", "2026年7月16日–7月31日"],
    },
    settings: {
      title: "店铺设置", subtitle: "企业资质与联系信息",
      companyTitle: "企业信息", companyName: "公司名称", license: "统一社会信用代码",
      verification: "认证状态", verified: "已认证", mainCat: "主营类目", mainCatValue: "刹车系统、发动机部件、照明系统",
      notifTitle: "通知设置",
      toggles: ["新订单提醒", "库存不足预警", "结算到账通知", "翻译审核结果通知"],
    },
    statusProduct: { active: "上架中", translating: "翻译审核中", inactive: "已下架" },
    statusOrder: { pending: "待确认", preparing: "备货中", shipped: "已发货", dispute: "异常/纠纷" },
    statusReturn: { awaiting: "待供应商回复", inProgress: "处理中", completed: "已完成" },
    statusPayout: { paid: "已结算", pending: "待结算", calculating: "统计中" },
  },
  en: {
    badge: "Supplier", role: "Store Operator", searchPlaceholder: "Search products, order numbers…",
    nav: { overview: "Overview", products: "Products", orders: "Orders", returns: "Returns", messages: "Messages", finance: "Finance", settings: "Settings" },
    verifiedSince: (d) => `Verified supplier · Joined ${d}`,
    overview: {
      title: "Overview", subtitle: "Data refreshes every 5 minutes",
      alert: (a, b, c) => (<span><b>{a}</b> new orders awaiting confirmation, <b>{b}</b> listings in translation review, <b>{c}</b> return case(s) awaiting your reply.</span>),
      kpiSales: "Sales this week", kpiSalesSub: "+9.4% vs last week",
      kpiPending: "Pending orders", kpiPendingSub: "2 awaiting confirmation",
      kpiListings: "Active listings", kpiListingsSub: "Across 6 categories",
      kpiRating: "Store rating", kpiRatingSub: "96% fulfillment SLA",
      trendTitle: "Sales trend (last 7 days)", topProductsTitle: "Top products", notificationsTitle: "Platform notices",
      stockLabel: "Stock",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      notifications: [
        ["New sourcing guidance", "Leap has published Q3 2026 sourcing guidelines for the electrical category", "3 hours ago"],
        ["Payout reminder", "Your early-July payout will land on Jul 18", "1 day ago"],
        ["Translation update", "The listing \u201cIgnition Coil Pack\u201d is under multilingual review", "1 day ago"],
      ],
    },
    products: {
      title: "Products", subtitle: (n) => `${n} products · buyer-facing text is translated automatically`,
      bulkUpload: "Bulk upload", addProduct: "Add product",
      thProduct: "Product", thCategory: "Category", thPrice: "Price", thStock: "Stock", thFitment: "Fitment", thStatus: "Status",
      addForm: {
        title: "Add product", nameLabel: "Product name (Chinese)", namePlaceholder: "e.g. RIDEX Front Brake Disc, Vented 300mm",
        categoryLabel: "Category", categories: ["Brake System", "Engine", "Electrical", "Filters", "Suspension", "Lighting"],
        oemLabel: "Part / OEM number", oemPlaceholder: "e.g. 34116792218",
        priceLabel: "Price (¥ RMB)", stockLabel: "Stock quantity",
        fitmentLabel: "Fitment (make / model / years)", fitmentPlaceholder: "e.g. BMW / 1 Series (F20) / 2015\u20132019",
        descLabel: "Description", descPlaceholder: "Materials, construction, certifications, etc.",
        imageLabel: "Product images", imageHint: "Click or drag to upload (1000\u00d71000px or larger recommended)",
        cancel: "Cancel", submit: "Submit for platform review",
      },
      bulk: {
        title: "Bulk upload products", templateTitle: "Bulk import template (.xlsx)", templateSub: "Includes product and fitment fields \u2014 do not change the header row",
        download: "Download template", dropHint: "Click to choose a file, or drag an .xlsx / .csv file here", recent: "Recent uploads",
        thFile: "File name", thRows: "Rows", thSuccess: "Success", thFail: "Failed", thStatus: "Status",
        viewErrors: "View errors", partial: "Partial failure", allSuccess: "All succeeded",
        file1: "2026Q3_new_listings.xlsx", file2: "brake_system_supplement.xlsx",
      },
    },
    orders: {
      title: "Orders", subtitle: "Orders are routed by the platform only \u2014 no direct contact with buyers",
      filters: ["All", "Pending", "Preparing", "Shipped", "Dispute"],
      thId: "Order", thRegion: "Buyer region", thItems: "Items", thAmount: "Amount", thStatus: "Status",
      detailTitle: "Order details", itemsTitle: "Order items", qty: "Qty",
      shippingTitle: "Shipping", regionNote: (r) => `Buyer's region: ${r} (buyer contact details are not shown \u2014 use Platform Support for anything you need)`,
      carrierLabel: "Carrier", carriers: ["SF International", "China Post International", "DHL Express", "Third-party overseas warehouse line"],
      trackingLabel: "Tracking number", trackingPlaceholder: "Enter tracking number", markShipped: "Mark as shipped",
      actionsTitle: "Actions", acceptOrder: "Accept order", contactPlatform: "Contact Platform Support", markOOS: "Mark out of stock",
    },
    returns: {
      title: "Returns / Warranty", subtitle: "All cases are handled and relayed by the Platform \u2014 no direct buyer contact needed",
      relatedOrder: (o) => `Related order ${o}`, noteLabel: "Platform note",
      replyPlaceholder: "Enter your reply \u2014 e.g. whether you accept the return, a replacement, or an explanation…",
      cancel: "Cancel", submitReply: "Submit reply", replyButton: "Reply to Platform",
    },
    messages: {
      title: "Messages", subtitle: "You can only message the Leap platform team \u2014 there is no direct buyer chat",
      inputPlaceholder: "Type a message…",
      initial: "Hi! This is Leap Platform Support. For the return case on order LP-208205, could you confirm the fitment data for this brake pad?",
      autoReply: "Got it \u2014 we'll follow up and keep the buyer updated.",
    },
    finance: {
      title: "Finance & Payouts", subtitle: "Settlement currency: RMB (\u00a5) · Payout cycle: twice monthly",
      kpiPending: "Pending payout", kpiPendingSub: "Expected Jul 18, 2026",
      kpiLast: "Last payout", kpiLastSub: "Landed Jul 5, 2026",
      kpiCommission: "Avg. commission rate", kpiCommissionSub: "Brake System category",
      recordsTitle: "Payout history",
      thPeriod: "Period", thOrders: "Orders", thSales: "Sales", thCommission: "Commission", thPayout: "Payout", thStatus: "Status", thDate: "Payout date",
      bankTitle: "Payout account", bankLine1: "China Construction Bank •••• 8842", bankLine2: "Account holder: Guangzhou AutoParts Co. \u00b7 Verified",
      periods: ["Jun 16\u201330, 2026", "Jul 1\u201315, 2026", "Jul 16\u201331, 2026"],
    },
    settings: {
      title: "Shop settings", subtitle: "Business credentials and contact information",
      companyTitle: "Company information", companyName: "Company name", license: "Business license number",
      verification: "Verification status", verified: "Verified", mainCat: "Main categories", mainCatValue: "Brake System, Engine Parts, Lighting",
      notifTitle: "Notification settings",
      toggles: ["New order alerts", "Low stock warnings", "Payout notifications", "Translation review results"],
    },
    statusProduct: { active: "Active", translating: "In translation review", inactive: "Inactive" },
    statusOrder: { pending: "Pending", preparing: "Preparing", shipped: "Shipped", dispute: "Dispute" },
    statusReturn: { awaiting: "Awaiting your reply", inProgress: "In progress", completed: "Completed" },
    statusPayout: { paid: "Paid", pending: "Pending", calculating: "Calculating" },
  },
};

const STATUS_COLOR = {
  active: [C.gauge, C.gaugeBg], translating: [C.amber, C.amberBg], inactive: [C.muted, "#EEEFF1"],
  pending: [C.amber, C.amberBg], preparing: [C.torque, C.torqueBg], shipped: [C.torque, C.torqueBg], dispute: [C.red, C.redBg],
  awaiting: [C.amber, C.amberBg], inProgress: [C.torque, C.torqueBg], completed: [C.gauge, C.gaugeBg],
  paid: [C.gauge, C.gaugeBg], calculating: [C.muted, "#EEEFF1"],
};

/* ---------------- Mock data (language-neutral keys, bilingual text) ---------------- */

const COMPANY = { zh: "广州汽配有限公司", en: "Guangzhou AutoParts Co.", rating: 4.6, joined: "2025-11-02" };

const PRODUCTS = [
  { id: "sku1", name: { zh: "RIDEX 前刹车盘（通风型 300mm）", en: "RIDEX Front Brake Disc, Vented 300mm" }, cat: { zh: "刹车系统", en: "Brake System" }, price: 254, stock: 320, fit: { zh: "宝马 1系 (F20)", en: "BMW 1 Series (F20)" }, status: "active", icon: Disc },
  { id: "sku2", name: { zh: "RIDEX 后刹车盘（实心型 290mm）", en: "RIDEX Rear Brake Disc, Solid 290mm" }, cat: { zh: "刹车系统", en: "Brake System" }, price: 168, stock: 12, fit: { zh: "宝马 1系 (F20)", en: "BMW 1 Series (F20)" }, status: "active", icon: Disc },
  { id: "sku3", name: { zh: "博世 陶瓷刹车片套装（前）", en: "Bosch Ceramic Brake Pad Set (Front)" }, cat: { zh: "刹车系统", en: "Brake System" }, price: 298, stock: 210, fit: { zh: "宝马 1系 / 丰田 凯美瑞", en: "BMW 1 Series / Toyota Camry" }, status: "active", icon: Disc },
  { id: "sku4", name: { zh: "点火线圈总成", en: "Ignition Coil Pack" }, cat: { zh: "发动机", en: "Engine" }, price: 218, stock: 96, fit: { zh: "宝马 1系 / 本田 思域", en: "BMW 1 Series / Honda Civic" }, status: "translating", icon: Cog },
  { id: "sku5", name: { zh: "散热风扇总成 12V", en: "Radiator Cooling Fan Assembly, 12V" }, cat: { zh: "冷却系统", en: "Cooling" }, price: 465, stock: 0, fit: { zh: "丰田 凯美瑞", en: "Toyota Camry" }, status: "inactive", icon: Fan },
  { id: "sku6", name: { zh: "LED 大灯灯泡套装", en: "LED Headlight Bulb Set" }, cat: { zh: "照明系统", en: "Lighting" }, price: 199, stock: 540, fit: { zh: "通用车型", en: "Universal fit" }, status: "active", icon: Lightbulb },
];

const ORDERS = [
  { id: "LP-208841", region: { zh: "美国", en: "United States" }, items: [{ name: { zh: "RIDEX 前刹车盘（通风型 300mm）", en: "RIDEX Front Brake Disc, Vented 300mm" }, qty: 1 }], amount: 254, status: "shipped", tracking: "CN-GLB-77213840", placed: "2026-07-04" },
  { id: "LP-208205", region: { zh: "阿联酋", en: "United Arab Emirates" }, items: [{ name: { zh: "博世 陶瓷刹车片套装（前）", en: "Bosch Ceramic Brake Pad Set (Front)" }, qty: 1 }], amount: 298, status: "dispute", tracking: "—", placed: "2026-07-02" },
  { id: "LP-209012", region: { zh: "墨西哥", en: "Mexico" }, items: [{ name: { zh: "RIDEX 后刹车盘（实心型 290mm）", en: "RIDEX Rear Brake Disc, Solid 290mm" }, qty: 2 }], amount: 336, status: "pending", tracking: "—", placed: "2026-07-11" },
  { id: "LP-209044", region: { zh: "爱尔兰", en: "Ireland" }, items: [{ name: { zh: "点火线圈总成", en: "Ignition Coil Pack" }, qty: 1 }], amount: 218, status: "preparing", tracking: "—", placed: "2026-07-10" },
];

const RETURNS = [
  { id: "RC-3391", order: "LP-208205", reason: { zh: "买家反馈刹车片尺寸与车型不符", en: "Buyer reports the brake pad size doesn't match their vehicle" }, note: { zh: "请核实该SKU的适配车型数据是否准确，并告知是否可接受退货。", en: "Please confirm this SKU's fitment data is accurate, and let us know if you'll accept the return." }, status: "awaiting" },
  { id: "RC-3378", order: "LP-208690", reason: { zh: "包装破损导致产品受潮", en: "Damaged packaging led to moisture damage" }, note: { zh: "已为买家安排补发，需要供应商确认库存是否充足。", en: "A replacement has been arranged for the buyer \u2014 please confirm you have stock available." }, status: "inProgress" },
  { id: "RC-3340", order: "LP-207990", reason: { zh: "买家申请无理由退货", en: "Buyer requested a no-reason return" }, note: { zh: "已完成退款，无需供应商操作。", en: "Refund has been completed \u2014 no action needed from you." }, status: "completed" },
];

const PAYOUTS_DATA = [
  { orders: 312, sales: 68420, commission: 8210, payout: 60210, status: "paid", date: "2026-07-05" },
  { orders: 287, sales: 61980, commission: 7438, payout: 54542, status: "pending", date: "2026-07-18" },
  { orders: 94, sales: 20140, commission: 2417, payout: 17723, status: "calculating", date: "2026-08-02" },
];

/* ---------------- Shared UI bits ---------------- */

function PlateChip({ children, small }) {
  return (
    <span style={{ ...mono, border: `1.5px solid ${C.ink}`, color: C.ink, display: "inline-flex", alignItems: "center", padding: small ? "2px 7px" : "4px 10px", borderRadius: 6, fontSize: small ? 10.5 : 12, fontWeight: 700, letterSpacing: "0.04em" }}>{children}</span>
  );
}
function Badge({ label, statusKey }) {
  const [color, bg] = STATUS_COLOR[statusKey] || [C.muted, "#EEEFF1"];
  const font = useBodyFont();
  return <span style={{ ...font, background: bg, color, fontWeight: 700, fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{label}</span>;
}
function KpiCard({ label, value, sub, icon: Icon, accent }) {
  const font = useBodyFont();
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ ...font, fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</span>
        <Icon size={16} color={accent || C.muted} />
      </div>
      <div style={{ ...disp, fontSize: 27, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{value}</div>
      <div style={{ ...font, fontSize: 11.5, color: C.muted }}>{sub}</div>
    </div>
  );
}
function Card({ title, action, children, style }) {
  const font = useBodyFont();
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ ...font, fontSize: 15.5, fontWeight: 700, color: C.ink }}>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
function Th({ children, align }) {
  const font = useBodyFont();
  return <th style={{ ...font, textAlign: align || "left", fontSize: 11.5, fontWeight: 700, color: C.muted, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, align, style }) {
  const font = useBodyFont();
  return <td style={{ ...font, fontSize: 13, color: C.ink, padding: "13px 16px", borderBottom: `1px solid ${C.line}`, textAlign: align || "left", ...style }}>{children}</td>;
}

function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <div style={{ display: "flex", border: "1px solid #3A3F48", borderRadius: 8, overflow: "hidden" }}>
      {["zh", "en"].map(l => (
        <button key={l} onClick={() => lang !== l && toggle()} style={{
          border: "none", cursor: "pointer", padding: "5px 10px", fontSize: 11, fontWeight: 700,
          fontFamily: l === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif",
          background: lang === l ? "#fff" : "transparent", color: lang === l ? C.ink : "#9AA1AC",
        }}>{l === "zh" ? "中文" : "EN"}</button>
      ))}
    </div>
  );
}

function TopBar({ title, subtitle }) {
  const { t, lang } = useLang();
  const font = useBodyFont();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
      <div>
        <div style={{ ...font, fontSize: 20, fontWeight: 900, color: C.ink }}>{title}</div>
        {subtitle && <div style={{ ...font, fontSize: 12.5, color: C.muted, marginTop: 3 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.canvas, borderRadius: 8, padding: "8px 12px", width: 240 }}>
          <Search size={14} color={C.muted} />
          <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{t.searchPlaceholder}</span>
        </div>
        <Bell size={18} color={C.ink} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...font, fontWeight: 700, fontSize: 12 }}>{lang === "zh" ? "广" : "G"}</div>
          <div>
            <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{COMPANY[lang]}</div>
            <div style={{ ...font, fontSize: 10.5, color: C.muted }}>{t.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pages ---------------- */

function OverviewPage() {
  const { t, lang } = useLang();
  const font = useBodyFont();
  const trend = [8400, 9600, 8900, 11200, 12800, 14100, 13250].map((v, i) => ({ d: t.overview.days[i], v }));
  return (
    <div>
      <TopBar title={t.overview.title} subtitle={t.overview.subtitle} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: C.torqueBg, border: `1px solid ${C.torque}33`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={16} color={C.torque} />
          <span style={{ ...font, fontSize: 12.5, color: C.ink }}>{t.overview.alert(2, 1, 1)}</span>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <KpiCard label={t.overview.kpiSales} value="¥78,250" sub={t.overview.kpiSalesSub} icon={TrendingUp} accent={C.gauge} />
          <KpiCard label={t.overview.kpiPending} value="6" sub={t.overview.kpiPendingSub} icon={ShoppingBag} accent={C.amber} />
          <KpiCard label={t.overview.kpiListings} value="4,210" sub={t.overview.kpiListingsSub} icon={PackageSearch} accent={C.torque} />
          <KpiCard label={t.overview.kpiRating} value="4.6" sub={t.overview.kpiRatingSub} icon={Star} accent={C.amber} />
        </div>

        <Card title={t.overview.trendTitle}>
          <div style={{ padding: "16px 18px 8px", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.signal} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C.signal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.muted, fontFamily: lang === "zh" ? "Noto Sans SC" : "Inter" }} axisLine={{ stroke: C.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.muted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `¥${v / 1000}k`} />
                <Tooltip formatter={(v) => [`¥${v.toLocaleString()}`, lang === "zh" ? "销售额" : "Sales"]} contentStyle={{ fontFamily: lang === "zh" ? "Noto Sans SC" : "Inter", fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                <Area type="monotone" dataKey="v" stroke={C.signal} strokeWidth={2.5} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 16 }}>
          <Card title={t.overview.topProductsTitle} style={{ flex: 1 }}>
            <div style={{ padding: 6 }}>
              {PRODUCTS.slice(0, 4).map((p, i) => {
                const Icon = p.icon;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={16} color={C.ink} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{p.name[lang]}</div>
                      <div style={{ ...font, fontSize: 11, color: C.muted }}>{p.cat[lang]} · {t.overview.stockLabel} {p.stock}</div>
                    </div>
                    <span style={{ ...disp, fontSize: 15, fontWeight: 700 }}>¥{p.price}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title={t.overview.notificationsTitle} style={{ flex: 1 }}>
            <div style={{ padding: 6 }}>
              {t.overview.notifications.map((n, i) => (
                <div key={i} style={{ padding: "10px 12px", borderBottom: i < 2 ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{n[0]}</div>
                  <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{n[1]}</div>
                  <div style={{ ...font, fontSize: 10.5, color: "#9AA1AC", marginTop: 4 }}>{n[2]}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  const font = useBodyFont();
  return (
    <div>
      <div style={{ ...font, fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function useInputStyle() {
  const font = useBodyFont();
  return { ...font, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none", boxSizing: "border-box" };
}

function AddProductForm({ onCancel }) {
  const { t } = useLang();
  const f = t.products.addForm;
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  return (
    <Card title={f.title} action={<button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={17} color={C.muted} /></button>}>
      <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label={f.nameLabel}><input style={inputStyle} placeholder={f.namePlaceholder} /></Field>
        <Field label={f.categoryLabel}>
          <select style={inputStyle}>{f.categories.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={f.oemLabel}><input style={inputStyle} placeholder={f.oemPlaceholder} /></Field>
        <Field label={f.priceLabel}><input style={inputStyle} placeholder="0.00" /></Field>
        <Field label={f.stockLabel}><input style={inputStyle} placeholder="0" /></Field>
        <Field label={f.fitmentLabel}><input style={inputStyle} placeholder={f.fitmentPlaceholder} /></Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label={f.descLabel}><textarea style={{ ...inputStyle, height: 80, resize: "none" }} placeholder={f.descPlaceholder} /></Field>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ ...font, fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>{f.imageLabel}</div>
          <div style={{ border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: C.muted }}>
            <ImagePlus size={22} />
            <span style={{ ...font, fontSize: 12 }}>{f.imageHint}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ ...font, padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{f.cancel}</button>
        <button onClick={onCancel} style={{ ...font, padding: "10px 18px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{f.submit}</button>
      </div>
    </Card>
  );
}

function BulkUploadPanel({ onCancel }) {
  const { t } = useLang();
  const b = t.products.bulk;
  const font = useBodyFont();
  return (
    <Card title={b.title} action={<button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={17} color={C.muted} /></button>}>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: C.canvas, borderRadius: 10, marginBottom: 16 }}>
          <FileSpreadsheet size={22} color={C.torque} />
          <div style={{ flex: 1 }}>
            <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{b.templateTitle}</div>
            <div style={{ ...font, fontSize: 11.5, color: C.muted }}>{b.templateSub}</div>
          </div>
          <button style={{ ...font, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Download size={13} /> {b.download}
          </button>
        </div>
        <div style={{ border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: C.muted, marginBottom: 16 }}>
          <Upload size={22} />
          <span style={{ ...font, fontSize: 12.5 }}>{b.dropHint}</span>
        </div>
        <div style={{ ...font, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>{b.recent}</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>{b.thFile}</Th><Th align="right">{b.thRows}</Th><Th align="right">{b.thSuccess}</Th><Th align="right">{b.thFail}</Th><Th>{b.thStatus}</Th><Th></Th></tr></thead>
          <tbody>
            <tr>
              <Td>{b.file1}</Td><Td align="right">86</Td><Td align="right">81</Td><Td align="right" style={{ color: C.red, fontWeight: 700 }}>5</Td>
              <Td><Badge label={b.partial} statusKey="translating" /></Td>
              <Td align="right"><a style={{ ...font, color: C.torque, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{b.viewErrors}</a></Td>
            </tr>
            <tr>
              <Td>{b.file2}</Td><Td align="right">42</Td><Td align="right">42</Td><Td align="right">0</Td>
              <Td><Badge label={b.allSuccess} statusKey="active" /></Td>
              <Td align="right">—</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ProductsPage() {
  const [mode, setMode] = useState("list");
  const { t, lang } = useLang();
  if (mode === "add") return <div style={{ padding: 24 }}><AddProductForm onCancel={() => setMode("list")} /></div>;
  if (mode === "bulk") return <div style={{ padding: 24 }}><BulkUploadPanel onCancel={() => setMode("list")} /></div>;
  return (
    <div>
      <TopBar title={t.products.title} subtitle={t.products.subtitle(PRODUCTS.length)} />
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={() => setMode("bulk")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <Upload size={13} /> {t.products.bulkUpload}
        </button>
        <button onClick={() => setMode("add")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <Plus size={13} /> {t.products.addProduct}
        </button>
      </div>
      <div style={{ padding: 24 }}>
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>{t.products.thProduct}</Th><Th>{t.products.thCategory}</Th><Th align="right">{t.products.thPrice}</Th><Th align="right">{t.products.thStock}</Th><Th>{t.products.thFitment}</Th><Th>{t.products.thStatus}</Th><Th></Th></tr></thead>
            <tbody>
              {PRODUCTS.map(p => {
                const Icon = p.icon;
                return (
                  <tr key={p.id}>
                    <Td><span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={15} color={C.ink} /></div>
                      <span style={{ fontWeight: 700 }}>{p.name[lang]}</span>
                    </span></Td>
                    <Td style={{ color: C.muted }}>{p.cat[lang]}</Td>
                    <Td align="right" style={{ fontWeight: 700 }}>¥{p.price}</Td>
                    <Td align="right" style={{ color: p.stock === 0 ? C.red : p.stock < 20 ? C.amber : C.ink, fontWeight: p.stock < 20 ? 700 : 400 }}>{p.stock}</Td>
                    <Td style={{ color: C.muted }}>{p.fit[lang]}</Td>
                    <Td><Badge label={t.statusProduct[p.status]} statusKey={p.status} /></Td>
                    <Td align="right"><MoreHorizontal size={15} color={C.muted} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function OrderDetailPanel({ order, onBack }) {
  const [tracking, setTracking] = useState("");
  const { t, lang } = useLang();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  const o = t.orders;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div style={{ ...font, fontSize: 18, fontWeight: 900, color: C.ink }}>{o.detailTitle}</div>
        <PlateChip>{order.id}</PlateChip>
        <Badge label={t.statusOrder[order.status]} statusKey={order.status} />
      </div>
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={o.itemsTitle}>
            <div style={{ padding: 6 }}>
              {order.items.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 12px", borderBottom: i < order.items.length - 1 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{it.name[lang]}</span>
                  <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{o.qty} × {it.qty}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title={o.shippingTitle}>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...font, fontSize: 12, color: C.muted }}>{o.regionNote(order.region[lang])}</div>
              <Field label={o.carrierLabel}>
                <select style={inputStyle}>{o.carriers.map(c => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label={o.trackingLabel}>
                <input style={inputStyle} value={tracking} onChange={e => setTracking(e.target.value)} placeholder={o.trackingPlaceholder} />
              </Field>
              <button style={{ ...font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <Truck size={14} /> {o.markShipped}
              </button>
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={o.actionsTitle}>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={{ ...font, padding: 10, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{o.acceptOrder}</button>
              <button style={{ ...font, padding: 10, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{o.contactPlatform}</button>
              <button style={{ ...font, padding: 10, borderRadius: 8, border: `1px solid ${C.red}`, background: C.redBg, color: C.red, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{o.markOOS}</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OrdersPage({ onOpen }) {
  const [filterIdx, setFilterIdx] = useState(0);
  const { t, lang } = useLang();
  const keys = ["all", "pending", "preparing", "shipped", "dispute"];
  const filtered = filterIdx === 0 ? ORDERS : ORDERS.filter(o => o.status === keys[filterIdx]);
  return (
    <div>
      <TopBar title={t.orders.title} subtitle={t.orders.subtitle} />
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 6 }}>
        {t.orders.filters.map((f, i) => (
          <button key={f} onClick={() => setFilterIdx(i)} style={{
            padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif",
            border: `1px solid ${filterIdx === i ? C.ink : C.line}`, background: filterIdx === i ? C.ink : "#fff", color: filterIdx === i ? "#fff" : C.ink,
          }}>{f}</button>
        ))}
      </div>
      <div style={{ padding: 24 }}>
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>{t.orders.thId}</Th><Th>{t.orders.thRegion}</Th><Th>{t.orders.thItems}</Th><Th align="right">{t.orders.thAmount}</Th><Th>{t.orders.thStatus}</Th><Th></Th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} onClick={() => onOpen(o)} style={{ cursor: "pointer" }}>
                  <Td><PlateChip small>{o.id}</PlateChip></Td>
                  <Td>{o.region[lang]}</Td>
                  <Td style={{ maxWidth: 260 }}>{o.items.map(i => i.name[lang]).join(lang === "zh" ? "，" : ", ")}</Td>
                  <Td align="right" style={{ fontWeight: 700 }}>¥{o.amount}</Td>
                  <Td><Badge label={t.statusOrder[o.status]} statusKey={o.status} /></Td>
                  <Td align="right"><ChevronRight size={15} color={C.muted} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function ReturnsPage() {
  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState("");
  const { t, lang } = useLang();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  return (
    <div>
      <TopBar title={t.returns.title} subtitle={t.returns.subtitle} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {RETURNS.map(r => {
          const open = openId === r.id;
          return (
            <Card key={r.id}>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PlateChip small>{r.id}</PlateChip>
                    <span style={{ ...font, fontSize: 11.5, color: C.muted }}>{t.returns.relatedOrder(r.order)}</span>
                  </div>
                  <Badge label={t.statusReturn[r.status]} statusKey={r.status} />
                </div>
                <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{r.reason[lang]}</div>
                <div style={{ background: C.canvas, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ ...font, fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{t.returns.noteLabel}</div>
                  <div style={{ ...font, fontSize: 12.5, color: C.ink }}>{r.note[lang]}</div>
                </div>
                {r.status !== "completed" && (
                  open ? (
                    <div>
                      <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder={t.returns.replyPlaceholder} style={{ ...inputStyle, height: 70, resize: "none", marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setOpenId(null)} style={{ ...font, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.returns.cancel}</button>
                        <button onClick={() => setOpenId(null)} style={{ ...font, padding: "8px 14px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.returns.submitReply}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setOpenId(r.id)} style={{ ...font, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.returns.replyButton}</button>
                  )
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MessagesPage() {
  const { t } = useLang();
  const font = useBodyFont();
  const [messages, setMessages] = useState([{ from: "platform", text: t.messages.initial }]);
  const [lastLang, setLastLang] = useState(t);
  const [input, setInput] = useState("");
  if (lastLang !== t) { setMessages([{ from: "platform", text: t.messages.initial }]); setLastLang(t); }
  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { from: "me", text: input }]);
    setInput("");
    setTimeout(() => setMessages(m => [...m, { from: "platform", text: t.messages.autoReply }]), 700);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title={t.messages.title} subtitle={t.messages.subtitle} />
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "60%" }}>
            <div style={{ ...font, fontSize: 13, padding: "10px 14px", borderRadius: 12, lineHeight: 1.5, background: m.from === "me" ? C.signal : "#fff", color: m.from === "me" ? "#fff" : C.ink, border: m.from === "me" ? "none" : `1px solid ${C.line}` }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${C.line}`, background: C.card }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={t.messages.inputPlaceholder}
          style={{ ...font, flex: 1, border: `1px solid ${C.line}`, borderRadius: 20, padding: "10px 16px", fontSize: 13, outline: "none" }} />
        <button onClick={send} style={{ width: 40, height: 40, borderRadius: "50%", background: C.signal, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Send size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function FinancePage() {
  const { t, lang } = useLang();
  const fi = t.finance;
  return (
    <div>
      <TopBar title={fi.title} subtitle={fi.subtitle} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <KpiCard label={fi.kpiPending} value="¥54,542" sub={fi.kpiPendingSub} icon={Wallet} accent={C.torque} />
          <KpiCard label={fi.kpiLast} value="¥60,210" sub={fi.kpiLastSub} icon={Check} accent={C.gauge} />
          <KpiCard label={fi.kpiCommission} value="12%" sub={fi.kpiCommissionSub} icon={TrendingUp} accent={C.amber} />
        </div>
        <Card title={fi.recordsTitle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>{fi.thPeriod}</Th><Th align="right">{fi.thOrders}</Th><Th align="right">{fi.thSales}</Th><Th align="right">{fi.thCommission}</Th><Th align="right">{fi.thPayout}</Th><Th>{fi.thStatus}</Th><Th>{fi.thDate}</Th></tr></thead>
            <tbody>
              {PAYOUTS_DATA.map((p, i) => (
                <tr key={i}>
                  <Td style={{ fontWeight: 600 }}>{fi.periods[i]}</Td>
                  <Td align="right">{p.orders}</Td>
                  <Td align="right">¥{p.sales.toLocaleString()}</Td>
                  <Td align="right" style={{ color: C.red }}>-¥{p.commission.toLocaleString()}</Td>
                  <Td align="right" style={{ fontWeight: 700 }}>¥{p.payout.toLocaleString()}</Td>
                  <Td><Badge label={t.statusPayout[p.status]} statusKey={p.status} /></Td>
                  <Td style={{ color: C.muted }}>{p.date}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={fi.bankTitle}>
          <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <CreditCard size={20} color={C.muted} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fi.bankLine1}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>{fi.bankLine2}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  const font = useBodyFont();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon size={15} color={C.muted} />
      <span style={{ ...font, fontSize: 12, color: C.muted, width: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ ...font, fontSize: 13, fontWeight: 600, color: C.ink }}>{value}</span>
    </div>
  );
}

function SettingsPage() {
  const { t, lang } = useLang();
  const s = t.settings;
  const [toggles, setToggles] = useState([true, true, true, false]);
  const font = useBodyFont();
  return (
    <div>
      <TopBar title={s.title} subtitle={s.subtitle} />
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <Card title={s.companyTitle} style={{ flex: 1 }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <InfoRow icon={Building2} label={s.companyName} value={COMPANY[lang]} />
            <InfoRow icon={BadgeCheck} label={s.license} value="91440101MA5XXXXXXX" />
            <InfoRow icon={Store} label={s.verification} value={<Badge label={s.verified} statusKey="active" />} />
            <InfoRow icon={Bike} label={s.mainCat} value={s.mainCatValue} />
          </div>
        </Card>
        <Card title={s.notifTitle} style={{ flex: 1 }}>
          <div style={{ padding: 6 }}>
            {s.toggles.map((label, i) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{label}</span>
                <div onClick={() => setToggles(ts => ts.map((v, j) => j === i ? !v : v))} style={{ width: 38, height: 22, borderRadius: 999, background: toggles[i] ? C.gauge : "#D1D5DB", position: "relative", cursor: "pointer" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: toggles[i] ? 18 : 2, transition: "left 0.15s" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */

const NAV_ICONS = { overview: LayoutGrid, products: PackageSearch, orders: ShoppingBag, returns: RotateCcw, messages: MessageSquare, finance: Wallet, settings: Settings };
const NAV_ORDER = ["overview", "products", "orders", "returns", "messages", "finance", "settings"];

function PortalShell() {
  const [page, setPage] = useState("overview");
  const [openOrder, setOpenOrder] = useState(null);
  const { t, lang } = useLang();
  const font = useBodyFont();

  let content;
  if (openOrder) content = <OrderDetailPanel order={openOrder} onBack={() => setOpenOrder(null)} />;
  else if (page === "overview") content = <OverviewPage />;
  else if (page === "products") content = <ProductsPage />;
  else if (page === "orders") content = <OrdersPage onOpen={setOpenOrder} />;
  else if (page === "returns") content = <ReturnsPage />;
  else if (page === "messages") content = <MessagesPage />;
  else if (page === "finance") content = <FinancePage />;
  else if (page === "settings") content = <SettingsPage />;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 700, background: C.canvas, ...font }}>
      <style>{FONT_IMPORT}</style>
      <style>{`tbody tr:hover { background: ${C.canvas}; }`}</style>
      <div style={{ width: 216, background: C.ink, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>LEAP</div>
            <span style={{ ...font, fontSize: 10, color: "#9AA1AC", border: "1px solid #3A3F48", borderRadius: 4, padding: "2px 6px" }}>{t.badge}</span>
          </div>
        </div>
        <div style={{ padding: "0 16px 14px" }}>
          <LangToggle />
        </div>
        <div style={{ flex: 1, padding: "0 12px" }}>
          {NAV_ORDER.map(id => {
            const Icon = NAV_ICONS[id];
            const active = page === id && !openOrder;
            return (
              <button key={id} onClick={() => { setPage(id); setOpenOrder(null); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 2, borderRadius: 8,
                border: "none", cursor: "pointer", textAlign: "left",
                background: active ? C.signal : "transparent", color: active ? "#fff" : "#B8BEC9",
              }}>
                <Icon size={16} />
                <span style={{ ...font, fontSize: 13, fontWeight: active ? 700 : 500 }}>{t.nav[id]}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid #2A2F38" }}>
          <div style={{ ...font, fontSize: 11, color: "#9AA1AC", marginBottom: 4 }}>{COMPANY[lang]}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <BadgeCheck size={13} color={C.gauge} />
            <span style={{ ...font, fontSize: 10.5, color: "#9AA1AC" }}>{t.verifiedSince(COMPANY.joined)}</span>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {content}
      </div>
    </div>
  );
}

export default function LeapSupplierPortalPrototype() {
  const [lang, setLang] = useState("zh");
  const t = STRINGS[lang];
  const toggle = () => setLang(l => (l === "zh" ? "en" : "zh"));
  return (
    <LangContext.Provider value={{ lang, t, toggle }}>
      <PortalShell />
    </LangContext.Provider>
  );
}
