import React, { useState, useEffect, createContext, useContext } from "react";
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
import { LangContext, useLang } from "./langContext";
import { SupplierContext, useSupplier } from "./supplierContext";
import LoginPage from "./LoginPage";
import ExcelJS from "exceljs";
import {
  getStoredToken, saveToken, clearToken, getCurrentUser, SessionExpiredError,
  fetchMySupplierProfile, fetchMyProducts, createProduct, updateProduct,
  fetchMyOrders, updateSubOrder, fetchMyReturnCases, fetchMyReturnCaseById, replyToReturnCase,
  fetchMyOverview,
  fetchBrands, fetchModelsForBrand, fetchGenerationsForModel, fetchEnginesForGeneration, fetchTransmissionsForGeneration,
  uploadProductImage, API_BASE_URL,
  fetchCategories, fetchPartsForCategory,
  fetchMyMessages, sendMyMessage,
  fetchMyNotifications, fetchUnreadNotificationCount, markNotificationRead, markAllNotificationsRead,
  bulkImportProducts, fetchMyDrafts, completeDraftProduct,
} from "./auth";

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

// LangContext and useLang are defined in ./langContext.js (shared with
// LoginPage.jsx) — see that file for why.

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
      trendTitle: "近 7 日销售趋势", topProductsTitle: "热销商品",
      stockLabel: "库存",
      days: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
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
        download: "下载模板", dropHint: "点击选择 .xlsx 文件",
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
      inputPlaceholder: "输入消息（中文）…",
      loading: "加载中…", couldNotLoad: "无法加载消息：",
      noMessagesYet: "暂无消息。开始对话吧。",
      showOriginal: "显示原文", showTranslation: "显示译文",
      translationUnavailable: "（自动翻译暂不可用 — 显示原文）",
    },
    notifications: {
      title: "通知", couldNotLoad: "无法加载通知：",
      noNotificationsYet: "暂无通知。",
      markAllRead: "全部标记为已读",
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
    statusOrder: { pending: "待确认", preparing: "备货中", shipped: "已发货", delivered: "已送达", dispute: "异常/纠纷" },
    statusReturn: { awaiting: "待供应商回复", inProgress: "处理中", approved: "已批准", rejected: "已驳回", completed: "已完成" },
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
      trendTitle: "Sales trend (last 7 days)", topProductsTitle: "Top products",
      stockLabel: "Stock",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
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
        download: "Download template", dropHint: "Click to choose an .xlsx file",
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
      inputPlaceholder: "Type a message (Chinese)…",
      loading: "Loading…", couldNotLoad: "Could not load messages: ",
      noMessagesYet: "No messages yet. Start the conversation.",
      showOriginal: "Show original", showTranslation: "Show translation",
      translationUnavailable: "(auto-translation unavailable — showing original)",
    },
    notifications: {
      title: "Notifications", couldNotLoad: "Could not load notifications: ",
      noNotificationsYet: "No notifications yet.",
      markAllRead: "Mark all read",
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
    statusOrder: { pending: "Pending", preparing: "Preparing", shipped: "Shipped", delivered: "Delivered", dispute: "Dispute" },
    statusReturn: { awaiting: "Awaiting your reply", inProgress: "In progress", approved: "Approved", rejected: "Rejected", completed: "Completed" },
    statusPayout: { paid: "Paid", pending: "Pending", calculating: "Calculating" },
  },
};

const STATUS_COLOR = {
  active: [C.gauge, C.gaugeBg], translating: [C.amber, C.amberBg], inactive: [C.muted, "#EEEFF1"],
  pending: [C.amber, C.amberBg], preparing: [C.torque, C.torqueBg], shipped: [C.torque, C.torqueBg], delivered: [C.gauge, C.gaugeBg], dispute: [C.red, C.redBg],
  awaiting: [C.amber, C.amberBg], inProgress: [C.torque, C.torqueBg], in_progress: [C.torque, C.torqueBg],
  approved: [C.gauge, C.gaugeBg], rejected: [C.red, C.redBg], completed: [C.gauge, C.gaugeBg],
  paid: [C.gauge, C.gaugeBg], calculating: [C.muted, "#EEEFF1"],
};

/* ---------------- Mock data (language-neutral keys, bilingual text) ---------------- */

// COMPANY removed — TopBar/sidebar/Settings now use real data via
// SupplierContext (see supplierContext.js) rather than a hardcoded mock.

const PRODUCTS = [
  { id: "sku1", name: { zh: "RIDEX 前刹车盘（通风型 300mm）", en: "RIDEX Front Brake Disc, Vented 300mm" }, cat: { zh: "刹车系统", en: "Brake System" }, price: 254, stock: 320, fit: { zh: "宝马 1系 (F20)", en: "BMW 1 Series (F20)" }, status: "active", icon: Disc },
  { id: "sku2", name: { zh: "RIDEX 后刹车盘（实心型 290mm）", en: "RIDEX Rear Brake Disc, Solid 290mm" }, cat: { zh: "刹车系统", en: "Brake System" }, price: 168, stock: 12, fit: { zh: "宝马 1系 (F20)", en: "BMW 1 Series (F20)" }, status: "active", icon: Disc },
  { id: "sku3", name: { zh: "博世 陶瓷刹车片套装（前）", en: "Bosch Ceramic Brake Pad Set (Front)" }, cat: { zh: "刹车系统", en: "Brake System" }, price: 298, stock: 210, fit: { zh: "宝马 1系 / 丰田 凯美瑞", en: "BMW 1 Series / Toyota Camry" }, status: "active", icon: Disc },
  { id: "sku4", name: { zh: "点火线圈总成", en: "Ignition Coil Pack" }, cat: { zh: "发动机", en: "Engine" }, price: 218, stock: 96, fit: { zh: "宝马 1系 / 本田 思域", en: "BMW 1 Series / Honda Civic" }, status: "translating", icon: Cog },
  { id: "sku5", name: { zh: "散热风扇总成 12V", en: "Radiator Cooling Fan Assembly, 12V" }, cat: { zh: "冷却系统", en: "Cooling" }, price: 465, stock: 0, fit: { zh: "丰田 凯美瑞", en: "Toyota Camry" }, status: "inactive", icon: Fan },
  { id: "sku6", name: { zh: "LED 大灯灯泡套装", en: "LED Headlight Bulb Set" }, cat: { zh: "照明系统", en: "Lighting" }, price: 199, stock: 540, fit: { zh: "通用车型", en: "Universal fit" }, status: "active", icon: Lightbulb },
];
// NOTE: PRODUCTS above is still used by OverviewPage's "top products"
// widget only — ProductsPage itself now fetches real data (see below).
// This is a documented scope boundary, not an oversight: Overview stays
// mock for this pass, same as the admin dashboard's Payouts/Tickets
// pages did before those got wired in later passes.

// ORDERS mock array removed — OrdersPage and OrderDetailPanel now fetch
// real data from GET /supplier/me/orders.

// RETURNS mock array removed — ReturnsPage now fetches real data from
// GET /returns/supplier/me.

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
  const { profile, unreadNotificationCount, onOpenNotifications } = useSupplier();
  const font = useBodyFont();
  const displayName = profile ? profile.name : "";
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
        <div
          role="button"
          aria-label={t.notifications.title}
          tabIndex={0}
          style={{ position: "relative", cursor: onOpenNotifications ? "pointer" : "default" }}
          onClick={onOpenNotifications}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenNotifications?.(); }}
        >
          <Bell size={18} color={C.ink} />
          {unreadNotificationCount > 0 && (
            <div style={{
              position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8,
              background: C.signal, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
            }}>
              <span style={{ ...font, fontSize: 9, fontWeight: 700, color: "#fff" }}>{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...font, fontWeight: 700, fontSize: 12 }}>{displayName.charAt(0) || "?"}</div>
          <div>
            <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{displayName}</div>
            <div style={{ ...font, fontSize: 10.5, color: C.muted }}>{t.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pages ---------------- */

function OverviewPage({ onSessionExpired }) {
  const { t, lang } = useLang();
  const font = useBodyFont();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchMyOverview(getStoredToken())
      .then((d) => { setData(d); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, [onSessionExpired]);

  if (loadState === "loading") {
    return (
      <div>
        <TopBar title={t.overview.title} subtitle={lang === "zh" ? "加载中…" : "Loading…"} />
        <div style={{ padding: 24 }}><Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div></Card></div>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div>
        <TopBar title={t.overview.title} subtitle="" />
        <div style={{ padding: 24 }}><Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.red }}>{errorMessage}</div></Card></div>
      </div>
    );
  }

  const dayTrend = data.ordersByDay.map(d => ({ d: new Date(d.day).toLocaleDateString(undefined, { weekday: "short" }), v: d.count }));
  const l = {
    totalOrders: lang === "zh" ? "总订单数" : "Total orders",
    pendingOrders: lang === "zh" ? "待处理订单" : "Pending orders",
    totalListings: lang === "zh" ? "在架商品" : "Total listings",
    pendingReturns: lang === "zh" ? "待处理售后" : "Pending returns",
    trendTitle: lang === "zh" ? "近 7 日订单趋势" : "Orders per day (last 7 days)",
    topProductsTitle: lang === "zh" ? "热销商品（按销量）" : "Top products (by units sold)",
    recentOrdersTitle: lang === "zh" ? "最近订单" : "Recent orders",
    unitsSold: lang === "zh" ? "件" : "units",
    noOrders: lang === "zh" ? "近 7 日暂无订单" : "No orders in the last 7 days.",
    noProducts: lang === "zh" ? "暂无销售数据" : "No sales data yet.",
    noRecent: lang === "zh" ? "暂无订单" : "No orders yet.",
  };

  return (
    <div>
      <TopBar title={t.overview.title} subtitle={lang === "zh" ? "真实数据 — 不含虚构的销售额或评分" : "Real data — no fabricated sales totals or ratings"} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <KpiCard label={l.totalOrders} value={String(data.totalOrders)} icon={ShoppingBag} accent={C.gauge} />
          <KpiCard label={l.pendingOrders} value={String(data.pendingOrders)} icon={Truck} accent={C.amber} />
          <KpiCard label={l.totalListings} value={String(data.totalListings)} icon={PackageSearch} accent={C.torque} />
          <KpiCard label={l.pendingReturns} value={String(data.pendingReturns)} icon={AlertTriangle} accent={C.red} />
        </div>

        <Card title={l.trendTitle}>
          <div style={{ padding: "16px 18px 8px", height: 220 }}>
            {dayTrend.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", ...font, fontSize: 12.5, color: C.muted }}>{l.noOrders}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dayTrend} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ordersFillSupplier" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.signal} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={C.signal} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.muted, fontFamily: lang === "zh" ? "Noto Sans SC" : "Inter" }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, lang === "zh" ? "订单" : "Orders"]} contentStyle={{ fontFamily: lang === "zh" ? "Noto Sans SC" : "Inter", fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                  <Area type="monotone" dataKey="v" stroke={C.signal} strokeWidth={2.5} fill="url(#ordersFillSupplier)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div style={{ display: "flex", gap: 16 }}>
          <Card title={l.topProductsTitle} style={{ flex: 1 }}>
            <div style={{ padding: 6 }}>
              {data.topProducts.length === 0 && <div style={{ padding: 20, textAlign: "center", ...font, fontSize: 12.5, color: C.muted }}>{l.noProducts}</div>}
              {data.topProducts.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: i < data.topProducts.length - 1 ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PackageSearch size={16} color={C.ink} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{p.name}</div>
                  </div>
                  <span style={{ ...disp, fontSize: 15, fontWeight: 700 }}>{p.units} {l.unitsSold}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title={l.recentOrdersTitle} style={{ flex: 1 }}>
            <div style={{ padding: 6 }}>
              {data.recentOrders.length === 0 && <div style={{ padding: 20, textAlign: "center", ...font, fontSize: 12.5, color: C.muted }}>{l.noRecent}</div>}
              {data.recentOrders.map((o, i) => (
                <div key={o.subOrderId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: i < data.recentOrders.length - 1 ? `1px solid ${C.line}` : "none" }}>
                  <div>
                    <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{o.orderId}</div>
                    <div style={{ ...font, fontSize: 10.5, color: C.muted, marginTop: 2 }}>{new Date(o.placedAt).toLocaleDateString()}</div>
                  </div>
                  <Badge label={t.statusOrder[o.status] || o.status} statusKey={o.status} />
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

// Matches the backend's ALLOWED_POSITIONS exactly (see
// services/api/src/modules/supplier/routes.js) — a fixed, real list,
// not free text, since "Position" means where on the vehicle the part
// sits.
const POSITION_OPTIONS = [
  { id: "Front", zh: "前部", en: "Front" },
  { id: "Rear", zh: "后部", en: "Rear" },
  { id: "Left", zh: "左侧", en: "Left" },
  { id: "Right", zh: "右侧", en: "Right" },
  { id: "Front-Left", zh: "前左", en: "Front-Left" },
  { id: "Front-Right", zh: "前右", en: "Front-Right" },
  { id: "Rear-Left", zh: "后左", en: "Rear-Left" },
  { id: "Rear-Right", zh: "后右", en: "Rear-Right" },
  { id: "Universal", zh: "通用", en: "Universal" },
];
const MIN_PRODUCT_PHOTOS = 3;

function AddProductForm({ onCancel, onCreated }) {
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const f = t.products.addForm;
  const font = useBodyFont();
  const inputStyle = useInputStyle();

  // Basic fields
  const [nameZh, setNameZh] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [parts, setParts] = useState([]);
  const [part, setPart] = useState("");
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [position, setPosition] = useState(POSITION_OPTIONS[0].id);
  const [oemNumber, setOemNumber] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");

  // Fitment cascade
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [generations, setGenerations] = useState([]);
  const [selectedGenerationId, setSelectedGenerationId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [engines, setEngines] = useState([]);
  const [selectedEngineId, setSelectedEngineId] = useState("");
  const [transmissions, setTransmissions] = useState([]);
  const [selectedTransmissionId, setSelectedTransmissionId] = useState("");

  // Photos
  const [photos, setPhotos] = useState([]); // [{ url, width, height }]
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBrands().then(setBrands).catch((e) => setError(e.message));
  }, []);

  // Real categories, fetched once — a supplier picks from these, not a
  // hardcoded array, so an admin adding a category via the new
  // Categories page shows up here without a code change.
  useEffect(() => {
    fetchCategories().then((c) => {
      setCategories(c);
      if (c.length > 0) setCategory(c[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  // Real parts, scoped to the currently selected category — cascades
  // the same way the Brand -> Model -> Generation fitment picker does.
  // Confirmed requirement: a supplier picks a real Part from a real
  // list, not free text.
  useEffect(() => {
    if (!category) return;
    setIsLoadingParts(true);
    setPart("");
    fetchPartsForCategory(category).then((p) => {
      setParts(p);
      if (p.length > 0) setPart(p[0].nameEn);
      setIsLoadingParts(false);
    }).catch((e) => { setError(e.message); setIsLoadingParts(false); });
  }, [category]);

  const handleBrandChange = async (brandId) => {
    setSelectedBrandId(brandId);
    setSelectedModelId(""); setModels([]);
    setSelectedGenerationId(""); setGenerations([]);
    setSelectedYear(""); setSelectedEngineId(""); setEngines([]);
    setSelectedTransmissionId(""); setTransmissions([]);
    if (!brandId) return;
    try {
      setModels(await fetchModelsForBrand(brandId));
    } catch (e) { setError(e.message); }
  };

  const handleModelChange = async (modelId) => {
    setSelectedModelId(modelId);
    setSelectedGenerationId(""); setGenerations([]);
    setSelectedYear(""); setSelectedEngineId(""); setEngines([]);
    setSelectedTransmissionId(""); setTransmissions([]);
    if (!modelId) return;
    try {
      setGenerations(await fetchGenerationsForModel(modelId));
    } catch (e) { setError(e.message); }
  };

  const handleGenerationChange = async (generationId) => {
    setSelectedGenerationId(generationId);
    setSelectedYear(""); setSelectedEngineId(""); setEngines([]);
    setSelectedTransmissionId(""); setTransmissions([]);
    if (!generationId) return;
    try {
      const [eng, trans] = await Promise.all([fetchEnginesForGeneration(generationId), fetchTransmissionsForGeneration(generationId)]);
      setEngines(eng);
      setTransmissions(trans);
    } catch (e) { setError(e.message); }
  };

  const selectedGeneration = generations.find((g) => g.id === selectedGenerationId);
  const yearOptions = selectedGeneration
    ? Array.from(
        { length: (selectedGeneration.yearEnd || new Date().getFullYear() + 1) - selectedGeneration.yearStart + 1 },
        (_, i) => selectedGeneration.yearStart + i
      )
    : [];

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file later
    setIsUploadingPhoto(true);
    setError(null);
    for (const file of files) {
      try {
        const result = await uploadProductImage(getStoredToken(), file);
        setPhotos((prev) => [...prev, result]);
      } catch (err) {
        setError(err.message);
      }
    }
    setIsUploadingPhoto(false);
  };

  const removePhoto = (url) => setPhotos((prev) => prev.filter((p) => p.url !== url));

  const handleSubmit = async () => {
    const missing = [];
    if (!nameZh.trim()) missing.push(lang === "zh" ? "商品名称" : "product name");
    if (!part.trim()) missing.push(lang === "zh" ? "部件类型" : "part");
    if (!oemNumber.trim()) missing.push(lang === "zh" ? "OEM 编号" : "OEM number");
    if (!price) missing.push(lang === "zh" ? "价格" : "price");
    if (!selectedGenerationId) missing.push(lang === "zh" ? "车型世代" : "vehicle generation");
    if (!selectedYear) missing.push(lang === "zh" ? "年份" : "year");
    if (photos.length < MIN_PRODUCT_PHOTOS) missing.push(lang === "zh" ? `至少 ${MIN_PRODUCT_PHOTOS} 张照片` : `at least ${MIN_PRODUCT_PHOTOS} photos`);
    if (!weightKg) missing.push(lang === "zh" ? "重量" : "weight");
    if (!lengthCm) missing.push(lang === "zh" ? "长度" : "length");
    if (!widthCm) missing.push(lang === "zh" ? "宽度" : "width");
    if (!heightCm) missing.push(lang === "zh" ? "高度" : "height");

    if (missing.length > 0) {
      setError((lang === "zh" ? "请填写：" : "Please fill in: ") + missing.join(lang === "zh" ? "、" : ", "));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createProduct(getStoredToken(), {
        nameZh: nameZh.trim(),
        descriptionZh: descriptionZh.trim() || undefined,
        category,
        part: part.trim(),
        position,
        oemNumber: oemNumber.trim(),
        price: parseFloat(price),
        currencyCode: "CNY",
        stockQuantity: parseInt(stock, 10) || 0,
        fitment: {
          generationId: selectedGenerationId,
          year: parseInt(selectedYear, 10),
          engineId: selectedEngineId || undefined,
          transmissionId: selectedTransmissionId || undefined,
        },
        images: photos.map((p) => p.url),
        weightKg: parseFloat(weightKg),
        lengthCm: parseFloat(lengthCm),
        widthCm: parseFloat(widthCm),
        heightCm: parseFloat(heightCm),
      });
      onCreated();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const selectStyle = { ...inputStyle };
  const cascadeLabel = (zh, en) => (lang === "zh" ? zh : en);

  return (
    <Card title={f.title} action={<button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={17} color={C.muted} /></button>}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ---- Basic info ---- */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label={cascadeLabel("商品名称（中文）", "Product name (Chinese)")}>
            <input style={inputStyle} placeholder="例如：前刹车盘 300mm" value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("类别", "Category")}>
            <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
          </Field>
          <Field label={cascadeLabel("部件类型", "Part")}>
            <select style={selectStyle} value={part} onChange={(e) => setPart(e.target.value)} disabled={isLoadingParts || parts.length === 0}>
              {isLoadingParts && <option>{cascadeLabel("加载中…", "Loading…")}</option>}
              {!isLoadingParts && parts.length === 0 && <option>{cascadeLabel("此类别暂无部件", "No parts yet for this category")}</option>}
              {!isLoadingParts && parts.map(p => <option key={p.id} value={p.nameEn}>{p.nameEn}</option>)}
            </select>
          </Field>
          <Field label={cascadeLabel("安装位置", "Position")}>
            <select style={selectStyle} value={position} onChange={(e) => setPosition(e.target.value)}>
              {POSITION_OPTIONS.map(p => <option key={p.id} value={p.id}>{p[lang]}</option>)}
            </select>
          </Field>
          <Field label={cascadeLabel("OEM 编号", "OEM Number")}>
            <input style={inputStyle} placeholder="e.g. 34116792217" value={oemNumber} onChange={(e) => setOemNumber(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("价格 (¥ 人民币)", "Price (¥ RMB)")}>
            <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("库存数量", "Stock quantity")}>
            <input type="number" style={inputStyle} placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("重量 (kg)", "Weight (kg)")}>
            <input type="number" step="0.01" min="0" style={inputStyle} placeholder="0.00" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("长度 (cm)", "Length (cm)")}>
            <input type="number" step="0.1" min="0" style={inputStyle} placeholder="0.0" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("宽度 (cm)", "Width (cm)")}>
            <input type="number" step="0.1" min="0" style={inputStyle} placeholder="0.0" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
          </Field>
          <Field label={cascadeLabel("高度 (cm)", "Height (cm)")}>
            <input type="number" step="0.1" min="0" style={inputStyle} placeholder="0.0" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label={cascadeLabel("商品描述（中文，选填）", "Description (Chinese, optional)")}>
              <textarea style={{ ...inputStyle, height: 70, resize: "none" }} value={descriptionZh} onChange={(e) => setDescriptionZh(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* ---- Fitment cascade ---- */}
        <div>
          <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
            {cascadeLabel("适配车型", "Vehicle Fitment")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label={cascadeLabel("品牌", "Brand")}>
              <select style={selectStyle} value={selectedBrandId} onChange={(e) => handleBrandChange(e.target.value)}>
                <option value="">{cascadeLabel("请选择", "Select…")}</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel("车型", "Model")}>
              <select style={selectStyle} value={selectedModelId} onChange={(e) => handleModelChange(e.target.value)} disabled={!selectedBrandId}>
                <option value="">{cascadeLabel("请选择", "Select…")}</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel("世代", "Generation")}>
              <select style={selectStyle} value={selectedGenerationId} onChange={(e) => handleGenerationChange(e.target.value)} disabled={!selectedModelId}>
                <option value="">{cascadeLabel("请选择", "Select…")}</option>
                {generations.map(g => <option key={g.id} value={g.id}>{g.name} ({g.yearStart}–{g.yearEnd || cascadeLabel("至今", "present")})</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel("年份", "Year")}>
              <select style={selectStyle} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} disabled={!selectedGenerationId}>
                <option value="">{cascadeLabel("请选择", "Select…")}</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel("发动机（选填）", "Engine (optional)")}>
              <select style={selectStyle} value={selectedEngineId} onChange={(e) => setSelectedEngineId(e.target.value)} disabled={!selectedGenerationId}>
                <option value="">{cascadeLabel("任意发动机", "Any engine")}</option>
                {engines.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel("变速箱（选填）", "Transmission (optional)")}>
              <select style={selectStyle} value={selectedTransmissionId} onChange={(e) => setSelectedTransmissionId(e.target.value)} disabled={!selectedGenerationId}>
                <option value="">{cascadeLabel("任意变速箱", "Any transmission")}</option>
                {transmissions.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* ---- Photos ---- */}
        <div>
          <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            {cascadeLabel(`商品照片（至少 ${MIN_PRODUCT_PHOTOS} 张，高清）`, `Product Photos (at least ${MIN_PRODUCT_PHOTOS}, high resolution)`)}
          </div>
          <div style={{ ...font, fontSize: 11, color: C.muted, marginBottom: 10 }}>
            {cascadeLabel("最短边至少 800 像素。", "Shortest side must be at least 800px.")}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {photos.map((p) => (
              <div key={p.url} style={{ position: "relative", width: 84, height: 84 }}>
                <img src={`${API_BASE_URL}${p.url}`} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                <button
                  onClick={() => removePhoto(p.url)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.red, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label style={{
              width: 84, height: 84, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: C.muted,
            }}>
              {isUploadingPhoto ? <span style={{ fontSize: 11 }}>...</span> : <ImagePlus size={20} />}
              <span style={{ fontSize: 10 }}>{cascadeLabel("添加", "Add")}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} onChange={handlePhotoSelect} disabled={isUploadingPhoto} />
            </label>
          </div>
        </div>

        <div style={{ ...font, fontSize: 11, color: C.muted, background: C.canvas, borderRadius: 8, padding: 10 }}>
          {cascadeLabel(
            "提交后商品状态为「翻译审核中」。Leap 团队将审核并提供英文翻译后方可上架销售。",
            "After submitting, this listing is 'awaiting translation'. The Leap team will review and provide the English translation before it goes live to buyers."
          )}
        </div>
        <div style={{ ...font, fontSize: 11, color: C.muted, background: C.canvas, borderRadius: 8, padding: 10 }}>
          {cascadeLabel(
            "此价格为您的人民币成本。买家看到的最终美元售价由 Leap 根据平台费用（费用、运费、关税等）自动计算，不由您直接设置。",
            "This is your RMB cost. The final USD price a buyer sees is calculated automatically by Leap based on platform fees (fees, shipping, duties, etc.) — you don't set it directly."
          )}
        </div>

        {error && <div style={{ ...font, fontSize: 12, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 10 }}>{error}</div>}
      </div>
      <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ ...font, padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{f.cancel}</button>
        <button onClick={handleSubmit} disabled={isSubmitting} style={{ ...font, padding: "10px 18px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
          {isSubmitting ? (lang === "zh" ? "提交中…" : "Submitting…") : f.submit}
        </button>
      </div>
    </Card>
  );
}

const BULK_TEMPLATE_HEADERS = [
  'OE Number', 'Item Name', 'Price RMB', 'Category', 'Part', 'Position',
  'Weight kg', 'Length cm', 'Width cm', 'Height cm',
];

// Real, live-generated .xlsx template (new) -- CONFIRMED SCOPE: only
// OE Number/Item Name/Price are required; Category/Part/Position/
// dimensions are optional for a supplier willing to fill in more
// upfront; there is deliberately NO photo column and NO per-row
// vehicle columns (the vehicle is picked once for the whole batch) --
// see services/api/README.md's "Real supplier bulk product import"
// section for the full confirmed design.
async function downloadBulkTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.addRow(BULK_TEMPLATE_HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(['BMW-BD-2018-F20', 'Front Brake Disc', 200, 'Brake System', 'Front Brake Disc', 'Front', 5, 30, 30, 10]);
  sheet.columns.forEach((col) => { col.width = 16; });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leap_bulk_upload_template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// Real, case-insensitive header matching -- a supplier's own column
// order or exact casing shouldn't matter as long as the real header
// names are recognizable.
function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

async function parseBulkUploadFile(file) {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const columnIndex = {};
  headerRow.eachCell((cell, colNumber) => {
    const h = normalizeHeader(cell.value);
    if (h.includes('oe') || h.includes('oem')) columnIndex.oemNumber = colNumber;
    else if (h.includes('item name') || h.includes('name')) columnIndex.itemName = colNumber;
    else if (h.includes('price')) columnIndex.price = colNumber;
    else if (h.includes('category')) columnIndex.category = colNumber;
    else if (h.includes('part')) columnIndex.part = colNumber;
    else if (h.includes('position')) columnIndex.position = colNumber;
    else if (h.includes('weight')) columnIndex.weightKg = colNumber;
    else if (h.includes('length')) columnIndex.lengthCm = colNumber;
    else if (h.includes('width')) columnIndex.widthCm = colNumber;
    else if (h.includes('height')) columnIndex.heightCm = colNumber;
  });

  const items = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const get = (key) => (columnIndex[key] ? row.getCell(columnIndex[key]).value : undefined);
    const oemNumber = get('oemNumber');
    const itemName = get('itemName');
    if (!oemNumber && !itemName) return; // a genuinely blank row, not a real item
    items.push({
      oemNumber: oemNumber != null ? String(oemNumber).trim() : '',
      itemName: itemName != null ? String(itemName).trim() : '',
      price: get('price') != null ? Number(get('price')) : null,
      category: get('category') != null ? String(get('category')).trim() : undefined,
      part: get('part') != null ? String(get('part')).trim() : undefined,
      position: get('position') != null ? String(get('position')).trim() : undefined,
      weightKg: get('weightKg') != null ? Number(get('weightKg')) : undefined,
      lengthCm: get('lengthCm') != null ? Number(get('lengthCm')) : undefined,
      widthCm: get('widthCm') != null ? Number(get('widthCm')) : undefined,
      heightCm: get('heightCm') != null ? Number(get('heightCm')) : undefined,
    });
  });
  return items;
}

function BulkUploadPanel({ onCancel, onImported }) {
  const { t, lang } = useLang();
  const b = t.products.bulk;
  const font = useBodyFont();
  const selectStyle = useInputStyle();

  const [step, setStep] = useState('setup'); // 'setup' | 'preview' | 'results'
  const [nameLanguage, setNameLanguage] = useState('zh');
  const [error, setError] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [results, setResults] = useState(null);

  // Real vehicle picker cascade -- same real pattern as AddProductForm's
  // own fitment cascade, duplicated deliberately rather than shared, to
  // avoid any regression risk on that already-working, tested component.
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [generations, setGenerations] = useState([]);
  const [selectedGenerationId, setSelectedGenerationId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [engines, setEngines] = useState([]);
  const [selectedEngineId, setSelectedEngineId] = useState('');
  const [transmissions, setTransmissions] = useState([]);
  const [selectedTransmissionId, setSelectedTransmissionId] = useState('');

  useEffect(() => { fetchBrands().then(setBrands).catch((e) => setError(e.message)); }, []);

  const handleBrandChange = async (brandId) => {
    setSelectedBrandId(brandId);
    setSelectedModelId(''); setModels([]);
    setSelectedGenerationId(''); setGenerations([]);
    setSelectedYear(''); setSelectedEngineId(''); setEngines([]);
    setSelectedTransmissionId(''); setTransmissions([]);
    if (!brandId) return;
    try { setModels(await fetchModelsForBrand(brandId)); } catch (e) { setError(e.message); }
  };
  const handleModelChange = async (modelId) => {
    setSelectedModelId(modelId);
    setSelectedGenerationId(''); setGenerations([]);
    setSelectedYear(''); setSelectedEngineId(''); setEngines([]);
    setSelectedTransmissionId(''); setTransmissions([]);
    if (!modelId) return;
    try { setGenerations(await fetchGenerationsForModel(modelId)); } catch (e) { setError(e.message); }
  };
  const handleGenerationChange = async (generationId) => {
    setSelectedGenerationId(generationId);
    setSelectedYear(''); setSelectedEngineId(''); setEngines([]);
    setSelectedTransmissionId(''); setTransmissions([]);
    if (!generationId) return;
    try {
      const [eng, trans] = await Promise.all([fetchEnginesForGeneration(generationId), fetchTransmissionsForGeneration(generationId)]);
      setEngines(eng); setTransmissions(trans);
    } catch (e) { setError(e.message); }
  };
  const selectedGeneration = generations.find((g) => g.id === selectedGenerationId);
  const yearOptions = selectedGeneration
    ? Array.from({ length: (selectedGeneration.yearEnd || new Date().getFullYear() + 1) - selectedGeneration.yearStart + 1 }, (_, i) => selectedGeneration.yearStart + i)
    : [];

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setIsParsing(true);
    try {
      const items = await parseBulkUploadFile(file);
      if (items.length === 0) {
        setError(lang === 'zh' ? '未能在此文件中识别出任何商品行。' : "Couldn't recognize any product rows in this file.");
      } else {
        setParsedItems(items);
        setStep('preview');
      }
    } catch (err) {
      setError(lang === 'zh' ? '无法读取此文件，请确认它是有效的 .xlsx 文件。' : "Couldn't read this file — make sure it's a valid .xlsx file.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmitImport = async () => {
    if (!selectedGenerationId || !selectedYear) {
      setError(lang === 'zh' ? '请先选择适配车型' : 'Choose the vehicle this batch is for first.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const data = await bulkImportProducts(getStoredToken(), {
        fitment: { generationId: selectedGenerationId, year: Number(selectedYear), engineId: selectedEngineId || undefined, transmissionId: selectedTransmissionId || undefined },
        nameLanguage,
        items: parsedItems,
      });
      setResults(data.results);
      setStep('results');
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cascadeLabel = (zh, en) => (lang === 'zh' ? zh : en);

  if (step === 'results') {
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;
    return (
      <Card title={b.title} action={<button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color={C.muted} /></button>}>
        <div style={{ padding: 20 }}>
          <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            {cascadeLabel(`导入完成：${successCount} 成功`, `Import complete: ${successCount} succeeded`)}{failCount > 0 && cascadeLabel(`，${failCount} 失败`, `, ${failCount} failed`)}
          </div>
          <div style={{ ...font, fontSize: 12.5, color: C.muted, marginBottom: 16 }}>
            {cascadeLabel('成功导入的商品仍需添加照片才能提交审核，请前往"待完善"查看。', 'Successfully imported products still need photos before they can be submitted for review — see My Drafts.')}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>{cascadeLabel('行', 'Row')}</Th><Th>{cascadeLabel('状态', 'Status')}</Th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.index}>
                  <Td>{r.index + 1}</Td>
                  <Td>{r.success ? <Badge label={cascadeLabel('成功', 'Success')} statusKey="active" /> : <span style={{ ...font, color: C.red, fontSize: 12 }}>{r.error}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={onCancel} style={{ ...font, marginTop: 16, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.signal, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {cascadeLabel('完成', 'Done')}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={b.title} action={<button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color={C.muted} /></button>}>
      <div style={{ padding: 20 }}>
        {error && <div style={{ ...font, fontSize: 12, color: C.red, background: '#FBE7E5', borderRadius: 8, padding: 10, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.canvas, borderRadius: 10, marginBottom: 16 }}>
          <FileSpreadsheet size={22} color={C.torque} />
          <div style={{ flex: 1 }}>
            <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{b.templateTitle}</div>
            <div style={{ ...font, fontSize: 11.5, color: C.muted }}>{b.templateSub}</div>
          </div>
          <button onClick={downloadBulkTemplate} style={{ ...font, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            <Download size={13} /> {b.download}
          </button>
        </div>

        {step === 'setup' && (
          <>
            <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
              {cascadeLabel('这批商品适配的车型', 'Vehicle this batch is for')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Field label={cascadeLabel('品牌', 'Brand')}>
                <select style={selectStyle} value={selectedBrandId} onChange={(e) => handleBrandChange(e.target.value)}>
                  <option value="">{cascadeLabel('请选择', 'Select…')}</option>
                  {brands.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel('车型', 'Model')}>
                <select style={selectStyle} value={selectedModelId} onChange={(e) => handleModelChange(e.target.value)} disabled={!selectedBrandId}>
                  <option value="">{cascadeLabel('请选择', 'Select…')}</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel('世代', 'Generation')}>
                <select style={selectStyle} value={selectedGenerationId} onChange={(e) => handleGenerationChange(e.target.value)} disabled={!selectedModelId}>
                  <option value="">{cascadeLabel('请选择', 'Select…')}</option>
                  {generations.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.yearStart}–{g.yearEnd || cascadeLabel('至今', 'present')})</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel('年份', 'Year')}>
                <select style={selectStyle} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} disabled={!selectedGenerationId}>
                  <option value="">{cascadeLabel('请选择', 'Select…')}</option>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel('发动机（选填）', 'Engine (optional)')}>
                <select style={selectStyle} value={selectedEngineId} onChange={(e) => setSelectedEngineId(e.target.value)} disabled={!selectedGenerationId}>
                  <option value="">{cascadeLabel('任意发动机', 'Any engine')}</option>
                  {engines.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel('变速箱（选填）', 'Transmission (optional)')}>
                <select style={selectStyle} value={selectedTransmissionId} onChange={(e) => setSelectedTransmissionId(e.target.value)} disabled={!selectedGenerationId}>
                  <option value="">{cascadeLabel('任意变速箱', 'Any transmission')}</option>
                  {transmissions.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
              {cascadeLabel('商品名称语言', 'Item name language')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <label style={{ ...font, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input type="radio" checked={nameLanguage === 'zh'} onChange={() => setNameLanguage('zh')} /> {cascadeLabel('中文', 'Chinese')}
              </label>
              <label style={{ ...font, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input type="radio" checked={nameLanguage === 'en'} onChange={() => setNameLanguage('en')} /> {cascadeLabel('英文', 'English')}
              </label>
            </div>

            <label style={{ display: 'block', border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 28, textAlign: 'center', color: C.muted, cursor: selectedGenerationId && selectedYear ? 'pointer' : 'default', opacity: selectedGenerationId && selectedYear ? 1 : 0.5 }}>
              <Upload size={22} style={{ marginBottom: 8 }} />
              <div style={{ ...font, fontSize: 12.5 }}>{isParsing ? cascadeLabel('正在读取文件…', 'Reading file…') : b.dropHint}</div>
              <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileSelect} disabled={!selectedGenerationId || !selectedYear || isParsing} />
            </label>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>
              {cascadeLabel(`已识别 ${parsedItems.length} 行`, `${parsedItems.length} rows recognized`)}
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>OE Number</Th><Th>Item Name</Th><Th align="right">Price</Th><Th>Category</Th></tr></thead>
                <tbody>
                  {parsedItems.map((item, i) => (
                    <tr key={i}>
                      <Td>{item.oemNumber || <span style={{ color: C.red }}>{cascadeLabel('缺失', 'missing')}</span>}</Td>
                      <Td>{item.itemName || <span style={{ color: C.red }}>{cascadeLabel('缺失', 'missing')}</span>}</Td>
                      <Td align="right">{item.price ?? <span style={{ color: C.red }}>{cascadeLabel('缺失', 'missing')}</span>}</Td>
                      <Td style={{ color: C.muted }}>{item.category || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('setup')} style={{ ...font, padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {cascadeLabel('返回', 'Back')}
              </button>
              <button disabled={isSubmitting} onClick={handleSubmitImport} style={{ ...font, padding: '9px 16px', borderRadius: 8, border: 'none', background: isSubmitting ? '#D1D5DB' : C.signal, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? 'default' : 'pointer' }}>
                {isSubmitting ? cascadeLabel('导入中…', 'Importing…') : cascadeLabel(`导入 ${parsedItems.length} 项`, `Import ${parsedItems.length} items`)}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// Real "finish this listing" step (new) -- shows only whichever real
// fields this specific draft is still missing (per its real `missing`
// array from GET /me/products/drafts), plus its real required photos
// (always needed, since photos are never in the bulk-import sheet).
function CompleteDraftForm({ draft, onCancel, onCompleted }) {
  const { t, lang } = useLang();
  const font = useBodyFont();
  const selectStyle = useInputStyle();
  const cascadeLabel = (zh, en) => (lang === 'zh' ? zh : en);

  const needsCategory = draft.missing.includes('category') || draft.missing.includes('part');
  const needsPosition = draft.missing.includes('position');
  const needsDimensions = draft.missing.includes('dimensions');

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(draft.category || '');
  const [parts, setParts] = useState([]);
  const [part, setPart] = useState(draft.part || '');
  const [position, setPosition] = useState(draft.position || POSITION_OPTIONS[0].id);
  const [weightKg, setWeightKg] = useState(draft.weightKg || '');
  const [lengthCm, setLengthCm] = useState(draft.lengthCm || '');
  const [widthCm, setWidthCm] = useState(draft.widthCm || '');
  const [heightCm, setHeightCm] = useState(draft.heightCm || '');
  const [photos, setPhotos] = useState(draft.images ? draft.images.map((url) => ({ url })) : []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!needsCategory) return;
    fetchCategories().then((c) => { setCategories(c); if (!category && c.length > 0) setCategory(c[0].id); }).catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!needsCategory || !category) return;
    setPart(""); // real fix: a stale part from a PREVIOUS category selection must not survive a category change
    fetchPartsForCategory(category).then((p) => { setParts(p); if (p.length > 0) setPart(p[0].nameEn); }).catch((e) => setError(e.message));
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setIsUploadingPhoto(true);
    setError(null);
    for (const file of files) {
      try {
        const result = await uploadProductImage(getStoredToken(), file);
        setPhotos((prev) => [...prev, result]);
      } catch (err) {
        setError(err.message);
      }
    }
    setIsUploadingPhoto(false);
  };
  const removePhoto = (url) => setPhotos((prev) => prev.filter((p) => p.url !== url));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await completeDraftProduct(getStoredToken(), draft.id, {
        category: needsCategory ? category : undefined,
        part: needsCategory ? part : undefined,
        position: needsPosition ? position : undefined,
        weightKg: needsDimensions ? Number(weightKg) : undefined,
        lengthCm: needsDimensions ? Number(lengthCm) : undefined,
        widthCm: needsDimensions ? Number(widthCm) : undefined,
        heightCm: needsDimensions ? Number(heightCm) : undefined,
        images: photos.map((p) => p.url),
      });
      onCompleted();
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card title={draft.name} action={<button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color={C.muted} /></button>}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <div style={{ ...font, fontSize: 12, color: C.red, background: '#FBE7E5', borderRadius: 8, padding: 10 }}>{error}</div>}
        <div style={{ ...font, fontSize: 12, color: C.muted }}>
          {draft.oemNumber} · ${Number(draft.price).toFixed(2)}
        </div>

        {needsCategory && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={cascadeLabel('分类', 'Category')}>
              <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel('部件', 'Part')}>
              <select style={selectStyle} value={part} onChange={(e) => setPart(e.target.value)} disabled={parts.length === 0}>
                {parts.map((p) => <option key={p.nameEn} value={p.nameEn}>{p.nameEn}</option>)}
              </select>
            </Field>
          </div>
        )}

        {needsPosition && (
          <Field label={cascadeLabel('位置', 'Position')}>
            <select style={selectStyle} value={position} onChange={(e) => setPosition(e.target.value)}>
              {POSITION_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p[lang]}</option>)}
            </select>
          </Field>
        )}

        {needsDimensions && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label={cascadeLabel('重量 kg', 'Weight kg')}><input style={selectStyle} type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></Field>
            <Field label={cascadeLabel('长 cm', 'Length cm')}><input style={selectStyle} type="number" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} /></Field>
            <Field label={cascadeLabel('宽 cm', 'Width cm')}><input style={selectStyle} type="number" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} /></Field>
            <Field label={cascadeLabel('高 cm', 'Height cm')}><input style={selectStyle} type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} /></Field>
          </div>
        )}

        <div>
          <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            {cascadeLabel(`商品照片（至少 ${MIN_PRODUCT_PHOTOS} 张）`, `Product photos (at least ${MIN_PRODUCT_PHOTOS})`)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {photos.map((p) => (
              <div key={p.url} style={{ position: 'relative', width: 84, height: 84 }}>
                <img src={`${API_BASE_URL}${p.url}`} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.line}` }} />
                <button onClick={() => removePhoto(p.url)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <label style={{ width: 84, height: 84, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: C.muted }}>
              {isUploadingPhoto ? <span style={{ fontSize: 11 }}>...</span> : <ImagePlus size={20} />}
              <span style={{ fontSize: 10 }}>{cascadeLabel('添加', 'Add')}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} disabled={isUploadingPhoto} />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ ...font, padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {cascadeLabel('取消', 'Cancel')}
          </button>
          <button disabled={isSubmitting} onClick={handleSubmit} style={{ ...font, padding: '9px 16px', borderRadius: 8, border: 'none', background: isSubmitting ? '#D1D5DB' : C.gauge, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? 'default' : 'pointer' }}>
            {isSubmitting ? cascadeLabel('提交中…', 'Submitting…') : cascadeLabel('提交审核', 'Submit for review')}
          </button>
        </div>
      </div>
    </Card>
  );
}

// Real list of a supplier's own bulk-imported drafts still needing
// completion (new) -- see GET /me/products/drafts.
function DraftsPanel({ onCancel }) {
  const { lang } = useLang();
  const font = useBodyFont();
  const cascadeLabel = (zh, en) => (lang === 'zh' ? zh : en);
  const [drafts, setDrafts] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    setLoadState('loading');
    fetchMyDrafts(getStoredToken())
      .then((data) => { setDrafts(data); setLoadState('ready'); })
      .catch(() => setLoadState('error'));
  };
  useEffect(load, []);

  if (editingId) {
    const draft = drafts.find((d) => d.id === editingId);
    return <CompleteDraftForm draft={draft} onCancel={() => setEditingId(null)} onCompleted={() => { setEditingId(null); load(); }} />;
  }

  return (
    <Card title={cascadeLabel('待完善的商品', 'Drafts needing completion')} action={<button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color={C.muted} /></button>}>
      <div style={{ padding: 6 }}>
        {loadState === 'loading' && <div style={{ padding: 24, textAlign: 'center', ...font, fontSize: 13, color: C.muted }}>{cascadeLabel('加载中…', 'Loading…')}</div>}
        {loadState === 'ready' && drafts.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', ...font, fontSize: 13, color: C.muted }}>{cascadeLabel('没有待完善的商品。', 'No drafts need completion right now.')}</div>
        )}
        {loadState === 'ready' && drafts.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < drafts.length - 1 ? `1px solid ${C.line}` : 'none' }}>
            <div>
              <div style={{ ...font, fontWeight: 700, fontSize: 13 }}>{d.name}</div>
              <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                {d.oemNumber} · {cascadeLabel('缺少：', 'Needs: ')}{d.missing.join(', ')}
              </div>
            </div>
            <button onClick={() => setEditingId(d.id)} style={{ ...font, padding: '7px 14px', borderRadius: 8, border: 'none', background: C.signal, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {cascadeLabel('完善', 'Complete')}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProductsPage() {
  const [mode, setMode] = useState("list");
  const [products, setProducts] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();

  const load = () => {
    setLoadState("loading");
    fetchMyProducts(getStoredToken())
      .then((data) => { setProducts(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "add") return <div style={{ padding: 24 }}><AddProductForm onCancel={() => setMode("list")} onCreated={() => { setMode("list"); load(); }} /></div>;
  if (mode === "bulk") return <div style={{ padding: 24 }}><BulkUploadPanel onCancel={() => setMode("list")} onImported={load} /></div>;
  if (mode === "drafts") return <div style={{ padding: 24 }}><DraftsPanel onCancel={() => { setMode("list"); load(); }} /></div>;

  return (
    <div>
      <TopBar title={t.products.title} subtitle={loadState === "ready" ? t.products.subtitle(products.length) : "…"} />
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={() => setMode("bulk")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <Upload size={13} /> {t.products.bulkUpload}
        </button>
        <button onClick={() => setMode("drafts")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <FileSpreadsheet size={13} /> {lang === "zh" ? "待完善的商品" : "My Drafts"}
        </button>
        <button onClick={() => setMode("add")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <Plus size={13} /> {t.products.addProduct}
        </button>
      </div>
      <div style={{ padding: 24 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.red }}>{errorMessage}</div></Card>}
        {loadState === "ready" && (
          <Card>
            {/* Fitment and product icon columns from the original mock are
                dropped here — the real backend doesn't track per-product
                fitment mappings for supplier-submitted listings yet, and
                there's no icon/category-image field, so showing either
                would be fake data with nothing real behind it. */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>{t.products.thProduct}</Th><Th>{t.products.thCategory}</Th><Th align="right">{t.products.thPrice}</Th><Th align="right">{t.products.thStock}</Th><Th>{t.products.thStatus}</Th></tr></thead>
              <tbody>
                {products.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>{lang === "zh" ? "暂无商品" : "No products yet."}</td></tr>
                )}
                {products.map(p => (
                  <tr key={p.id}>
                    <Td style={{ fontWeight: 700 }}>{p.name}</Td>
                    <Td style={{ color: C.muted }}>{p.category}</Td>
                    <Td align="right" style={{ fontWeight: 700 }}>${Number(p.price).toFixed(2)} {p.currencyCode}</Td>
                    <Td align="right" style={{ color: p.stockQuantity === 0 ? C.red : p.stockQuantity < 20 ? C.amber : C.ink, fontWeight: p.stockQuantity < 20 ? 700 : 400 }}>{p.stockQuantity}</Td>
                    <Td><Badge label={t.statusProduct[p.status] || p.status} statusKey={p.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

function OrderDetailPanel({ order, onBack, onUpdated }) {
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  const o = t.orders;

  const handleUpdate = async (updates) => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateSubOrder(getStoredToken(), order.subOrderId, updates);
      onUpdated(updated);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // CONFIRMED (migration 027): a supplier's own real leg ends at
  // "shipped" -- to the assigned hub, never to the buyer directly.
  // "Delivered" was removed entirely from here -- that's now a real
  // hub-portal action, since only the hub's own final leg to the buyer
  // (or real carrier tracking covering that same leg) has any real
  // visibility into whether a buyer actually received anything.
  const statusOptions = ["pending", "preparing", "shipped", "dispute"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div style={{ ...font, fontSize: 18, fontWeight: 900, color: C.ink }}>{o.detailTitle}</div>
        <PlateChip>{order.orderId}</PlateChip>
        <Badge label={t.statusOrder[order.status] || order.status} statusKey={order.status} />
      </div>
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={o.itemsTitle}>
            <div style={{ padding: 6 }}>
              {order.items.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 12px", borderBottom: i < order.items.length - 1 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{it.name}</span>
                  <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{o.qty} × {it.quantity} · ${Number(it.unitPrice).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title={o.shippingTitle}>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label={o.trackingLabel}>
                <input style={inputStyle} value={tracking} onChange={e => setTracking(e.target.value)} placeholder={o.trackingPlaceholder} />
              </Field>
              {error && <div style={{ ...font, fontSize: 12, color: C.red }}>{error}</div>}
              <button
                disabled={isSaving}
                onClick={() => handleUpdate({ status: "shipped", trackingNumber: tracking })}
                style={{ ...font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, borderRadius: 8, border: "none", background: isSaving ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: isSaving ? "default" : "pointer" }}
              >
                <Truck size={14} /> {o.markShipped}
              </button>
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={o.actionsTitle}>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {statusOptions.map(s => (
                <button
                  key={s}
                  disabled={isSaving}
                  onClick={() => handleUpdate({ status: s })}
                  style={{
                    ...font, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: isSaving ? "default" : "pointer", textAlign: "left",
                    border: order.status === s ? `2px solid ${C.signal}` : `1px solid ${C.line}`,
                    background: order.status === s ? "#FDF1EB" : "#fff",
                  }}
                >{t.statusOrder[s] || s}</button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OrdersPage({ onOpen }) {
  const [orders, setOrders] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [filterIdx, setFilterIdx] = useState(0);
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const keys = ["all", "pending", "preparing", "shipped", "dispute"];

  useEffect(() => {
    fetchMyOrders(getStoredToken())
      .then((data) => { setOrders(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, [onSessionExpired]);

  const filtered = filterIdx === 0 ? orders : orders.filter(o => o.status === keys[filterIdx]);

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
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.red }}>{errorMessage}</div></Card>}
        {loadState === "ready" && (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>{t.orders.thId}</Th><Th>{t.orders.thItems}</Th><Th align="right">{t.orders.thAmount}</Th><Th>{t.orders.thStatus}</Th><Th></Th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>{lang === "zh" ? "暂无订单" : "No orders yet."}</td></tr>
                )}
                {filtered.map(o => {
                  const amount = o.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
                  return (
                    <tr key={o.subOrderId} onClick={() => onOpen(o)} style={{ cursor: "pointer" }}>
                      <Td><PlateChip small>{o.orderId}</PlateChip></Td>
                      <Td style={{ maxWidth: 260 }}>{o.items.map(i => i.name).join(lang === "zh" ? "，" : ", ")}</Td>
                      <Td align="right" style={{ fontWeight: 700 }}>${amount.toFixed(2)}</Td>
                      <Td><Badge label={t.statusOrder[o.status] || o.status} statusKey={o.status} /></Td>
                      <Td align="right"><ChevronRight size={15} color={C.muted} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
function ReturnsPage() {
  const [cases, setCases] = useState([]);
  const [detailCache, setDetailCache] = useState({});
  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState("");
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const inputStyle = useInputStyle();

  useEffect(() => {
    fetchMyReturnCases(getStoredToken())
      .then((data) => { setCases(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, [onSessionExpired]);

  const openCase = async (id) => {
    setOpenId(id);
    if (!detailCache[id]) {
      try {
        const detail = await fetchMyReturnCaseById(getStoredToken(), id);
        setDetailCache((prev) => ({ ...prev, [id]: detail }));
      } catch (err) {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
      }
    }
  };

  const submitReply = async (id) => {
    if (!reply.trim()) return;
    setIsSending(true);
    try {
      await replyToReturnCase(getStoredToken(), id, reply.trim());
      const detail = await fetchMyReturnCaseById(getStoredToken(), id);
      setDetailCache((prev) => ({ ...prev, [id]: detail }));
      setReply("");
      setOpenId(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const statusKeyMap = { awaiting: "awaiting", in_progress: "inProgress", approved: "approved", rejected: "rejected", completed: "completed" };

  return (
    <div>
      <TopBar title={t.returns.title} subtitle={t.returns.subtitle} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.red }}>{errorMessage}</div></Card>}
        {loadState === "ready" && cases.length === 0 && (
          <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>{lang === "zh" ? "暂无售后案例" : "No return cases."}</div></Card>
        )}
        {loadState === "ready" && cases.map(c => {
          const open = openId === c.id;
          const detail = detailCache[c.id];
          const statusKey = statusKeyMap[c.status] || c.status;
          return (
            <Card key={c.id}>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PlateChip small>{c.id}</PlateChip>
                    <span style={{ ...font, fontSize: 11.5, color: C.muted }}>{t.returns.relatedOrder(c.orderId)}</span>
                  </div>
                  <Badge label={t.statusReturn[statusKey] || c.status} statusKey={c.status} />
                </div>
                <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{c.reason}</div>

                {open && (
                  <div style={{ background: C.canvas, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ ...font, fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{t.returns.noteLabel}</div>
                    {!detail && <div style={{ ...font, fontSize: 12, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div>}
                    {detail && detail.messages.length === 0 && <div style={{ ...font, fontSize: 12, color: C.muted }}>{lang === "zh" ? "暂无消息" : "No messages yet."}</div>}
                    {detail && detail.messages.map((m, i) => (
                      <div key={i} style={{ ...font, fontSize: 12.5, color: C.ink, marginBottom: 6 }}>{m.message}</div>
                    ))}
                  </div>
                )}

                {c.status !== "completed" && (
                  open ? (
                    <div>
                      <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder={t.returns.replyPlaceholder} style={{ ...inputStyle, height: 70, resize: "none", marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setOpenId(null)} style={{ ...font, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.returns.cancel}</button>
                        <button disabled={isSending} onClick={() => submitReply(c.id)} style={{ ...font, padding: "8px 14px", borderRadius: 8, border: "none", background: isSending ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSending ? "default" : "pointer" }}>{t.returns.submitReply}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openCase(c.id)} style={{ ...font, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.returns.replyButton}</button>
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

// Real notifications -- triggered by real order changes and message/
// ticket replies (see services/api/src/modules/notifications/ for the
// 4 real trigger points). Was previously a genuinely dead Bell icon in
// TopBar (no data, no click handler) plus unused leftover mock
// "notifications" translation strings from the original prototype,
// never actually rendered anywhere real.
function SupplierNotificationsPage({ onRefreshBadge }) {
  const { t } = useLang();
  const font = useBodyFont();
  const [notifications, setNotifications] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const load = () => {
    fetchMyNotifications(getStoredToken())
      .then(setNotifications)
      .catch((err) => setErrorMessage(err.message));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead(getStoredToken());
      load();
      onRefreshBadge();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const openNotification = async (n) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(getStoredToken(), n.id);
        load();
        onRefreshBadge();
      } catch (err) {
        setErrorMessage(err.message);
      }
    }
  };

  const hasUnread = (notifications || []).some((n) => !n.isRead);

  return (
    <div>
      <TopBar title={t.notifications.title} />
      <div style={{ padding: 24 }}>
        {errorMessage && <div style={{ ...font, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{t.notifications.couldNotLoad}{errorMessage}</div>}
        {hasUnread && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={markAllRead} style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.torque, background: "none", border: "none", cursor: "pointer" }}>
              {t.notifications.markAllRead}
            </button>
          </div>
        )}
        <Card>
          <div style={{ padding: 6 }}>
            {notifications === null && !errorMessage && <div style={{ ...font, fontSize: 13, color: C.muted, padding: 20 }}>...</div>}
            {notifications !== null && notifications.length === 0 && (
              <div style={{ ...font, fontSize: 13, color: C.muted, padding: 20, textAlign: "center" }}>{t.notifications.noNotificationsYet}</div>
            )}
            {notifications !== null && notifications.map((n, i) => (
              <div
                key={n.id}
                onClick={() => openNotification(n)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 12px",
                  borderBottom: i < notifications.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer",
                }}
              >
                <Bell size={16} color={n.isRead ? C.muted : C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...font, fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: C.ink }}>{n.title}</div>
                  <div style={{ ...font, fontSize: 12, color: C.muted, marginTop: 2 }}>{n.body}</div>
                </div>
                <span style={{ ...font, fontSize: 10.5, color: C.muted, whiteSpace: "nowrap" }}>{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MessagesPage() {
  const { t, lang } = useLang();
  const font = useBodyFont();
  const { onSessionExpired } = useSupplier();
  const [messages, setMessages] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Per-message "show original instead of the translation" toggle --
  // auto-translation isn't perfect, either side should be able to see
  // the real original text on demand, not just trust a translation
  // blindly (same principle as Moderation showing a supplier's real
  // Chinese original alongside the reviewed English translation).
  const [showOriginalFor, setShowOriginalFor] = useState({});

  const load = () => {
    fetchMyMessages(getStoredToken())
      .then(setMessages)
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      await sendMyMessage(getStoredToken(), input.trim());
      setInput("");
      load(); // real refetch -- shows the real stored message, including its real translation status
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title={t.messages.title} subtitle={t.messages.subtitle} />
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {errorMessage && <div style={{ ...font, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{t.messages.couldNotLoad}{errorMessage}</div>}
        {messages === null && !errorMessage && <div style={{ ...font, fontSize: 13, color: C.muted }}>{t.messages.loading}</div>}
        {messages !== null && messages.length === 0 && <div style={{ ...font, fontSize: 13, color: C.muted }}>{t.messages.noMessagesYet}</div>}
        {messages !== null && messages.map((m) => {
          const isMe = m.senderRole === "supplier";
          // The supplier's OWN messages show their own real original
          // (Chinese) text by default -- no need to translate your own
          // words back to yourself. The admin's messages show the real
          // translation (Chinese) by default, since that's what the
          // supplier actually needs to read.
          const defaultText = isMe ? m.originalText : (m.translatedText || m.originalText);
          const showingOriginal = showOriginalFor[m.id] || false;
          const displayText = (!isMe && showingOriginal) ? m.originalText : defaultText;
          const canToggle = !isMe && m.translationStatus === "success";
          return (
            <div key={m.id} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "70%" }}>
              <div style={{ ...font, fontSize: 13, padding: "10px 14px", borderRadius: 12, lineHeight: 1.5, background: isMe ? C.signal : "#fff", color: isMe ? "#fff" : C.ink, border: isMe ? "none" : `1px solid ${C.line}` }}>
                {displayText}
              </div>
              {!isMe && m.translationStatus === "unavailable" && (
                <div style={{ ...font, fontSize: 10.5, color: C.muted, marginTop: 3 }}>{t.messages.translationUnavailable}</div>
              )}
              {canToggle && (
                <button
                  onClick={() => setShowOriginalFor((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                  style={{ ...font, fontSize: 10.5, color: C.torque, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 3 }}
                >
                  {showingOriginal ? t.messages.showTranslation : t.messages.showOriginal}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${C.line}`, background: C.card }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={t.messages.inputPlaceholder}
          style={{ ...font, flex: 1, border: `1px solid ${C.line}`, borderRadius: 20, padding: "10px 16px", fontSize: 13, outline: "none" }} />
        <button onClick={send} disabled={isSending} style={{ width: 40, height: 40, borderRadius: "50%", background: isSending ? "#D1D5DB" : C.signal, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: isSending ? "default" : "pointer" }}>
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
  const { profile } = useSupplier();
  const s = t.settings;
  const [toggles, setToggles] = useState([true, true, true, false]);
  const font = useBodyFont();
  return (
    <div>
      <TopBar title={s.title} subtitle={s.subtitle} />
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <Card title={s.companyTitle} style={{ flex: 1 }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <InfoRow icon={Building2} label={s.companyName} value={profile ? profile.name : ""} />
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
  const [unreadCount, setUnreadCount] = useState(0);
  const { t, lang } = useLang();
  const outerSupplierContext = useSupplier();
  const { profile, onLogout } = outerSupplierContext;
  const font = useBodyFont();

  const refreshUnreadCount = () => {
    fetchUnreadNotificationCount(getStoredToken()).then(setUnreadCount).catch(() => {}); // non-critical -- badge just stays as-is
  };
  useEffect(refreshUnreadCount, []);

  let content;
  if (openOrder) content = <OrderDetailPanel order={openOrder} onBack={() => setOpenOrder(null)} onUpdated={(updated) => setOpenOrder({ ...openOrder, ...updated })} />;
  else if (page === "overview") content = <OverviewPage onSessionExpired={onLogout} />;
  else if (page === "products") content = <ProductsPage />;
  else if (page === "orders") content = <OrdersPage onOpen={setOpenOrder} />;
  else if (page === "returns") content = <ReturnsPage />;
  else if (page === "messages") content = <MessagesPage />;
  else if (page === "finance") content = <FinancePage />;
  else if (page === "settings") content = <SettingsPage />;
  else if (page === "notifications") content = <SupplierNotificationsPage onRefreshBadge={refreshUnreadCount} />;

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
          <div style={{ ...font, fontSize: 11, color: "#9AA1AC", marginBottom: 4 }}>{profile ? profile.name : ""}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
            <BadgeCheck size={13} color={C.gauge} />
            <span style={{ ...font, fontSize: 10.5, color: "#9AA1AC" }}>
              {profile ? t.verifiedSince(new Date(profile.createdAt).toLocaleDateString()) : ""}
            </span>
          </div>
          <button onClick={onLogout} style={{
            ...font, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px",
            borderRadius: 6, border: "1px solid #3A3F48", background: "transparent", color: "#B8BEC9", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
          }}>
            {lang === "zh" ? "退出登录" : "Log out"}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SupplierContext.Provider value={{ ...outerSupplierContext, unreadNotificationCount: unreadCount, onOpenNotifications: () => setPage("notifications") }}>
          {content}
        </SupplierContext.Provider>
      </div>
    </div>
  );
}

/**
 * Auth gate — checks for a saved session on load (verifying the token is
 * still valid via GET /auth/me and that the role is 'supplier', not just
 * trusting whatever's in localStorage), fetches the real supplier profile
 * once authenticated (so TopBar/sidebar/Settings show real data via
 * SupplierContext), and shows LoginPage otherwise.
 */
export default function LeapSupplierPortalApp() {
  const [lang, setLang] = useState("zh");
  const t = STRINGS[lang];
  const toggle = () => setLang(l => (l === "zh" ? "en" : "zh"));

  const [authState, setAuthState] = useState({ status: "checking", user: null, profile: null });

  const loadProfile = (token, user) => {
    fetchMySupplierProfile(token)
      .then((profile) => setAuthState({ status: "loggedIn", user, profile }))
      .catch(() => {
        // Profile fetch failing after a valid login is a real error worth
        // surfacing rather than silently logging out — but we still show
        // the shell, just with a null profile (TopBar handles that gracefully).
        setAuthState({ status: "loggedIn", user, profile: null });
      });
  };

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthState({ status: "loggedOut", user: null, profile: null });
      return;
    }
    getCurrentUser(token)
      .then((user) => {
        if (user.role !== "supplier") {
          clearToken();
          setAuthState({ status: "loggedOut", user: null, profile: null });
          return;
        }
        loadProfile(token, user);
      })
      .catch(() => {
        clearToken();
        setAuthState({ status: "loggedOut", user: null, profile: null });
      });
  }, []);

  const handleLoginSuccess = (token, user) => {
    saveToken(token);
    loadProfile(token, user);
  };

  const handleLogout = () => {
    clearToken();
    setAuthState({ status: "loggedOut", user: null, profile: null });
  };

  return (
    <LangContext.Provider value={{ lang, t, toggle }}>
      {authState.status === "checking" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 700, fontFamily: "'Inter', sans-serif", color: "#6B7280", fontSize: 13 }}>
          {lang === "zh" ? "正在检查登录状态…" : "Checking session…"}
        </div>
      )}
      {authState.status === "loggedOut" && <LoginPage onLoginSuccess={handleLoginSuccess} />}
      {authState.status === "loggedIn" && (
        <SupplierContext.Provider value={{ profile: authState.profile, currentUser: authState.user, onLogout: handleLogout, onSessionExpired: handleLogout }}>
          <PortalShell />
        </SupplierContext.Provider>
      )}
    </LangContext.Provider>
  );
}
