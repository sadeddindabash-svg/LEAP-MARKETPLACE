import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { FONT_IMPORT, C, disp, mono, useBodyFont } from "./theme";
import { exportToExcel } from "./exportToExcel";
import { STATUS_COLOR, PlateChip, Badge, KpiCard, Card, Th, Td } from "./components/ui";
import {
  LayoutGrid, PackageSearch, ShoppingBag, RotateCcw, MessageSquare, Wallet, Settings,
  Search, Bell, ChevronRight, ChevronLeft, TrendingUp, Plus, Upload, Download, Check, X,
  Star, MoreHorizontal, FileSpreadsheet, ImagePlus, Truck, Send, AlertTriangle, Store,
  BadgeCheck, Building2, CreditCard, Disc, BatteryMedium, Video,
  Lightbulb, Wrench, Fan, Cog, Languages, FileQuestion
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { LangContext, useLang } from "./langContext";
import { useAutoRefresh, setIfChanged, sameData } from "./autoRefresh";
import { SupplierContext, useSupplier } from "./supplierContext";
import LoginPage from "./LoginPage";
import ExcelJS from "exceljs";
import { QRCodeSVG } from "qrcode.react";
import {
  getStoredToken, saveToken, clearToken, getCurrentUser, SessionExpiredError,
  fetchMySupplierProfile, fetchMyProducts, createProduct, updateProduct, bulkUpdateProductPrices, bulkUpdateProducts,
  fetchMyOrders, updateSubOrder, acceptSubOrder, refuseSubOrder, fetchMyReturnCases, fetchMyReturnCaseById, replyToReturnCase, fetchMyFaultCases, answerFaultCase, fetchMyReturnAddress, saveMyReturnAddress,
  fetchMyOverview,
  uploadProductImage, uploadProductVideo, fetchProductRequirements, API_BASE_URL,
  fetchCategories, fetchPartsForCategory,
  fetchMyMessages, sendMyMessage,
  fetchMyFinance, fetchMyPayoutMethod, updateMyPayoutMethod,
  fetchMyNotifications, fetchUnreadNotificationCount, markNotificationRead, markAllNotificationsRead,
  bulkImportProducts, matchBulkItemNames, fetchMyDrafts, completeDraftProduct,
  fetchPartRequestQueue, fetchPartRequestDetail, sendPartRequestQuote,
} from "./auth";
import { vehicleSummary } from "./vehicleLabels";
import OrderVehicle, { OrderVehicleCell, carHeader } from "./OrderVehicle";
import VehiclePicker from "./VehiclePicker";
import VersionsStep from "./VersionsStep";
import PartShippingBlock from "./PartShippingBlock";
import { partShippingOf } from "./partShipping";
import { useVehicleCascade } from "./vehicleCascade";
import { setApiLanguage, apiMessage, uiLocale } from "./serverMessages";

/* ============================================================
   LEAP 供应商门户 / Supplier Portal — bilingual (中文 / English)
   同一套品牌体系: Asphalt/Signal/Torque/Gauge/Amber/Red
   字体: Noto Sans SC (中文) · Inter (英文界面) · Barlow Condensed (数字)
   JetBrains Mono (单号/编码，双语言下保持不变)
   ============================================================ */

/* ---------------- Language context ---------------- */

// LangContext and useLang are defined in ./langContext.js (shared with
// LoginPage.jsx) — see that file for why.

/* ---------------- Bilingual copy dictionary ---------------- */

const STRINGS = {
  zh: {
    badge: "供应商", role: "店铺运营", searchPlaceholder: "搜索商品、订单编号…",
    nav: { overview: "概览", products: "商品管理", partRequests: "求购请求", orders: "订单管理", returns: "退货/售后", messages: "消息中心", finance: "财务结算", settings: "店铺设置" },
    verifiedSince: (d) => `已认证供应商 · 入驻于 ${d}`,
    overview: {
      title: "概览", subtitle: "数据每 5 分钟更新一次",
      alert: (a, b, c) => (<span><b>{a}</b> 个新订单待确认，<b>{b}</b> 个商品正在翻译审核中，<b>{c}</b> 个售后案例待回复。</span>),
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
      thProduct: "商品", thCategory: "分类", thClass: "部件类型", thPrice: "价格", thStock: "库存", thFitment: "适配车型", thStatus: "状态",
      filterAll: "全部", filterLowStock: (n) => `库存预警 (${n})`,
      bulkPriceSelected: (n) => `已选择 ${n} 个商品`, bulkPriceUpdate: "批量编辑", export: "导出",
      bulkPriceTitle: "批量调整价格", bulkPricePercent: "百分比", bulkPriceFlat: "固定金额",
      bulkPricePercentHint: "例如：输入 10 表示涨价 10%，输入 -10 表示降价 10%",
      bulkPriceFlatHint: "例如：输入 5 表示每件加 ¥5，输入 -5 表示每件减 ¥5",
      bulkPriceApply: "应用", bulkPriceApplying: "应用中…", bulkPriceCancel: "取消",
      bulkPriceSuccess: (n) => `已成功更新 ${n} 个商品`,
      addForm: {
        title: "手动添加商品", nameLabel: "商品名称（中文）", namePlaceholder: "例如：RIDEX 前刹车盘（通风型 300mm）",
        categoryLabel: "商品分类", categories: ["刹车系统", "发动机", "电气系统", "滤清器", "悬挂系统", "照明系统"],
        oemLabel: "零件编号 / OEM 编号", oemPlaceholder: "例如：34116792218",
        priceLabel: "售价（¥ 人民币）", stockLabel: "库存数量",
        fitmentLabel: "适配车型（品牌 / 车型 / 年份）", fitmentPlaceholder: "例如：宝马 / 1系(F20) / 2015–2019",
        descLabel: "商品描述", descPlaceholder: "材质、工艺、认证信息等",
        imageLabel: "商品图片", imageHint: "点击或拖拽上传图片（建议 1000×1000px 以上）",
        cancel: "取消", submit: "提交平台审核",
        savedKeepFitment: "商品已添加。车型信息已保留，可继续添加同一车型的其他商品。",
      },
      bulk: {
        title: "批量上传商品", templateTitle: "批量导入模板（.xlsx）", templateSub: "包含商品信息与车型适配字段，请勿更改表头",
        download: "下载模板", dropHint: "点击选择 .xlsx 文件",
      },
    },
    orders: {
      title: "订单管理", subtitle: "订单仅通过平台系统分配，无法与买家直接联系",
      filters: ["全部", "待确认", "备货中", "已发货", "异常/纠纷"],
      thId: "订单编号", thRegion: "买家地区", thItems: "商品", thAmount: "金额", thStatus: "状态", export: "导出",
      detailTitle: "订单详情", itemsTitle: "商品明细", qty: "数量",
      shippingTitle: "发货信息", regionNote: (r) => `买家收货地区：${r}（系统不显示买家详细联系方式，如有问题请通过平台客服沟通）`,
      carrierLabel: "选择物流公司", carriers: ["顺丰国际 (SF International)", "中国邮政国际 (China Post)", "DHL Express", "第三方海外仓专线"],
      trackingLabel: "运单号", trackingPlaceholder: "请输入运单号", markShipped: "标记已发货",
      lockedAtHub: "此包裹已到达质检仓，无法再在这里修改。如果仓库发现问题，平台会联系您，您可在“退货/售后”页回复。",
      lockedCancelled: "买家已取消此部分订单，无需再处理。",
      updateTracking: "更新运单号",
      forwardOnlyHint: "状态只能向前推进（待确认 → 备货中 → 已发货），无法退回。仓库收货前仍可更正运单号；收货后将无法再修改。",
      actionsTitle: "操作", acceptOrder: "确认接单", contactPlatform: "联系平台客服", markOOS: "标记缺货",
      labelTitle: "质检中心运单标签", labelHint: "打印此标签并贴在包裹上，质检中心员工到货后扫描即可直接调出此运单记录。",
      labelRecipient: "收件方（质检中心）", labelOrder: "订单编号", printLabel: "打印标签",
    },
    returns: {
      title: "退货 / 售后", subtitle: "所有售后案例均由平台受理并转达，供应商无需直接联系买家",
      relatedOrder: (o) => `关联订单 ${o}`, noteLabel: "平台备注",
      replyPlaceholder: "请输入回复内容，例如是否同意退货、补发或说明原因…",
      cancel: "取消", submitReply: "提交回复", replyButton: "回复平台",
    },
    replacement: {
      title: "换货请求", subtitle: "平台质检确认部分商品存在质量问题，请告知您能否补发替换件。",
      orderLabel: (o) => `订单 ${o}`, itemsLabel: "问题商品",
      question: "您能否补发替换件？", yes: "可以补发", no: "无法补发",
      etaLabel: "预计发出日期", noteLabel: "备注（可选）", notePlaceholder: "例如：库存充足 / 需要等待生产……",
      submit: "提交回复", submitting: "提交中…", errEta: "请选择预计发出日期。", errChoose: "请先选择“可以补发”或“无法补发”。",
      answeredYes: (d) => `您已回复：可以补发，预计 ${d} 发出`, answeredNo: "您已回复：无法补发",
      statusLabels: { awaiting_supplier: "等待您的回复", awaiting_admin: "等待平台决定", refund_pending: "平台正在为买家退款", completed: "已结案" },
      hubNone: "问题商品尚未退回", hubReturned: "问题商品已退回给您", hubDiscarded: "问题商品已在仓库销毁", returnTracking: "退回运单号",
      replacementShipA: "已确认补发。请在“订单”页发运补发订单", replacementShipB: "到质检仓。该订单对买家免费；您按原销售价格获得一次货款，故障商品不再结算。",
      evidenceTitle: "质检证据", evidenceKind: "问题类型", evidenceNote: "质检员备注", evidenceNoPhotos: "质检员没有上传照片。",
      photoOpen: "点击放大", photoClose: "关闭", photoOriginal: "打开原图",
      damageTypes: { physical_damage: "外观损坏", water_damage: "进水损坏", missing_parts: "缺少配件", wrong_item: "商品错发", other: "其他" },
      loadError: "无法加载换货请求：",
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
      title: "财务与结算",
      subtitle: (days) => `金额以人民币 (¥) 计，按您自己设定的价格 × 数量。订单送达并超过 ${days} 天退货期后，Leap 会记录一笔结算。`,
      adjTitle: "Leap 已放款", adjIntro: "以下款项因货物在 Leap 处受损而由 Leap 支付给您，已包含在上方金额中，并将计入您的下一次付款。", adjOriginal: "原订单", adjShipping: "国内运费",
      kpiReady: "可结算金额", kpiReadySub: (n) => `${n} 个订单已过退货期`,
      kpiWaiting: "退货期内", kpiWaitingSub: (n, days) => `${n} 个已送达订单 · ${days} 天退货期后可结算`,
      kpiPaid: "累计已结算", kpiPaidSub: (date) => (date ? `最近一次：${date}` : "暂无结算记录"),
      kpiCommission: "佣金比例", kpiCommissionSub: "按类目设定",
      kpiCommissionNone: "—", kpiCommissionNoneSub: "上架商品后显示",
      recordsTitle: "结算记录", emptyRecords: "暂无结算记录。订单送达并过退货期后，Leap 会记录结算，并显示在这里。",
      thDate: "记录日期", thOrders: "订单数", thSales: "销售额", thCommission: "平台佣金", thPayout: "结算金额", thNotes: "备注",
      returnCaseNote: "有退货申请的订单不计入以上金额。", loadError: "无法加载财务数据：",
      bankTitle: "收款账户",
    },
    settings: {
      title: "店铺设置", subtitle: "企业资质与联系信息",
      companyTitle: "企业信息", companyName: "公司名称", country: "所在国家/地区", contactEmail: "联系邮箱",
      verification: "认证状态", verificationStates: { verified: "已认证", pending: "审核中", rejected: "未通过" },
      returnAddress: {
        title: "退货地址", help: "平台质检仓发现商品存在质量问题时，会把问题商品退回到这个地址。请填写您的快递能够送达的详细地址（可使用中文）。",
        contactName: "联系人", phone: "联系电话", address: "详细地址", save: "保存", saving: "保存中…", saved: "已保存",
        notSet: "尚未填写——质检仓将不知道把问题商品寄到哪里。", errRequired: "请填写联系人、联系电话和详细地址。", loadError: "无法加载退货地址：",
      },
      notifTitle: "通知设置",
      toggles: ["新订单提醒", "库存不足预警", "结算到账通知", "翻译审核结果通知"],
    },
    statusProduct: { active: "上架中", translating: "翻译审核中", inactive: "已下架" },
    statusOrder: { pending: "待确认", preparing: "备货中", shipped: "已发货", delivered: "已送达", dispute: "异常/纠纷", cancelled: "已取消", canceled: "已取消", refused: "已拒绝", returned: "已退货", accepted: "已接单", in_transit: "运输中", at_hub: "已到质检中心", completed: "已完成" },
    statusReturn: { awaiting: "待供应商回复", inProgress: "处理中", approved: "已批准", rejected: "已驳回", completed: "已完成" },
    statusPayout: { paid: "已结算", pending: "待结算", calculating: "统计中" },
  },
  en: {
    badge: "Supplier", role: "Store Operator", searchPlaceholder: "Search products, order numbers…",
    nav: { overview: "Overview", products: "Products", partRequests: "Part Requests", orders: "Orders", returns: "Returns", messages: "Messages", finance: "Finance", settings: "Settings" },
    verifiedSince: (d) => `Verified supplier · Joined ${d}`,
    overview: {
      title: "Overview", subtitle: "Data refreshes every 5 minutes",
      alert: (a, b, c) => (<span><b>{a}</b> new orders awaiting confirmation, <b>{b}</b> listings in translation review, <b>{c}</b> return case(s) awaiting your reply.</span>),
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
      thProduct: "Product", thCategory: "Category", thClass: "Classification", thPrice: "Price", thStock: "Stock", thFitment: "Fitment", thStatus: "Status",
      filterAll: "All", filterLowStock: (n) => `Low stock (${n})`,
      bulkPriceSelected: (n) => `${n} selected`, bulkPriceUpdate: "Bulk edit", export: "Export",
      bulkPriceTitle: "Bulk price adjustment", bulkPricePercent: "Percentage", bulkPriceFlat: "Flat amount",
      bulkPricePercentHint: "e.g. enter 10 for a 10% increase, -10 for a 10% decrease",
      bulkPriceFlatHint: "e.g. enter 5 to add ¥5 per item, -5 to subtract ¥5 per item",
      bulkPriceApply: "Apply", bulkPriceApplying: "Applying…", bulkPriceCancel: "Cancel",
      bulkPriceSuccess: (n) => `Successfully updated ${n} product(s)`,
      addForm: {
        title: "Add product", nameLabel: "Product name (Chinese)", namePlaceholder: "e.g. RIDEX Front Brake Disc, Vented 300mm",
        categoryLabel: "Category", categories: ["Brake System", "Engine", "Electrical", "Filters", "Suspension", "Lighting"],
        oemLabel: "Part / OEM number", oemPlaceholder: "e.g. 34116792218",
        priceLabel: "Price (¥ RMB)", stockLabel: "Stock quantity",
        fitmentLabel: "Fitment (make / model / years)", fitmentPlaceholder: "e.g. BMW / 1 Series (F20) / 2015\u20132019",
        descLabel: "Description", descPlaceholder: "Materials, construction, certifications, etc.",
        imageLabel: "Product images", imageHint: "Click or drag to upload (1000\u00d71000px or larger recommended)",
        cancel: "Cancel", submit: "Submit for platform review",
        savedKeepFitment: "Product added. Vehicle fitment kept \u2014 keep adding more products for the same vehicle.",
      },
      bulk: {
        title: "Bulk upload products", templateTitle: "Bulk import template (.xlsx)", templateSub: "Includes product and fitment fields \u2014 do not change the header row",
        download: "Download template", dropHint: "Click to choose an .xlsx file",
      },
    },
    orders: {
      title: "Orders", subtitle: "Orders are routed by the platform only \u2014 no direct contact with buyers",
      filters: ["All", "Pending", "Preparing", "Shipped", "Dispute"],
      thId: "Order", thRegion: "Buyer region", thItems: "Items", thAmount: "Amount", thStatus: "Status", export: "Export",
      detailTitle: "Order details", itemsTitle: "Order items", qty: "Qty",
      shippingTitle: "Shipping", regionNote: (r) => `Buyer's region: ${r} (buyer contact details are not shown \u2014 use Platform Support for anything you need)`,
      carrierLabel: "Carrier", carriers: ["SF International", "China Post International", "DHL Express", "Third-party overseas warehouse line"],
      trackingLabel: "Tracking number", trackingPlaceholder: "Enter tracking number", markShipped: "Mark as shipped",
      lockedAtHub: "This parcel has reached the inspection hub, so it can't be changed here any more. If the hub finds a problem, the platform will contact you and you can reply under Returns.",
      lockedCancelled: "The buyer cancelled this part, so there is nothing more to do.",
      updateTracking: "Update tracking number",
      forwardOnlyHint: "Status only moves forward (Pending → Preparing → Shipped) and can't be undone. You can still correct the tracking number until the hub receives the parcel; after that nothing can be changed.",
      actionsTitle: "Actions", acceptOrder: "Accept order", contactPlatform: "Contact Platform Support", markOOS: "Mark out of stock",
      labelTitle: "Inspection hub shipping label", labelHint: "Print this and attach it to the package \u2014 hub staff can scan it on arrival to jump straight to this shipment.",
      labelRecipient: "Recipient (inspection hub)", labelOrder: "Order reference", printLabel: "Print label",
    },
    returns: {
      title: "Returns / Warranty", subtitle: "All cases are handled and relayed by the Platform \u2014 no direct buyer contact needed",
      relatedOrder: (o) => `Related order ${o}`, noteLabel: "Platform note",
      replyPlaceholder: "Enter your reply \u2014 e.g. whether you accept the return, a replacement, or an explanation…",
      cancel: "Cancel", submitReply: "Submit reply", replyButton: "Reply to Platform",
    },
    replacement: {
      title: "Replacement requests", subtitle: "Leap's inspection confirmed a fault. Please tell us whether you can send a replacement.",
      orderLabel: (o) => `Order ${o}`, itemsLabel: "Faulty items",
      question: "Can you send a replacement?", yes: "Yes, I can replace it", no: "No, I can't",
      etaLabel: "Date you can send it", noteLabel: "Note (optional)", notePlaceholder: "e.g. We have stock / Needs to be produced…",
      submit: "Send answer", submitting: "Sending…", errEta: "Choose the date you can send the replacement.", errChoose: "Choose “Yes, I can replace it” or “No, I can't” first.",
      answeredYes: (d) => `You answered: yes, you can replace it by ${d}`, answeredNo: "You answered: no, you can't replace it",
      statusLabels: { awaiting_supplier: "Waiting for your answer", awaiting_admin: "Waiting for Leap's decision", refund_pending: "Leap is refunding the buyer", completed: "Closed" },
      hubNone: "The faulty unit has not been sent back yet", hubReturned: "The faulty unit was sent back to you", hubDiscarded: "The faulty unit was discarded at the hub", returnTracking: "Return tracking number",
      replacementShipA: "A replacement is confirmed. Please ship order", replacementShipB: "to the inspection hub from your Orders page. It is free for the buyer; you are paid for it once, as for the original sale, and nothing for the faulty unit.",
      evidenceTitle: "Inspection evidence", evidenceKind: "Kind of problem", evidenceNote: "Inspector's note", evidenceNoPhotos: "The inspector did not upload photos.",
      photoOpen: "Click to enlarge", photoClose: "Close", photoOriginal: "Open original",
      damageTypes: { physical_damage: "Physical damage", water_damage: "Water damage", missing_parts: "Missing parts", wrong_item: "Wrong item", other: "Other" },
      loadError: "Could not load replacement requests: ",
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
      title: "Finance & Payouts",
      subtitle: (days) => `Amounts are in RMB (¥): your own price × quantity. Leap records a payout once your delivered orders have cleared the ${days}-day return window.`,
      adjTitle: "Released by Leap", adjIntro: "Leap is paying you these for a shipment that was damaged while in Leap's care. They are included in the amount above and in your next payout.", adjOriginal: "Original order", adjShipping: "Local shipping",
      kpiReady: "Ready to be paid", kpiReadySub: (n) => `${n} order${n === 1 ? "" : "s"} cleared the return window`,
      kpiWaiting: "In return window", kpiWaitingSub: (n, days) => `${n} delivered order${n === 1 ? "" : "s"} · payable after ${days} days`,
      kpiPaid: "Paid out so far", kpiPaidSub: (date) => (date ? `Last payout ${date}` : "No payouts yet"),
      kpiCommission: "Commission rate", kpiCommissionSub: "Set per category",
      kpiCommissionNone: "—", kpiCommissionNoneSub: "Shown once you have listings",
      recordsTitle: "Payout history", emptyRecords: "No payouts yet. Once your delivered orders clear the return window, Leap records a payout and it appears here.",
      returnCaseNote: "Orders that have a return case are not included in these figures.", loadError: "Could not load your finance data: ",
      thDate: "Date recorded", thOrders: "Orders", thSales: "Sales", thCommission: "Commission", thPayout: "Payout", thNotes: "Notes",
      bankTitle: "Payout account",
    },
    settings: {
      title: "Shop settings", subtitle: "Business credentials and contact information",
      companyTitle: "Company information", companyName: "Company name", country: "Country", contactEmail: "Contact email",
      verification: "Verification status", verificationStates: { verified: "Verified", pending: "Pending review", rejected: "Not approved" },
      returnAddress: {
        title: "Return address", help: "If the inspection hub finds a faulty item, it is sent back to this address. Enter an address your courier can deliver to, in whatever language your courier needs.",
        contactName: "Contact name", phone: "Phone number", address: "Full address", save: "Save", saving: "Saving…", saved: "Saved",
        notSet: "Not entered yet — the inspection hub will not know where to send a faulty item.", errRequired: "Enter a contact name, a phone number and the full address.", loadError: "Could not load your return address: ",
      },
      notifTitle: "Notification settings",
      toggles: ["New order alerts", "Low stock warnings", "Payout notifications", "Translation review results"],
    },
    statusProduct: { active: "Active", translating: "In translation review", inactive: "Inactive" },
    statusOrder: { pending: "Pending", preparing: "Preparing", shipped: "Shipped", delivered: "Delivered", dispute: "Dispute", cancelled: "Cancelled", canceled: "Cancelled", refused: "Refused", returned: "Returned", accepted: "Accepted", in_transit: "In transit", at_hub: "At the hub", completed: "Completed" },
    statusReturn: { awaiting: "Awaiting your reply", inProgress: "In progress", approved: "Approved", rejected: "Rejected", completed: "Completed" },
    statusPayout: { paid: "Paid", pending: "Pending", calculating: "Calculating" },
  },
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

/* ---------------- Shared UI bits ---------------- */

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

// Real supplier analytics (confirmed scope, picked from a list of 10
// real options): revenue+volume over time, top-selling products,
// order status breakdown, low-stock products at a glance, and payout
// summary. Shared shape used by both this supplier portal's own
// Overview page (below) and the admin dashboard's equivalent section
// (an admin picks which real supplier to view).
function SupplierAnalyticsSection({ analytics, lang, part = "all" }) {
  // An order status in the supplier's language (the order lists use the same names).
  const { t } = useLang();
  const statusName = (k) => (t && t.statusOrder && t.statusOrder[k]) || String(k).replace(/_/g, " ");
  const revenueTrend = analytics.revenueAndVolume.map((d) => ({
    d: new Date(d.day).toLocaleDateString(uiLocale(), { month: "short", day: "numeric" }),
    revenue: d.revenue,
    orders: d.orderCount,
  }));
  const l = {
    revenueTitle: lang === "zh" ? "收入趋势（近 30 天）" : "Revenue trend (last 30 days)",
    topProductsTitle: lang === "zh" ? "热销商品（按销量）" : "Top-selling products",
    statusTitle: lang === "zh" ? "订单状态分布" : "Order status breakdown",
    lowStockTitle: lang === "zh" ? "库存预警" : "Low-stock products",
    payoutTitle: lang === "zh" ? "结算汇总" : "Payout summary",
    totalPaid: lang === "zh" ? "历史已付款总额" : "Total paid out",
    amountOwed: lang === "zh" ? "当前应付金额" : "Current amount owed",
    noRevenue: lang === "zh" ? "近 30 天暂无收入数据" : "No revenue in the last 30 days.",
    noProducts: lang === "zh" ? "暂无销售数据" : "No sales data yet.",
    noLowStock: lang === "zh" ? "暂无库存预警商品" : "Nothing low on stock right now.",
    units: lang === "zh" ? "件" : "units",
  };

  return (
    <>
      {(part === "all" || part === "top" || part === "payout") && (
      <div data-testid="payout-summary" style={{ display: "flex", gap: 16, flex: 1 }}>
        <Card title={l.payoutTitle} style={{ flex: 1 }}>
          <div style={{ padding: "18px 20px", display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{l.totalPaid}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 4 }}>{cny(analytics.payoutSummary.totalPaid)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{l.amountOwed}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: analytics.payoutSummary.amountOwed > 0 ? C.gauge : C.ink, marginTop: 4 }}>{cny(analytics.payoutSummary.amountOwed)}</div>
            </div>
          </div>
        </Card>
      </div>
      )}

      {(part === "all" || part === "rest") && (
      <>
      <Card title={l.revenueTitle}>
        <div style={{ padding: "16px 18px 8px", height: 200 }}>
          {revenueTrend.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 12.5, color: C.muted }}>{l.noRevenue}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.muted }} axisLine={{ stroke: C.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v, name) => [name === "revenue" ? `¥${Number(v).toFixed(2)}` : v, name === "revenue" ? (lang === "zh" ? "收入" : "Revenue") : (lang === "zh" ? "订单" : "Orders")]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                <Bar dataKey="revenue" fill={C.signal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {part === "all" && (
      <div style={{ display: "flex", gap: 16 }}>
        <Card title={l.topProductsTitle} style={{ flex: 1 }}>
          <div style={{ padding: 6 }}>
            {analytics.topProducts.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: C.muted }}>{l.noProducts}</div>}
            {analytics.topProducts.map((p, i) => (
              <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < analytics.topProducts.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{p.unitsSold} {l.units} · {cny(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={l.statusTitle} style={{ flex: 1 }}>
          <div style={{ padding: 12 }}>
            {analytics.statusBreakdown.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: C.muted }}>{l.noProducts}</div>}
            {analytics.statusBreakdown.map((s) => {
              const total = analytics.statusBreakdown.reduce((sum, x) => sum + x.count, 0);
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              return (
                <div key={s.status} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{statusName(s.status)}</span>
                    <span style={{ color: C.muted }}>{s.count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.line, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: C.signal, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      )}

      {part === "all" && analytics.lowStockProducts.length > 0 && (
        <Card title={l.lowStockTitle}>
          <div style={{ padding: 6 }}>
            {analytics.lowStockProducts.slice(0, 8).map((p, i) => (
              <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < Math.min(analytics.lowStockProducts.length, 8) - 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: p.stockQuantity === 0 ? C.red : C.amber, fontWeight: 700 }}>{p.stockQuantity} / {p.lowStockThreshold}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      </>
      )}

      {part === "topSelling" && (
        <Card title={l.topProductsTitle} style={{ flex: 1 }}>
          <div style={{ padding: 6 }}>
            {analytics.topProducts.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: C.muted }}>{l.noProducts}</div>}
            {analytics.topProducts.map((p, i) => (
              <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < analytics.topProducts.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{p.unitsSold} {l.units} · {cny(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {part === "status" && (
        <Card title={l.statusTitle} style={{ flex: 1 }}>
          <div style={{ padding: 12 }}>
            {analytics.statusBreakdown.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: C.muted }}>{l.noProducts}</div>}
            {analytics.statusBreakdown.map((s) => {
              const total = analytics.statusBreakdown.reduce((sum, x) => sum + x.count, 0);
              const pct = total > 0 ? (s.count / total) * 100 : 0;
              return (
                <div key={s.status} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{statusName(s.status)}</span>
                    <span style={{ color: C.muted }}>{s.count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.line, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: C.signal, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {part === "lowStock" && (
        <Card title={l.lowStockTitle} style={{ flex: 1 }}>
          <div data-testid="low-stock" style={{ padding: 6 }}>
            {analytics.lowStockProducts.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: C.muted }}>{l.noLowStock}</div>}
            {analytics.lowStockProducts.slice(0, 8).map((p, i) => (
              <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < Math.min(analytics.lowStockProducts.length, 8) - 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: p.stockQuantity === 0 ? C.red : C.amber, fontWeight: 700 }}>{p.stockQuantity} / {p.lowStockThreshold}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------- RMB: the supplier portal shows the supplier's own price in yuan (¥), never dollars
const cny = (n) => `¥${Number(n).toLocaleString(uiLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- Overview: how the orders ended up (one pie chart)
const OUTCOME_TEXT = {
  en: { title: "Orders", total: "Total orders", succeeded: "Succeeded (delivered)", inProgress: "In progress", cancelled: "Refused / cancelled", returned: "Returns", empty: "No orders yet." },
  zh: { title: "订单", total: "订单总数", succeeded: "成功（已送达）", inProgress: "进行中", cancelled: "已拒绝 / 已取消", returned: "退货", empty: "暂无订单。" },
};
function OrderOutcomesCard({ outcomes, lang, style }) {
  const x = OUTCOME_TEXT[lang === "zh" ? "zh" : "en"];
  const slices = [
    { key: "succeeded", color: C.gauge }, { key: "inProgress", color: C.signal }, { key: "cancelled", color: C.red }, { key: "returned", color: C.muted },
  ];
  const total = Number(outcomes.total) || 0;
  const R = 56, CIRC = 2 * Math.PI * R;
  let used = 0;
  return (
    <Card title={x.title} style={style}>
      <div data-testid="outcomes-pie" style={{ display: "flex", alignItems: "center", gap: 28, padding: "16px 20px" }}>
        <svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label={`${x.total}: ${total}`}>
          <circle cx="70" cy="70" r={R} fill="none" stroke={C.line} strokeWidth="22" />
          {total > 0 && slices.map((s) => {
            const n = Number(outcomes[s.key]) || 0;
            if (n === 0) return null;
            const dash = (n / total) * CIRC;
            const el = <circle key={s.key} data-testid={`outcome-slice-${s.key}`} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="22" strokeDasharray={`${dash} ${CIRC - dash}`} strokeDashoffset={-used} transform="rotate(-90 70 70)" />;
            used += dash;
            return el;
          })}
          <text x="70" y="68" textAnchor="middle" data-testid="outcomes-total" style={{ fontSize: 26, fontWeight: 700, fill: C.ink }}>{total}</text>
          <text x="70" y="86" textAnchor="middle" style={{ fontSize: 10.5, fill: C.muted }}>{x.total}</text>
        </svg>
        <div style={{ flex: 1 }}>
          {total === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>{x.empty}</div>}
          {slices.map((s) => {
            const n = Number(outcomes[s.key]) || 0;
            return (
              <div key={s.key} data-testid={`outcome-${s.key}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}><i style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: s.color }} />{x[s.key]}</span>
                <b style={{ fontSize: 14 }}>{n} <span style={{ color: C.muted, fontWeight: 400, fontSize: 11.5 }}>{total > 0 ? `${Math.round((n / total) * 100)}%` : "0%"}</span></b>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Orders: a NEW order is accepted or refused (24 hours to answer)
const ANSWER_TEXT = {
  en: {
    title: "Waiting for your answer", accept: "✓ Accept order", refuse: "✕ Refuse order", back: "Back", confirm: "Refuse order",
    acceptHint: "Accept = the same steps as before: preparing, then ship to the hub. After you accept, the order can no longer be refused here.",
    left: (h) => `Please answer within ${h} hour${h === 1 ? "" : "s"}: after that Leap is told.`, overdue: "The answer was due: Leap has been told. Please answer now.",
    refuseTitle: "Refuse this order?", refuseHint: "Only your part is cancelled. The buyer is not charged for it and is offered alternatives. Choose the reason:", notePlaceholder: "Write a short note", noteLabel: "Short note (required)",
    reasons: { out_of_stock: ["Out of stock", "stock set to 0"], price_changed: ["Price changed: I can't sell at this price", "update your price afterwards"], discontinued: ["Part discontinued", "it stops being sold"], cannot_ship_in_time: ["Can't ship in time", ""], other: ["Other", ""] },
    refused: (reason) => `You refused this order${reason ? `: ${reason}` : ""}.`,
  },
  zh: {
    title: "等待您的答复", accept: "✓ 接受订单", refuse: "✕ 拒绝订单", back: "返回", confirm: "拒绝订单",
    acceptHint: "接受 = 与以前相同的步骤：备货，然后发往中转仓。接受后，此订单无法在此处再被拒绝。",
    left: (h) => `请在 ${h} 小时内答复，否则将通知 Leap。`, overdue: "答复已超时，已通知 Leap。请立即答复。",
    refuseTitle: "拒绝此订单？", refuseHint: "仅取消您的这部分。买家无需为此付款，并会获得替代商品建议。请选择原因：", notePlaceholder: "请简要说明", noteLabel: "简要说明（必填）",
    reasons: { out_of_stock: ["缺货", "库存将设为 0"], price_changed: ["价格变动：无法按此价格销售", "之后请更新价格"], discontinued: ["零件已停产", "将停止销售"], cannot_ship_in_time: ["无法按时发货", ""], other: ["其他", ""] },
    refused: (reason) => `您已拒绝此订单${reason ? `：${reason}` : ""}。`,
  },
};
function refusedText(lang, order) {
  const a = ANSWER_TEXT[lang === "zh" ? "zh" : "en"];
  const label = order.refusalReason && a.reasons[order.refusalReason] ? a.reasons[order.refusalReason][0] : "";
  return a.refused(label);
}
function AnswerBlock({ order, onUpdated }) {
  const { lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  const a = ANSWER_TEXT[lang === "zh" ? "zh" : "en"];
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hoursLeft = order.respondBy ? Math.ceil((new Date(order.respondBy).getTime() - Date.now()) / 3600000) : null;
  const run = async (call) => {
    setBusy(true);
    setError(null);
    try { onUpdated(await call()); } catch (err) { if (err instanceof SessionExpiredError) return onSessionExpired(); setError(err.message); } finally { setBusy(false); }
  };
  const canConfirm = reason && (reason !== "other" || note.trim().length >= 3);
  return (
    <div data-testid="answer-block" style={{ ...font, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, background: "#FFFBF0" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{a.title}</div>
      {hoursLeft !== null && <div data-testid="answer-deadline" style={{ fontSize: 12, color: hoursLeft <= 0 ? C.red : C.muted, marginTop: 3 }}>{hoursLeft <= 0 ? a.overdue : a.left(hoursLeft)}</div>}
      {!refusing && (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button data-testid="answer-accept" disabled={busy} onClick={() => run(() => acceptSubOrder(getStoredToken(), order.subOrderId))} style={{ ...font, flex: 1, padding: 10, borderRadius: 8, border: "none", background: busy ? "#D1D5DB" : C.gauge, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>{a.accept}</button>
            <button data-testid="answer-refuse" disabled={busy} onClick={() => setRefusing(true)} style={{ ...font, flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${C.red}`, background: "#fff", color: C.red, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{a.refuse}</button>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{a.acceptHint}</div>
        </>
      )}
      {refusing && (
        <div data-testid="refuse-dialog" role="group" aria-label={a.refuseTitle} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{a.refuseTitle}</div>
          <div style={{ fontSize: 11.5, color: C.muted, margin: "3px 0 8px", lineHeight: 1.5 }}>{a.refuseHint}</div>
          {Object.keys(a.reasons).map((key) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: reason === key ? `2px solid ${C.red}` : `1px solid ${C.line}`, borderRadius: 8, marginBottom: 6, fontSize: 12.5, cursor: "pointer", background: reason === key ? C.redBg : "#fff" }}>
              <input type="radio" name="refusal-reason" data-testid={`answer-reason-${key}`} checked={reason === key} onChange={() => setReason(key)} />
              <span style={{ flex: 1 }}>{a.reasons[key][0]}</span>
              {a.reasons[key][1] && <span style={{ color: C.muted, fontSize: 11 }}>{a.reasons[key][1]}</span>}
            </label>
          ))}
          {reason === "other" && <textarea data-testid="answer-note" aria-label={a.noteLabel} value={note} onChange={(e) => setNote(e.target.value)} placeholder={a.notePlaceholder} maxLength={300} rows={2} style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: 6 }} />}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button data-testid="answer-confirm-refuse" disabled={busy || !canConfirm} onClick={() => run(() => refuseSubOrder(getStoredToken(), order.subOrderId, { reason, note }))} style={{ ...font, padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${C.red}`, background: "#fff", color: C.red, fontSize: 12.5, fontWeight: 700, opacity: busy || !canConfirm ? 0.5 : 1, cursor: busy || !canConfirm ? "default" : "pointer" }}>{a.confirm}</button>
            <button data-testid="answer-back" disabled={busy} onClick={() => { setRefusing(false); setReason(null); setNote(""); setError(null); }} style={{ ...font, padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{a.back}</button>
          </div>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

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
  useAutoRefresh(() => fetchMyOverview(getStoredToken()).then(setIfChanged(setData)), { enabled: loadState === "ready" });

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

  const dayTrend = data.ordersByDay.map(d => ({ d: new Date(d.day).toLocaleDateString(uiLocale(), { weekday: "short" }), v: d.count }));
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
        {/* Row 1: Payout summary | Order status breakdown | Orders. Row 2: Orders per day | Recent orders | Low-stock products. On a narrow window the rows wrap. */}
        <div data-testid="overview-row-1" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            {data.analytics && <SupplierAnalyticsSection analytics={data.analytics} lang={lang} part="payout" />}
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            {data.analytics && <SupplierAnalyticsSection analytics={data.analytics} lang={lang} part="status" />}
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            {data.analytics && data.analytics.outcomes && <OrderOutcomesCard outcomes={data.analytics.outcomes} lang={lang} style={{ flex: 1 }} />}
          </div>
        </div>

        <div data-testid="overview-row-2" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Card title={l.trendTitle} style={{ flex: 1 }}>
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
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Card title={l.recentOrdersTitle} style={{ flex: 1 }}>
              <div style={{ padding: 6 }}>
                {data.recentOrders.length === 0 && <div style={{ padding: 20, textAlign: "center", ...font, fontSize: 12.5, color: C.muted }}>{l.noRecent}</div>}
                {data.recentOrders.map((o, i) => (
                  <div key={o.subOrderId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: i < data.recentOrders.length - 1 ? `1px solid ${C.line}` : "none" }}>
                    <div>
                      <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{o.orderId}</div>
                      <div style={{ ...font, fontSize: 10.5, color: C.muted, marginTop: 2 }}>{new Date(o.placedAt).toLocaleDateString(uiLocale())}</div>
                    </div>
                    <Badge label={t.statusOrder[o.status] || o.status} statusKey={o.status} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            {data.analytics && <SupplierAnalyticsSection analytics={data.analytics} lang={lang} part="lowStock" />}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <KpiCard label={l.totalOrders} value={String(data.totalOrders)} icon={ShoppingBag} accent={C.gauge} />
          <KpiCard label={l.pendingOrders} value={String(data.pendingOrders)} icon={Truck} accent={C.amber} />
          <KpiCard label={l.totalListings} value={String(data.totalListings)} icon={PackageSearch} accent={C.torque} />
          <KpiCard label={l.pendingReturns} value={String(data.pendingReturns)} icon={AlertTriangle} accent={C.red} />
        </div>

        {data.analytics && <SupplierAnalyticsSection analytics={data.analytics} lang={lang} part="rest" />}

        <div data-testid="overview-row-bottom" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          {data.analytics && <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column" }}><SupplierAnalyticsSection analytics={data.analytics} lang={lang} part="topSelling" /></div>}
          <Card title={l.topProductsTitle} style={{ flex: "1 1 340px", minWidth: 0 }}>
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

// Real, fast, in-browser video duration check -- reads a real video
// file's own metadata via a temporary <video> element, without ever
// uploading it, so an obviously-too-long video is rejected instantly
// rather than after a slow real upload. Deliberately NOT the real
// authoritative check (that's the real, server-side ffprobe check) --
// this is purely for fast real feedback, since a client-side check
// alone could always be bypassed.
function getVideoDurationClientSide(file) {
  return new Promise((resolve, reject) => {
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src);
      resolve(videoEl.duration);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(videoEl.src);
      reject(new Error(apiMessage('Could not read this video file')));
    };
    videoEl.src = URL.createObjectURL(file);
  });
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

// The supplier's product name rule, the same as the server's: the language is found from the name (Chinese characters, else Arabic letters,
// else English); each language has the admin's minimum (Settings: nameMinEn / nameMinZh / nameMinAr); every character counts; at most 100.
function supplierNameRule(name, requirements) {
  const text = String(name || '').trim();
  const lang = /[㐀-鿿豈-﫿]/.test(text) ? 'zh' : /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(text) ? 'ar' : 'en';
  const min = { zh: requirements?.nameMinZh ?? 5, ar: requirements?.nameMinAr ?? 15, en: requirements?.nameMinEn ?? 15 }[lang];
  return { lang, min, max: 100, length: text.length, ok: text.length >= min && text.length <= 100 };
}

function AddProductForm({ onCancel, onCreated, prefill, staysOpenAfterSave = false }) {
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const f = t.products.addForm;
  const font = useBodyFont();
  const inputStyle = useInputStyle();

  // Basic fields
  const [nameZh, setNameZh] = useState(prefill?.name || "");
  const [descriptionZh, setDescriptionZh] = useState(prefill?.description || "");
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [parts, setParts] = useState([]);
  const [part, setPart] = useState("");
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [oemNumber, setOemNumber] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);


  // Photos
  const [photos, setPhotos] = useState([]); // [{ url, width, height }]
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Confirmed with the person: exactly one real product video, admin-
  // configurable max duration -- checked client-side first (fast
  // feedback, no wasted upload) and server-side too (the real,
  // authoritative check, since a client-side check alone could be
  // bypassed).
  const [video, setVideo] = useState(null); // { url, durationSeconds } | null
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [requirements, setRequirements] = useState({ minPhotos: 4, photosRequired: true, videoRequired: true, maxVideoDurationSeconds: 8 });

  useEffect(() => {
    fetchProductRequirements().then(setRequirements).catch(() => {}); // non-critical -- falls back to the real defaults above
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // The vehicle picker (Brand, then Model, then Year): shared with Bulk upload. A vehicle already chosen by a buyer comes in as the starting point.
  const cascade = useVehicleCascade({ initialGenerationId: prefill?.generationId || "", initialYear: prefill?.year, onError: setError });
  const { selectedGenerationId, selectedYear } = cascade;
  const [versionChoice, setVersionChoice] = useState({ mode: "all", ids: [] });      // the optional Versions step: every version (default) or only some
  // A PART (the sub-category) whose weight and package size the admin has set supplies them: the supplier enters none, and the shipping cost uses the part's (migration 104).
  const selectedPart = parts.find((p) => p.nameEn === part);
  const partShipping = partShippingOf(selectedPart);

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

  const handleVideoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const durationSeconds = await getVideoDurationClientSide(file);
      if (durationSeconds > requirements.maxVideoDurationSeconds) {
        setError(cascadeLabel(
          `视频过长（${durationSeconds.toFixed(1)} 秒）。最长不能超过 ${requirements.maxVideoDurationSeconds} 秒。`,
          `Video is too long (${durationSeconds.toFixed(1)}s). Must be ${requirements.maxVideoDurationSeconds}s or less.`
        ));
        return;
      }
    } catch (e2) {
      setError(e2.message);
      return;
    }
    setIsUploadingVideo(true);
    try {
      const result = await uploadProductVideo(getStoredToken(), file);
      setVideo(result);
    } catch (err) {
      setError(err.message);
    }
    setIsUploadingVideo(false);
  };

  const removeVideo = () => setVideo(null);

  const handleSubmit = async () => {
    const missing = [];
    if (!nameZh.trim()) missing.push(lang === "zh" ? "商品名称" : "product name");
    if (!part.trim()) missing.push(lang === "zh" ? "部件类型" : "part");
    if (!oemNumber.trim()) missing.push(lang === "zh" ? "OEM 编号" : "OEM number");
    if (!price) missing.push(lang === "zh" ? "价格" : "price");
    if (!selectedGenerationId) missing.push(lang === "zh" ? "品牌、车型和年份" : "brand, model and year");
    else if (!selectedYear) missing.push(lang === "zh" ? "年份" : "year");
    if (versionChoice.mode === "some" && versionChoice.ids.length === 0) missing.push(lang === "zh" ? "至少一个车型版本（或选择全部版本）" : "at least one version (or choose All versions)");
    if (requirements.photosRequired && photos.length !== requirements.minPhotos) missing.push(lang === "zh" ? `${requirements.minPhotos} 张照片` : `exactly ${requirements.minPhotos} photos`);
    if (requirements.videoRequired && !video) missing.push(lang === "zh" ? "商品视频" : "product video");
    // Weight and size: set by Leap (the admin), never asked of the supplier.

    if (missing.length > 0) {
      setError((lang === "zh" ? "请填写：" : "Please fill in: ") + missing.join(lang === "zh" ? "、" : ", "));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await createProduct(getStoredToken(), {
        nameZh: nameZh.trim(),
        descriptionZh: descriptionZh.trim() || undefined,
        category,
        part: part.trim(),
        oemNumber: oemNumber.trim(),
        price: parseFloat(price),
        currencyCode: "CNY",
        stockQuantity: parseInt(stock, 10) || 0,
        fitment: {
            generationId: selectedGenerationId,
            year: parseInt(selectedYear, 10),
            versionIds: versionChoice.mode === "some" ? versionChoice.ids : undefined,      // only some versions of the car (none: every version)
          },
        images: photos.map((p) => p.url),
        videoUrl: video?.url || undefined,
        // weight and size: set by Leap (the admin); the supplier sends none
        fulfillsRequestItemId: prefill?.fulfillsRequestItemId || undefined,
      });
      if (staysOpenAfterSave) {
        // Real, confirmed with the person: reset every real field
        // except the real fitment cascade -- a supplier listing many
        // real parts for the same real car shouldn't have to re-pick
        // brand, model and year every
        // single time, only until they themselves change it.
        setNameZh(""); setDescriptionZh("");
        setOemNumber(""); setPrice(""); setStock("");
        setWeightKg(""); setLengthCm(""); setWidthCm(""); setHeightCm("");
        setPhotos([]);
        setVideo(null);
        setPart(parts.length > 0 ? parts[0].nameEn : "");
        setIsSubmitting(false);
        setSaveSuccess(true);
        onCreated();
      } else {
        onCreated();
      }
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

        {saveSuccess && (
          <div style={{ ...font, padding: "10px 14px", borderRadius: 8, background: "#EAF7EE", border: "1px solid #B7E4C4", color: "#1E7A34", fontSize: 13, fontWeight: 600 }}>
            {f.savedKeepFitment}
          </div>
        )}

        {/* ---- Vehicle Fitment ---- */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
          <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 14 }}>
            {cascadeLabel("适配车型", "Vehicle Fitment")}
          </div>
          {prefill?.generationId ? (
            <>
              <div style={{ ...font, fontSize: 13, color: C.ink, background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
                {prefill.vehicleLabel} <span style={{ color: C.muted, fontSize: 11.5 }}>({cascadeLabel("已由买家选定，不可更改", "already chosen by the buyer, can't be changed")})</span>
              </div>
              <div style={{ marginTop: 14 }}><VersionsStep generationId={selectedGenerationId} year={selectedYear} value={versionChoice} onChange={setVersionChoice} /></div>
            </>
          ) : (
          <VehiclePicker cascade={cascade}>
            <VersionsStep generationId={selectedGenerationId} year={selectedYear} value={versionChoice} onChange={setVersionChoice} />
          </VehiclePicker>
          )}
        </div>

        {/* ---- Product Details ---- */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
          <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 14 }}>
            {cascadeLabel("商品详情", "Product Details")}
          </div>
          {/* Line 1: name, category, part. Line 2: OEM, price, stock. Beside them: the 320 x 320 Weight and size box (as the car photo above). */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 28, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignContent: "start", minWidth: 0 }}>
              <Field label={cascadeLabel("商品名称（中文）", "Product name (Chinese)")}>
                <input style={inputStyle} placeholder="例如：前刹车盘 300mm" value={nameZh} onChange={(e) => setNameZh(e.target.value)} maxLength={100} />
                {(() => { const rule = supplierNameRule(nameZh, requirements); return <div data-testid="name-counter" style={{ fontSize: 10.5, color: nameZh.length > 0 && !rule.ok ? C.red : C.muted, marginTop: 2 }}>{rule.length}/100 ({cascadeLabel(`至少 ${rule.min}`, `min ${rule.min}`)}, {cascadeLabel({ zh: "中文", en: "英文", ar: "阿拉伯文" }[rule.lang], { zh: "Chinese", en: "English", ar: "Arabic" }[rule.lang])})</div>; })()}
              </Field>
              <Field label={cascadeLabel("类别", "Category")}>
                <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map(c => <option key={c.id} value={c.id}>{lang === "zh" ? c.nameZh || c.nameEn : c.nameEn}</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel("部件类型", "Part Class.")}>
                <select style={selectStyle} value={part} onChange={(e) => setPart(e.target.value)} disabled={isLoadingParts || parts.length === 0}>
                  {isLoadingParts && <option>{cascadeLabel("加载中…", "Loading…")}</option>}
                  {!isLoadingParts && parts.length === 0 && <option>{cascadeLabel("此类别暂无部件", "No parts yet for this category")}</option>}
                  {!isLoadingParts && parts.map(p => <option key={p.id} value={p.nameEn}>{lang === "zh" ? p.nameZh || p.nameEn : p.nameEn}</option>)}
                </select>
              </Field>
              <Field label={cascadeLabel("OEM 编号", "OEM Number")}>
                <input style={inputStyle} placeholder={cascadeLabel("例如：34116792217", "e.g. 34116792217")} value={oemNumber} onChange={(e) => setOemNumber(e.target.value)} />
              </Field>
              <Field label={cascadeLabel("价格 (¥ 人民币)", "Price (¥ RMB)")}>
                <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
              <Field label={cascadeLabel("库存数量", "Stock quantity")}>
                <input type="number" style={inputStyle} placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
              </Field>
          </div>
          <div data-testid="weight-size-square" style={{ width: 320, height: 320, maxWidth: "100%" }}>
            {partShipping ? (
              <PartShippingBlock part={selectedPart} shipping={partShipping} square />
            ) : (
              <div data-testid="weight-size-by-leap" style={{ width: "100%", height: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 10, background: "#F9FAFB", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{cascadeLabel("重量和尺寸", "Weight and size")}</div>
                <div style={{ ...font, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>{cascadeLabel("由 Leap 设置，您无需填写。", "Set by Leap. You don't need to enter them.")}</div>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Photos left, video right, on one line (they stack on a narrow window). */}
        <div data-testid="photos-video-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          {/* ---- Product Photos ---- */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, flex: "1 1 380px", minWidth: 0 }}>
            <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              {cascadeLabel(
                `商品照片（${requirements.minPhotos} 张${requirements.photosRequired ? "，必填" : "，选填"}，高清）`,
                `Product Photos (${requirements.minPhotos}${requirements.photosRequired ? ", required" : ", optional"}, high resolution)`
              )}
            </div>
            <div style={{ ...font, fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {cascadeLabel("最短边至少 800 像素。", "Shortest side must be at least 800px.")}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {Array.from({ length: requirements.minPhotos }, (_, i) => i).map((i) => {
                const p = photos[i];
                if (p) {
                  return (
                    <div key={p.url} style={{ position: "relative", width: 84, height: 84 }}>
                      <img src={`${API_BASE_URL}${p.url}`} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                      <button
                        onClick={() => removePhoto(p.url)}
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.red, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                }
                return (
                  <label key={i} style={{
                    width: 84, height: 84, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: C.muted,
                  }}>
                    {isUploadingPhoto ? <span style={{ fontSize: 11 }}>...</span> : <ImagePlus size={20} />}
                    <span style={{ fontSize: 10 }}>{cascadeLabel("添加", "Add")}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handlePhotoSelect} disabled={isUploadingPhoto} />
                  </label>
                );
              })}
            </div>
          </div>

          {/* ---- Product Video ---- */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, flex: "1 1 380px", minWidth: 0 }}>
            <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              {cascadeLabel(
                `商品视频（${requirements.videoRequired ? "必填" : "选填"}，最长 ${requirements.maxVideoDurationSeconds} 秒）`,
                `Product Video (${requirements.videoRequired ? "required" : "optional"}, max ${requirements.maxVideoDurationSeconds}s)`
              )}
            </div>
            <div style={{ ...font, fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {cascadeLabel("视频过长将被拒绝上传。", "A video longer than the limit will be rejected.")}
            </div>
            {video ? (
              <div style={{ position: "relative", width: 160, height: 120 }}>
                <video src={`${API_BASE_URL}${video.url}`} controls style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                <button
                  onClick={removeVideo}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.red, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label style={{
                width: 160, height: 120, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: C.muted,
              }}>
                {isUploadingVideo ? <span style={{ fontSize: 11 }}>...</span> : <Video size={22} />}
                <span style={{ fontSize: 10 }}>{cascadeLabel("添加视频", "Add video")}</span>
                <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: "none" }} onChange={handleVideoSelect} disabled={isUploadingVideo} />
              </label>
            )}
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

const BULK_TEMPLATE_HEADERS = ['OE Number / OE编号', 'Item Name / 商品名称', 'Price (RMB) / 价格（人民币）'];

// The bulk upload template: THREE columns only (OE Number, Item Name, Price in RMB). The category and part class are found from the
// item name; the vehicle (and its versions) is chosen once for the whole file; photos and video are added row by row after the
// file is read (they never go in the sheet).
async function downloadBulkTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.addRow(BULK_TEMPLATE_HEADERS);
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } }; });
  sheet.addRow(['34116792217', '前刹车盘 300mm', 200]);
  sheet.columns = [{ width: 20 }, { width: 36 }, { width: 14 }];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
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
    else if (h.includes('item name') || h.includes('name') || h.includes('名称')) columnIndex.itemName = colNumber;
    else if (h.includes('price') || h.includes('价格')) columnIndex.price = colNumber;
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

// "34116792217-2.jpg" -> { key: "34116792217", n: 2, kind: "image" }; "34116792217.mp4" -> { key, n: 0, kind: "video" }; anything else -> null.
function bulkMediaFileInfo(fileName) {
  const m = /^(.*)\.([a-z0-9]+)$/i.exec(String(fileName || ''));
  if (!m) return null;
  const ext = m[2].toLowerCase();
  const kind = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'image' : ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : null;
  if (!kind) return null;
  const parts = /^(.*?)(?:[-_ ](\d{1,2}))?$/.exec(m[1].trim());
  return { key: bulkOeKey(parts[1]), n: parts[2] ? Number(parts[2]) : 0, kind };
}
const bulkOeKey = (s) => String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');

function BulkUploadPanel({ onCancel, onImported }) {
  const { t, lang } = useLang();
  const b = t.products.bulk;
  const font = useBodyFont();
  const L = (zh, en) => (lang === 'zh' ? zh : en);

  const [step, setStep] = useState('setup'); // 'setup' | 'preview' | 'results'
  const [nameLanguage, setNameLanguage] = useState('zh');
  const [error, setError] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rows, setRows] = useState([]);          // { oemNumber, itemName, price, category, part, match, images: [url], video: {url}|null, busy, rowError }
  const [catalog, setCatalog] = useState([]);    // [{ id, nameEn, nameZh, parts: [{ nameEn, nameZh, hasShipping }] }]
  const [unplaced, setUnplaced] = useState([]);  // file names that matched no row
  const [results, setResults] = useState(null);
  const [requirements, setRequirements] = useState({ minPhotos: 4, photosRequired: true, videoRequired: true, maxVideoDurationSeconds: 8 });
  const [versionChoice, setVersionChoice] = useState({ mode: 'all', ids: [] });

  // The vehicle (Brand, Model, Year, then its versions): the same as the single-product form; it applies to every row.
  const cascade = useVehicleCascade({ onError: setError });
  const { selectedGenerationId, selectedYear } = cascade;
  useEffect(() => { fetchProductRequirements().then(setRequirements).catch(() => {}); }, []);

  const updateRow = (i, patch) => setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)));
  const catName = (c) => (lang === 'zh' ? c.nameZh || c.nameEn : c.nameEn);
  const partsOf = (categoryId) => (catalog.find((c) => c.id === categoryId) || { parts: [] }).parts;
  const partInfo = (r) => partsOf(r.category).find((p) => p.nameEn === r.part) || null;
  const photosOk = (r) => (requirements.photosRequired ? r.images.length === requirements.minPhotos : true);
  const videoOk = (r) => !requirements.videoRequired || Boolean(r.video);
  // What the row will become: the server decides in the end (weight and size are set by Leap, never asked of the supplier).
  const rowState = (r) => {
    if (r.repeatOf !== null && r.repeatOf !== undefined) return 'repeated';   // skipped: the first row with this OE number counts
    if (r.exists) return 'update';                                           // updates the price of the supplier's product with this OE number
    if (!r.category || !r.part) return 'choose';
    if (!photosOk(r)) return 'photos';
    if (!videoOk(r)) return 'video';
    return 'ready';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setIsParsing(true);
    try {
      const items = await parseBulkUploadFile(file);
      if (items.length === 0) {
        setError(L('未能在此文件中识别出任何商品行。', "Couldn't recognize any product rows in this file."));
        return;
      }
      let found = { catalog: [], results: [] };
      const batchCar = { generationId: selectedGenerationId, year: Number(selectedYear), ...(versionChoice.mode === 'some' ? { versionIds: versionChoice.ids } : {}) };
      try { found = await matchBulkItemNames(getStoredToken(), items.map((it) => it.itemName), items.map((it) => it.oemNumber), batchCar); }
      catch (err) { if (err instanceof SessionExpiredError) throw err; setError(L('无法根据名称识别分类，请逐行选择。', 'The category could not be found from the names; choose it on each row.')); }
      setCatalog(found.catalog || []);
      // An OE number the supplier already has updates that product's price; the same OE number again in this file is skipped (only its first row counts).
      const haveOe = new Set(found.existingOemNumbers || []);
      const firstRowOf = new Map();
      items.forEach((it, i) => { const k = String(it.oemNumber ?? '').trim().toUpperCase(); if (k && !firstRowOf.has(k)) firstRowOf.set(k, i); });
      setRows(items.map((it, i) => {
        const m = (found.results || [])[i] || { state: 'none' };
        const k = String(it.oemNumber ?? '').trim().toUpperCase();
        const first = firstRowOf.get(k);
        return { exists: Boolean(k) && haveOe.has(k), repeatOf: k && first !== i ? first : null, oemNumber: it.oemNumber, itemName: it.itemName, price: it.price, category: m.category || '', part: m.part || '', match: m.state || 'none', candidates: m.candidates || [], images: [], video: null, busy: 0, rowError: null };
      }));
      setUnplaced([]);
      setStep('preview');
    } catch (err) {
      setError(L('无法读取此文件，请确认它是有效的 .xlsx 文件。', "Couldn't read this file — make sure it's a valid .xlsx file."));
    } finally {
      setIsParsing(false);
    }
  };

  // One photo or one video for one row (the same checks as for one product: the server checks the photo; the video's length is checked here first).
  const uploadToRow = async (i, file, kind) => {
    updateRow(i, (r) => ({ busy: r.busy + 1, rowError: null }));
    try {
      if (kind === 'video') {
        const seconds = await getVideoDurationClientSide(file);
        if (seconds > requirements.maxVideoDurationSeconds) throw new Error(L(`视频过长（${seconds.toFixed(1)} 秒），最长 ${requirements.maxVideoDurationSeconds} 秒`, `Video too long (${seconds.toFixed(1)}s), max ${requirements.maxVideoDurationSeconds}s`));
        const result = await uploadProductVideo(getStoredToken(), file);
        updateRow(i, { video: result });
      } else {
        const result = await uploadProductImage(getStoredToken(), file);
        updateRow(i, (r) => ({ images: r.images.length < requirements.minPhotos ? [...r.images, result.url] : r.images }));
      }
    } catch (err) {
      updateRow(i, { rowError: `${file.name}: ${err.message}` });
    } finally {
      updateRow(i, (r) => ({ busy: r.busy - 1 }));
    }
  };
  const handleRowFiles = async (i, e, kind) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) await uploadToRow(i, f, kind);   // one at a time, in order
  };

  // Many files at once, each to the row of its OE number ("34116792217-1.jpg", "34116792217.mp4").
  const handleBulkMedia = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const byKey = new Map(rows.map((r, i) => [bulkOeKey(r.oemNumber), i]));
    const jobs = [];
    const notPlaced = [];
    for (const f of files) {
      const info = bulkMediaFileInfo(f.name);
      const i = info ? byKey.get(info.key) : undefined;
      if (i === undefined) notPlaced.push(f.name); else jobs.push({ i, f, info });
    }
    setUnplaced(notPlaced);
    jobs.sort((x, y) => x.i - y.i || x.info.n - y.info.n);
    for (const j of jobs) await uploadToRow(j.i, j.f, j.info.kind);
  };

  const handleSubmitImport = async () => {
    if (!selectedGenerationId || !selectedYear) { setError(L('请先选择适配车型', 'Choose the vehicle this batch is for first.')); return; }
    if (versionChoice.mode === 'some' && versionChoice.ids.length === 0) { setError(L('请至少选择一个版本，或选择"所有版本"', 'Tick at least one version, or choose "All versions".')); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const fitment = { generationId: selectedGenerationId, year: Number(selectedYear), ...(versionChoice.mode === 'some' ? { versionIds: versionChoice.ids } : {}) };
      const data = await bulkImportProducts(getStoredToken(), {
        fitment,
        nameLanguage,
        items: rows.map((r) => ({ oemNumber: r.oemNumber, itemName: r.itemName, price: r.price, category: r.category || undefined, part: r.part || undefined, images: r.images, videoUrl: r.video ? r.video.url : null })),
      });
      setResults(data.results);
      setStep('results');
      onImported?.();
    } catch (err) {
      if (err instanceof SessionExpiredError) { setError(err.message); return; }
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeButton = <button onClick={onCancel} aria-label={L('关闭', 'Close')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color={C.muted} /></button>;
  const chip = (text, color, bg) => <span style={{ ...font, fontSize: 11.5, fontWeight: 700, color, background: bg, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{text}</span>;
  const GREEN = ['#127A4B', '#E6F5EE'];
  const AMBER = ['#8A5A12', '#FDF3E1'];
  const nameRuleText = (r) => {
    const rule = supplierNameRule(r.itemName, requirements);
    return rule.length > rule.max ? L(`名称过长：最多 ${rule.max} 个字符（现有 ${rule.length}），仍会导入`, `Name too long: at most ${rule.max} characters (has ${rule.length}), still imported`)
      : L(`名称过短：至少 ${rule.min} 个字符（现有 ${rule.length}），仍会导入`, `Name too short: at least ${rule.min} characters (has ${rule.length}), still imported`);
  };
  const missingText = (m) => ({ category: L('分类', 'category'), part: L('部件', 'part'), dimensions: L('重量和尺寸', 'weight and size'), photos: L('照片', 'photos'), video: L('视频', 'video'), position: L('位置', 'position') }[m] || m);

  if (step === 'results') {
    const ok = results.filter((r) => r.success);
    const review = ok.filter((r) => r.status === 'translating').length;
    const updated = ok.filter((r) => r.status === 'updated').length;
    const drafts = ok.length - review - updated;
    const skipped = results.filter((r) => r.repeated).length;
    const failed = results.length - ok.length - skipped;
    return (
      <Card title={b.title} action={closeButton}>
        <div style={{ padding: 20 }}>
          <div data-testid="bulk-results-summary" style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
            {L(`导入完成：${review} 件已提交审核，${drafts} 件为草稿`, `Import complete: ${review} sent for review, ${drafts} saved as drafts`)}{updated > 0 && L(`，${updated} 件已更新价格`, `, ${updated} prices updated`)}{skipped > 0 && L(`，${skipped} 件重复已跳过`, `, ${skipped} repeated rows skipped`)}{failed > 0 && L(`，${failed} 件失败`, `, ${failed} failed`)}
          </div>
          {drafts > 0 && <div style={{ ...font, fontSize: 12.5, color: C.muted, marginBottom: 14 }}>{L('草稿请前往"我的草稿（未发布）"补全缺少的内容。', 'Finish the drafts in My Drafts (Not published): each one says what it still needs.')}</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th>{L('行', 'Row')}</Th><Th>OE Number</Th><Th>{L('名称', 'Name')}</Th><Th align="right">{L('价格 (¥)', 'Price (¥)')}</Th><Th>{L('状态', 'Status')}</Th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.index}>
                  <Td>{r.index + 1}</Td>
                  <Td>{rows[r.index]?.oemNumber}</Td>
                  <Td>{rows[r.index]?.itemName}</Td>
                  <Td align="right">{rows[r.index]?.price ?? '—'}</Td>
                  <Td>{!r.success ? (r.repeated ? chip(L('文件中重复：已跳过', 'Repeated in this file: skipped'), C.muted, '#EEF0F3') : <span style={{ ...font, color: C.red, fontSize: 12 }}>{apiMessage(r.error)}</span>)
                    : r.status === 'updated' ? chip(L('已更新价格', 'Price updated'), '#1D4E89', '#E5EEF9')
                    : r.status === 'translating' ? chip(L('已提交审核', 'Sent for review'), ...GREEN)
                    : chip(L(`草稿：缺少 ${(r.missing || []).map(missingText).join('、')}`, `Draft: needs ${(r.missing || []).map(missingText).join(', ')}`), ...AMBER)}
                    {r.success && r.nameWarning && <div style={{ ...font, fontSize: 11, color: '#8A5A12', marginTop: 4 }}>{L('名称不符合字数要求', 'Name outside the length rule')}</div>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={onCancel} style={{ ...font, marginTop: 16, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.signal, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {L('完成', 'Done')}
          </button>
        </div>
      </Card>
    );
  }

  const selectStyle = { ...font, width: '100%', border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, background: '#fff', boxSizing: 'border-box' };
  const box = { border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 16 };
  const slot = { width: 38, height: 38, borderRadius: 6, border: `1.5px dashed ${C.line}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.muted, cursor: 'pointer', flex: 'none' };
  const busyAny = rows.some((r) => r.busy > 0);
  const counts = rows.reduce((acc, r) => { const s = rowState(r); acc[s] = (acc[s] || 0) + 1; acc[r.match] = (acc[r.match] || 0) + 1; return acc; }, {});

  return (
    <Card title={b.title} action={closeButton}>
      <div style={{ padding: 20 }}>
        {error && <div role="alert" style={{ ...font, fontSize: 12, color: C.red, background: '#FBE7E5', borderRadius: 8, padding: 10, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.canvas, borderRadius: 10, marginBottom: 16 }}>
          <FileSpreadsheet size={22} color={C.torque} />
          <div style={{ flex: 1 }}>
            <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{L('Excel 模板：3 列', 'Excel template: 3 columns')}</div>
            <div style={{ ...font, fontSize: 11.5, color: C.muted }}>{L('OE 编号 · 商品名称 · 价格（人民币）。分类和部件类型将根据商品名称自动识别。', 'OE Number · Item Name · Price (RMB). The category and part class are found from the item name.')}</div>
          </div>
          <button onClick={downloadBulkTemplate} style={{ ...font, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            <Download size={13} /> {b.download}
          </button>
        </div>

        {step === 'setup' && (
          <>
            <div style={box}>
              <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 14 }}>{L('这批商品适配的车型', 'Vehicle this batch is for')}</div>
              <VehiclePicker cascade={cascade} idPrefix="bulk">
                <VersionsStep generationId={selectedGenerationId} year={selectedYear} value={versionChoice} onChange={setVersionChoice} />
              </VehiclePicker>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{L('商品名称语言', 'Item name language')}</span>
              <label style={{ ...font, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input type="radio" checked={nameLanguage === 'zh'} onChange={() => setNameLanguage('zh')} /> {L('中文', 'Chinese')}
              </label>
              <label style={{ ...font, display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input type="radio" checked={nameLanguage === 'en'} onChange={() => setNameLanguage('en')} /> {L('英文', 'English')}
              </label>
            </div>

            <label style={{ display: 'block', border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 28, textAlign: 'center', color: C.muted, cursor: selectedGenerationId && selectedYear ? 'pointer' : 'default', opacity: selectedGenerationId && selectedYear ? 1 : 0.5 }}>
              <Upload size={22} style={{ marginBottom: 8 }} />
              <div style={{ ...font, fontSize: 12.5 }}>{isParsing ? L('正在读取文件…', 'Reading file…') : b.dropHint}</div>
              <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileSelect} disabled={!selectedGenerationId || !selectedYear || isParsing} />
            </label>
          </>
        )}

        {step === 'preview' && (
          <div style={box}>
            <div style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10 }}>{L('导入前请检查每一行', 'Check the rows before importing')}</div>
            <div data-testid="bulk-counts" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {chip(L(`${rows.length} 行`, `${rows.length} rows`), C.ink, '#EEF0F3')}
              {chip(L(`${counts.found || 0} 行已根据名称识别`, `${counts.found || 0} found from the name`), ...GREEN)}
              {(counts.choose || 0) > 0 && chip(L(`${counts.choose} 行需要选择`, `${counts.choose} need a choice`), ...AMBER)}
              {rows.filter((r) => !supplierNameRule(r.itemName, requirements).ok).length > 0 && chip(L(`${rows.filter((r) => !supplierNameRule(r.itemName, requirements).ok).length} 行名称不符合字数要求（仍会导入）`, `${rows.filter((r) => !supplierNameRule(r.itemName, requirements).ok).length} names outside the length rule (still imported)`), ...AMBER)}
              {chip(L(`${counts.ready || 0} 行可提交审核`, `${counts.ready || 0} ready for review`), ...GREEN)}
              {(counts.update || 0) > 0 && chip(L(`${counts.update} 行此车型已有此 OE 编号（更新价格）`, `${counts.update} already yours for this car (price updated)`), '#1D4E89', '#E5EEF9')}
              {(counts.repeated || 0) > 0 && chip(L(`${counts.repeated} 行在文件中重复（跳过）`, `${counts.repeated} repeated in this file (skipped)`), C.muted, '#EEF0F3')}
              {rows.length - (counts.ready || 0) - (counts.update || 0) - (counts.repeated || 0) > 0 && chip(L(`${rows.length - (counts.ready || 0) - (counts.update || 0) - (counts.repeated || 0)} 行将成为草稿`, `${rows.length - (counts.ready || 0) - (counts.update || 0) - (counts.repeated || 0)} will be drafts`), ...AMBER)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px dashed #9DB4D6', background: '#F4F8FD', borderRadius: 10, padding: '12px 14px', marginBottom: 12, flexWrap: 'wrap' }}>
              <ImagePlus size={22} color={C.torque} />
              <div style={{ flex: '1 1 300px' }}>
                <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink }}>{L('一次为多行添加照片和视频', 'Add photos and videos for many rows at once')}</div>
                <div style={{ ...font, fontSize: 11.5, color: C.muted }}>{L('按 OE 编号命名文件：34116792217-1.jpg、34116792217-2.jpg、34116792217.mp4。每个文件会放到对应的行。', 'Name each file by its OE number: 34116792217-1.jpg, 34116792217-2.jpg, 34116792217.mp4. Each file goes to its row.')}</div>
              </div>
              <label style={{ ...font, padding: '8px 14px', borderRadius: 8, border: '1px solid #9DB4D6', background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {L('选择文件', 'Choose files')}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} onChange={handleBulkMedia} data-testid="bulk-media-input" />
              </label>
            </div>
            {unplaced.length > 0 && (
              <div data-testid="bulk-unplaced" style={{ ...font, fontSize: 12, color: '#8A5A12', background: '#FDF3E1', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                {L('这些文件没有对应的 OE 编号，请在对应行手动添加：', 'These files match no OE number; add them on their row by hand: ')}{unplaced.join(', ')}
              </div>
            )}

            <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <Th>OE Number</Th><Th>{L('商品名称', 'Item Name')}</Th><Th align="right">{L('价格 (¥)', 'Price (¥)')}</Th>
                  <Th>{L('分类', 'Category')}</Th><Th>{L('部件类型', 'Part class')}</Th>
                  <Th>{L(`照片（${requirements.minPhotos}${requirements.photosRequired ? '，必填' : '，选填'}）`, `Photos (${requirements.minPhotos}, ${requirements.photosRequired ? 'required' : 'optional'})`)}</Th>
                  <Th>{L(`视频（${requirements.videoRequired ? '必填' : '选填'}）`, `Video (${requirements.videoRequired ? 'required' : 'optional'})`)}</Th>
                  <Th></Th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const state = rowState(r);
                    const needsChoice = !r.category || !r.part;
                    const warn = needsChoice ? { border: '1.5px solid #B26A00' } : {};
                    return (
                      <tr key={i} data-testid={`bulk-row-${i}`}>
                        <Td>{r.oemNumber || <span style={{ color: C.red }}>{L('缺失', 'missing')}</span>}</Td>
                        <Td>{r.itemName || <span style={{ color: C.red }}>{L('缺失', 'missing')}</span>}</Td>
                        <Td align="right">{r.price ?? <span style={{ color: C.red }}>{L('缺失', 'missing')}</span>}</Td>
                        <Td style={{ minWidth: 130 }}>
                          <select aria-label={L(`第 ${i + 1} 行分类`, `Category of row ${i + 1}`)} style={{ ...selectStyle, ...warn }} value={r.category} onChange={(e) => updateRow(i, { category: e.target.value, part: '', match: 'chosen' })}>
                            <option value="">{L('请选择…', 'Choose…')}</option>
                            {catalog.map((c) => <option key={c.id} value={c.id}>{catName(c)}</option>)}
                          </select>
                        </Td>
                        <Td style={{ minWidth: 160 }}>
                          <select aria-label={L(`第 ${i + 1} 行部件类型`, `Part class of row ${i + 1}`)} style={{ ...selectStyle, ...warn }} value={r.part} onChange={(e) => updateRow(i, { part: e.target.value, match: 'chosen' })} disabled={!r.category}>
                            <option value="">{L('请选择…', 'Choose…')}</option>
                            {partsOf(r.category).map((p) => <option key={p.nameEn} value={p.nameEn}>{lang === 'zh' ? p.nameZh || p.nameEn : p.nameEn}</option>)}
                          </select>
                        </Td>
                        <Td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {Array.from({ length: requirements.minPhotos }, (_, k) => k).map((k) => (r.images[k] ? (
                              <div key={k} style={{ position: 'relative', width: 38, height: 38, flex: 'none' }}>
                                <img src={`${API_BASE_URL}${r.images[k]}`} alt="" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.line}` }} />
                                <button aria-label={L('删除照片', 'Remove photo')} onClick={() => updateRow(i, (row) => ({ images: row.images.filter((_, x) => x !== k) }))} style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
                              </div>
                            ) : (
                              <label key={k} style={slot} aria-label={L(`第 ${i + 1} 行添加照片`, `Add a photo to row ${i + 1}`)}>
                                {r.busy > 0 && k === r.images.length ? <span style={{ fontSize: 10 }}>…</span> : <Plus size={14} />}
                                <input type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => handleRowFiles(i, e, 'image')} />
                              </label>
                            )))}
                          </div>
                        </Td>
                        <Td>
                          {r.video ? (
                            <div style={{ position: 'relative', width: 52, height: 38 }}>
                              <div style={{ width: 52, height: 38, borderRadius: 6, background: '#C9D6E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Video size={14} color={C.ink} /></div>
                              <button aria-label={L('删除视频', 'Remove video')} onClick={() => updateRow(i, { video: null })} style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
                            </div>
                          ) : (
                            <label style={{ ...slot, width: 52 }} aria-label={L(`第 ${i + 1} 行添加视频`, `Add a video to row ${i + 1}`)}>
                              <Video size={14} />
                              <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} onChange={(e) => handleRowFiles(i, e, 'video')} />
                            </label>
                          )}
                        </Td>
                        <Td>
                          {state === 'repeated' ? chip(L(`与第 ${r.repeatOf + 1} 行 OE 编号重复：跳过`, `Repeated in this file (row ${r.repeatOf + 1}): skipped`), C.muted, '#EEF0F3')
                            : state === 'update' ? chip(L('此车型已有此 OE 编号：将更新价格', 'Already yours for this car: price will be updated'), '#1D4E89', '#E5EEF9')
                            : state === 'ready' ? chip(L('可提交审核', 'Ready: goes to review'), ...GREEN)
                            : state === 'choose' ? chip(r.match === 'many' ? L(`${r.candidates.length} 个可能：请选择`, `${r.candidates.length} possible: choose`) : L('未识别：请选择', 'Not found: choose'), ...AMBER)
                            : chip(L(`草稿：缺少${missingText(state)}`, `Draft: ${missingText(state)} missing`), ...AMBER)}
                          {!supplierNameRule(r.itemName, requirements).ok && <div data-testid={`bulk-name-warning-${i}`} style={{ ...font, fontSize: 11, color: '#8A5A12', marginTop: 4, maxWidth: 240 }}>{nameRuleText(r)}</div>}
                          {r.rowError && <div style={{ ...font, fontSize: 11, color: C.red, marginTop: 4, maxWidth: 220 }}>{r.rowError}</div>}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 10 }}>
              {L('每一行都可以在这里修改。信息完整的行将直接提交审核；缺少内容的行会保存为草稿，并在"我的草稿（未发布）"中提示补全。', 'Every row can be changed here. A row with everything goes straight to review; a row still missing something is imported as a draft with what it has, and asks for the rest in My Drafts (Not published).')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setStep('setup')} style={{ ...font, padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {L('返回', 'Back')}
              </button>
              <button disabled={isSubmitting || busyAny} onClick={handleSubmitImport} style={{ ...font, padding: '9px 16px', borderRadius: 8, border: 'none', background: isSubmitting || busyAny ? '#D1D5DB' : C.signal, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: isSubmitting || busyAny ? 'not-allowed' : 'pointer' }}>
                {isSubmitting ? L('导入中…', 'Importing…') : busyAny ? L('正在上传…', 'Uploading…') : L(`导入 ${rows.length} 项`, `Import ${rows.length} items`)}
              </button>
            </div>
          </div>
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

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(draft.category || '');
  const [parts, setParts] = useState([]);
  const [part, setPart] = useState(draft.part || '');
  // Weight and size: set by Leap (the admin), never asked of the supplier.
  const [photos, setPhotos] = useState(draft.images ? draft.images.map((url) => ({ url })) : []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [video, setVideo] = useState(draft.videoUrl ? { url: draft.videoUrl } : null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [requirements, setRequirements] = useState({ minPhotos: 4, photosRequired: true, videoRequired: true, maxVideoDurationSeconds: 8 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProductRequirements().then(setRequirements).catch(() => {}); // non-critical -- falls back to the real defaults above
  }, []);

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

  const handleVideoSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const durationSeconds = await getVideoDurationClientSide(file);
      if (durationSeconds > requirements.maxVideoDurationSeconds) {
        setError(cascadeLabel(
          `视频过长（${durationSeconds.toFixed(1)} 秒）。最长不能超过 ${requirements.maxVideoDurationSeconds} 秒。`,
          `Video is too long (${durationSeconds.toFixed(1)}s). Must be ${requirements.maxVideoDurationSeconds}s or less.`
        ));
        return;
      }
    } catch (e2) {
      setError(e2.message);
      return;
    }
    setIsUploadingVideo(true);
    try {
      const result = await uploadProductVideo(getStoredToken(), file);
      setVideo(result);
    } catch (err) {
      setError(err.message);
    }
    setIsUploadingVideo(false);
  };

  const removeVideo = () => setVideo(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await completeDraftProduct(getStoredToken(), draft.id, {
        category: needsCategory ? category : undefined,
        part: needsCategory ? part : undefined,
        images: photos.map((p) => p.url),
        videoUrl: video?.url || undefined,
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
          {draft.oemNumber} · ¥{Number(draft.price).toFixed(2)}
        </div>

        {needsCategory && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={cascadeLabel('分类', 'Category')}>
              <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{lang === "zh" ? c.nameZh || c.nameEn : c.nameEn}</option>)}
              </select>
            </Field>
            <Field label={cascadeLabel('部件', 'Part Class.')}>
              <select style={selectStyle} value={part} onChange={(e) => setPart(e.target.value)} disabled={parts.length === 0}>
                {parts.map((p) => <option key={p.nameEn} value={p.nameEn}>{lang === "zh" ? p.nameZh || p.nameEn : p.nameEn}</option>)}
              </select>
            </Field>
          </div>
        )}

        {/* Position: not required any more (not asked). */}
        <div>
          <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            {cascadeLabel(
              `商品照片（${requirements.minPhotos} 张${requirements.photosRequired ? "，必填" : "，选填"}）`,
              `Product photos (${requirements.minPhotos}${requirements.photosRequired ? ", required" : ", optional"})`
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Array.from({ length: requirements.minPhotos }, (_, i) => i).map((i) => {
              const p = photos[i];
              if (p) {
                return (
                  <div key={p.url} style={{ position: 'relative', width: 84, height: 84 }}>
                    <img src={`${API_BASE_URL}${p.url}`} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.line}` }} />
                    <button onClick={() => removePhoto(p.url)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              }
              return (
                <label key={i} style={{ width: 84, height: 84, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: C.muted }}>
                  {isUploadingPhoto ? <span style={{ fontSize: 11 }}>...</span> : <ImagePlus size={20} />}
                  <span style={{ fontSize: 10 }}>{cascadeLabel('添加', 'Add')}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} disabled={isUploadingPhoto} />
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ ...font, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            {cascadeLabel(
              `商品视频（${requirements.videoRequired ? "必填" : "选填"}，最长 ${requirements.maxVideoDurationSeconds} 秒）`,
              `Product video (${requirements.videoRequired ? "required" : "optional"}, max ${requirements.maxVideoDurationSeconds}s)`
            )}
          </div>
          {video ? (
            <div style={{ position: 'relative', width: 160, height: 120 }}>
              <video src={`${API_BASE_URL}${video.url}`} controls style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.line}` }} />
              <button onClick={removeVideo} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <label style={{ width: 160, height: 120, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: C.muted }}>
              {isUploadingVideo ? <span style={{ fontSize: 11 }}>...</span> : <Video size={22} />}
              <span style={{ fontSize: 10 }}>{cascadeLabel('添加视频', 'Add video')}</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} onChange={handleVideoSelect} disabled={isUploadingVideo} />
            </label>
          )}
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

  // What a draft still needs, in the portal's language (weight and size are set by Leap, so never listed).
  const draftMissingText = (m) => ({ category: cascadeLabel('分类', 'category'), part: cascadeLabel('部件类型', 'classification'), position: cascadeLabel('位置', 'position'), photos: cascadeLabel('照片', 'photos'), video: cascadeLabel('视频', 'video') }[m] || m);

  return (
    <Card title={cascadeLabel('我的草稿（未发布）', 'My Drafts (Not published)')} action={<button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={17} color={C.muted} /></button>}>
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
                {d.oemNumber}{d.missing.filter((m) => m !== 'dimensions' && m !== 'position').length > 0 && <> · {cascadeLabel('缺少：', 'Needs: ')}{d.missing.filter((m) => m !== 'dimensions' && m !== 'position').map(draftMissingText).join(cascadeLabel('、', ', '))}</>}
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

// Real "request a part we don't carry" fulfillment page (RFQ),
// visible only to the real "Leap Supplier" account -- confirmed with
// the person through a real, direct correction mid-session: this
// used to live in the admin portal with its own simplified pricing
// flow, but real staff now fulfil a request item through this exact
// same real, full product submission form every other supplier uses,
// with zero shortcuts (real CNY pricing, real weight/dimensions, a
// real OEM number, at least 3 real photos).
function PartRequestsPage({ onSessionExpired }) {
  const [selectedId, setSelectedId] = useState(null);
  return selectedId
    ? <PartRequestDetail requestId={selectedId} onBack={() => setSelectedId(null)} onSessionExpired={onSessionExpired} />
    : <PartRequestQueue onSelect={setSelectedId} onSessionExpired={onSessionExpired} />;
}

function PartRequestQueue({ onSelect, onSessionExpired }) {
  const { t, lang } = useLang();
  const font = useBodyFont();
  const [queue, setQueue] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    setLoadState("loading");
    fetchPartRequestQueue(getStoredToken())
      .then((q) => { setQueue(q); setLoadState("ready"); })
      .catch((e) => {
        if (e instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(e.message);
        setLoadState("error");
      });
  }, [onSessionExpired]);
  useAutoRefresh(() => fetchPartRequestQueue(getStoredToken()).then(setIfChanged(setQueue)), { enabled: loadState === "ready" });

  const statusStyle = {
    submitted: { bg: C.amberBg, text: C.amber },
    quoted: { bg: C.gaugeBg, text: C.gauge },
    ordered: { bg: C.torqueBg, text: C.torque },
  };

  return (
    <div style={{ padding: 24 }}>
      {errorMessage && <div style={{ ...font, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>}
      <Card title={lang === "zh" ? "求购请求" : "Part Requests"}>
        <div style={{ padding: 16 }}>
          {loadState === "loading" && <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div>}
          {loadState === "ready" && queue.length === 0 && <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{lang === "zh" ? "暂无待处理请求。" : "No open requests right now."}</div>}
          {loadState === "ready" && queue.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {queue.map((r) => {
                const style = statusStyle[r.status] || { bg: C.canvas, text: C.muted };
                return (
                  <button
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, background: "#fff", cursor: "pointer", textAlign: "left", width: "100%" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...disp, fontSize: 15, fontWeight: 700, margin: 0, color: C.ink }}>{r.buyerName}</p>
                      <p style={{ ...font, fontSize: 12, color: C.muted, margin: 0 }}>{r.itemCount} {lang === "zh" ? "件商品" : `item${r.itemCount === 1 ? "" : "s"}`}</p>
                    </div>
                    <span style={{ ...font, fontSize: 11, fontWeight: 700, color: style.text, background: style.bg, borderRadius: 20, padding: "3px 10px", textTransform: "capitalize" }}>{(lang === "zh" ? { submitted: "待报价", quoted: "已报价", ordered: "已下单" } : { submitted: "Submitted", quoted: "Quoted", ordered: "Ordered" })[r.status] || r.status}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function PartRequestDetail({ requestId, onBack, onSessionExpired }) {
  const { lang } = useLang();
  const font = useBodyFont();
  const [request, setRequest] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [fulfillingItem, setFulfillingItem] = useState(null); // the item currently being fulfilled via AddProductForm
  const [isSending, setIsSending] = useState(false);

  const load = () => {
    setLoadState("loading");
    fetchPartRequestDetail(getStoredToken(), requestId)
      .then((r) => { setRequest(r); setLoadState("ready"); })
      .catch((e) => {
        if (e instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(e.message);
        setLoadState("error");
      });
  };
  useEffect(load, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendQuote = async () => {
    setIsSending(true);
    setErrorMessage(null);
    try {
      await sendPartRequestQuote(getStoredToken(), requestId);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (fulfillingItem && request) {
    const vehicleLabel = vehicleSummary({ brand: request.brand, model: request.model, generation: request.generation, year: request.year });
    return (
      <div style={{ padding: 24 }}>
        <AddProductForm
          prefill={{
            name: fulfillingItem.name,
            description: fulfillingItem.description,
            generationId: request.generationId,
            year: request.year,
            vehicleLabel,
            fulfillsRequestItemId: fulfillingItem.id,
          }}
          onCancel={() => setFulfillingItem(null)}
          onCreated={() => { setFulfillingItem(null); load(); }}
        />
      </div>
    );
  }

  if (loadState === "loading") return <div style={{ padding: 24 }}><div style={{ ...font, fontSize: 12.5, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div></div>;
  if (loadState === "error" || !request) return <div style={{ padding: 24 }}><div style={{ ...font, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{errorMessage || (lang === "zh" ? "加载失败。" : "Couldn't load this request.")}</div></div>;

  const readyCount = request.items.filter((i) => i.status !== "pending").length;

  return (
    <div style={{ padding: 24 }}>
      <button onClick={onBack} style={{ ...font, fontSize: 12.5, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
        <ChevronLeft size={14} /> {lang === "zh" ? "返回列表" : "Back to queue"}
      </button>
      {errorMessage && <div style={{ ...font, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>}

      <Card title={`${request.brand || ""} ${request.model || ""} ${request.generation ? `(${request.generation})` : ""} · ${request.year}`}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {request.items.map((item) => (
            <div key={item.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...disp, fontSize: 15, fontWeight: 700, margin: 0, color: C.ink }}>{item.name}</p>
                {item.description && <p style={{ ...font, fontSize: 12, color: C.muted, margin: "2px 0 0" }}>{item.description}</p>}
                <p style={{ ...font, fontSize: 11.5, color: C.muted, margin: "2px 0 0" }}>{lang === "zh" ? "数量" : "Qty"}: {item.quantity}</p>
              </div>
              {item.status === "pending" && request.status === "submitted" && (
                <button onClick={() => setFulfillingItem(item)} style={{ ...font, fontSize: 12.5, fontWeight: 700, color: "#fff", background: C.signal, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {lang === "zh" ? "创建商品" : "Create listing"}
                </button>
              )}
              {item.status === "priced" && <span style={{ ...font, fontSize: 11, fontWeight: 700, color: C.gauge, background: C.gaugeBg, borderRadius: 20, padding: "3px 10px" }}>{lang === "zh" ? "已就绪" : "Ready"}</span>}
              {item.status === "unavailable" && <span style={{ ...font, fontSize: 11, fontWeight: 700, color: C.red, background: C.redBg, borderRadius: 20, padding: "3px 10px" }}>{lang === "zh" ? "无法提供" : "Unavailable"}</span>}
            </div>
          ))}
        </div>
      </Card>

      {request.status === "submitted" && (
        <div style={{ marginTop: 16 }}>
          <p style={{ ...font, fontSize: 12.5, fontWeight: 600, color: readyCount > 0 ? C.gauge : C.amber, marginBottom: 10 }}>
            {readyCount} {lang === "zh" ? "/" : "of"} {request.items.length} {lang === "zh" ? "件已处理" : `item${request.items.length === 1 ? "" : "s"} addressed`}
            {readyCount < request.items.length ? (lang === "zh" ? "，其余将标记为无法提供" : " -- the rest will be marked unavailable") : ""}
          </p>
          <button
            disabled={isSending}
            onClick={handleSendQuote}
            style={{ ...font, padding: "10px 20px", borderRadius: 8, border: "none", background: isSending ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: isSending ? "default" : "pointer" }}
          >
            {isSending ? (lang === "zh" ? "发送中…" : "Sending…") : (lang === "zh" ? "发送报价给买家" : "Send quote to buyer")}
          </button>
        </div>
      )}
    </div>
  );
}

function ProductsPage() {
  const [mode, setMode] = useState("list");
  const [products, setProducts] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [stockFilter, setStockFilter] = useState("all");
  // Real bulk price update (new) -- closes a real gap: there was no
  // way to adjust multiple real products' prices at once before this.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  // The category NAMES for the list (a product keeps the category id).
  const [categoryById, setCategoryById] = useState({});
  useEffect(() => { fetchCategories().then((list) => setCategoryById(Object.fromEntries((Array.isArray(list) ? list : []).map((c) => [c.id, c])))).catch(() => {}); }, []);
  // The classifications' Chinese names (a product keeps the English one): "category|part" -> Chinese.
  const [partZhByKey, setPartZhByKey] = useState({});
  useEffect(() => {
    const ids = Object.keys(categoryById);
    if (ids.length === 0) return undefined;
    let live = true;
    Promise.all(ids.map((id) => fetchPartsForCategory(id).then((list) => (Array.isArray(list) ? list : []).map((p) => [`${id}|${p.nameEn}`, p.nameZh])).catch(() => [])))
      .then((pairs) => { if (live) setPartZhByKey(Object.fromEntries(pairs.flat().filter(([, zh]) => zh))); });
    return () => { live = false; };
  }, [categoryById]);

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
  useAutoRefresh(() => fetchMyProducts(getStoredToken()).then(setIfChanged(setProducts)), { enabled: loadState === "ready" && mode === "list" && !editingProduct && !showBulkPriceModal });

  if (mode === "add") return <div style={{ padding: 24 }}><AddProductForm onCancel={() => setMode("list")} onCreated={() => { load(); }} staysOpenAfterSave /></div>;
  if (mode === "bulk") return <div style={{ padding: 24 }}><BulkUploadPanel onCancel={() => setMode("list")} onImported={load} /></div>;
  if (mode === "drafts") return <div style={{ padding: 24 }}><DraftsPanel onCancel={() => { setMode("list"); load(); }} /></div>;

  const lowStockProducts = products.filter((p) => p.stockQuantity < p.lowStockThreshold);
  const visibleProducts = stockFilter === "lowStock" ? lowStockProducts : products;

  return (
    <div>
      <TopBar title={t.products.title} subtitle={loadState === "ready" ? t.products.subtitle(products.length) : "…"} />
      {/* Row 1, left to right: Add product, Bulk upload, My Drafts, Export, Bulk edit. Row 2: the filters, each with its number of products. */}
      <div data-testid="products-toolbar" style={{ padding: "16px 24px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setMode("add")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <Plus size={13} /> {t.products.addProduct}
        </button>
        <button onClick={() => setMode("bulk")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <Upload size={13} /> {t.products.bulkUpload}
        </button>
        <button onClick={() => setMode("drafts")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}>
          <FileSpreadsheet size={13} /> {lang === "zh" ? "我的草稿（未发布）" : "My Drafts (Not published)"}
        </button>
        {/* Export: the products shown now (it follows the filter), in the portal's language. */}
        <button
          disabled={loadState !== "ready" || visibleProducts.length === 0}
          onClick={() => exportToExcel({
            filename: `products-${new Date().toISOString().slice(0, 10)}`,
            sheetName: lang === "zh" ? "商品" : "Products",
            columns: [
              { header: t.products.thProduct, key: "name", width: 30 },
              { header: t.products.thCategory, key: "category", width: 16 },
              { header: t.products.thPrice, key: "price", width: 14 },
              { header: t.products.thStock, key: "stock", width: 12 },
              { header: t.products.thStatus, key: "status", width: 16 },
            ],
            rows: visibleProducts.map((p) => ({
              name: p.name, category: p.category, price: `${Number(p.price).toFixed(2)} ${p.currencyCode}`,
              stock: p.stockQuantity, status: t.statusProduct[p.status] || p.status,
            })),
          })}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: loadState !== "ready" || visibleProducts.length === 0 ? "default" : "pointer", opacity: loadState !== "ready" || visibleProducts.length === 0 ? 0.5 : 1, fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}
        >
          <Download size={13} /> {t.products.export}
        </button>
        {/* Bulk edit: always here, active once products are ticked (it says how many). */}
        <button
          disabled={selectedIds.size === 0}
          onClick={() => setShowBulkPriceModal(true)}
          title={selectedIds.size === 0 ? (lang === "zh" ? "请先勾选商品" : "Tick products first") : undefined}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: selectedIds.size === 0 ? "default" : "pointer", opacity: selectedIds.size === 0 ? 0.5 : 1, fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}
        >
          <Settings size={13} /> {selectedIds.size > 0 ? `${t.products.bulkPriceUpdate} (${selectedIds.size})` : t.products.bulkPriceUpdate}
        </button>
      </div>
      {loadState === "ready" && (
        <div style={{ padding: "12px 24px 0", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {["all", "lowStock"].map((f) => (
            <button
              key={f}
              onClick={() => setStockFilter(f)}
              style={{
                padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${stockFilter === f ? C.ink : C.line}`, background: stockFilter === f ? C.ink : "#fff",
                color: stockFilter === f ? "#fff" : (f === "lowStock" && lowStockProducts.length > 0 ? C.amber : C.ink),
                fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif",
              }}
            >{f === "all" ? `${t.products.filterAll} (${products.length})` : t.products.filterLowStock(lowStockProducts.length)}</button>
          ))}
        </div>
      )}
      {successMessage && (
        <div style={{ margin: "14px 24px 0", padding: "10px 14px", borderRadius: 8, background: C.gaugeBg, color: C.gauge, fontSize: 12.5, fontWeight: 700 }}>
          {successMessage}
        </div>
      )}
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
              <thead>
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      checked={visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id))}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          visibleProducts.forEach((p) => (e.target.checked ? next.add(p.id) : next.delete(p.id)));
                          return next;
                        });
                      }}
                    />
                  </Th>
                  <Th>{t.products.thProduct}</Th><Th>{t.products.thCategory}</Th><Th>{t.products.thClass}</Th><Th align="right">{t.products.thPrice}</Th><Th align="right">{t.products.thStock}</Th><Th>{t.products.thStatus}</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>{lang === "zh" ? "暂无商品" : "No products yet."}</td></tr>
                )}
                {visibleProducts.map(p => (
                  <tr key={p.id}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p.id); else next.delete(p.id);
                            return next;
                          });
                        }}
                      />
                    </Td>
                    <Td style={{ fontWeight: 700 }}>{lang === "zh" ? p.nameZh || p.name : p.name}</Td>
                    <Td style={{ color: C.muted }}>{categoryById[p.category] ? (lang === "zh" ? categoryById[p.category].nameZh || categoryById[p.category].nameEn : categoryById[p.category].nameEn) : (p.category || "—")}</Td>
                    <Td style={{ color: C.muted }}>{(lang === "zh" && partZhByKey[`${p.category}|${p.part}`]) || p.part || "—"}</Td>
                    <Td align="right" style={{ fontWeight: 700 }}>{p.currencyCode === 'CNY' ? '¥' : '$'}{Number(p.price).toFixed(2)} {p.currencyCode}</Td>
                    {/* REAL BUG FOUND AND FIXED HERE: this used to hardcode
                        `< 20` for every product, ignoring each product's own
                        real, configurable lowStockThreshold (migration 037,
                        set via EditProductModal below) -- a product with a
                        threshold of 50 and 30 in stock (genuinely low, per
                        that supplier's own real setting) showed as normal
                        black text; a product with a threshold of 5 and 15
                        in stock (genuinely fine) showed as a false amber
                        warning. The separate low-stock analytics card
                        already used the real per-product threshold
                        correctly -- this table just hadn't been. */}
                    <Td align="right" style={{ color: p.stockQuantity === 0 ? C.red : p.stockQuantity < p.lowStockThreshold ? C.amber : C.ink, fontWeight: p.stockQuantity < p.lowStockThreshold ? 700 : 400 }}>{p.stockQuantity}</Td>
                    <Td><Badge label={t.statusProduct[p.status] || p.status} statusKey={p.status} /></Td>
                    <Td align="right">
                      <button
                        onClick={() => setEditingProduct(p)}
                        style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                      >{lang === "zh" ? "编辑" : "Edit"}</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); load(); }}
        />
      )}
      {showBulkPriceModal && (
        <BulkPriceModal
          selectedCount={selectedIds.size}
          onClose={() => setShowBulkPriceModal(false)}
          onApplied={(count) => {
            setShowBulkPriceModal(false);
            setSelectedIds(new Set());
            setSuccessMessage(t.products.bulkPriceSuccess(count));
            setTimeout(() => setSuccessMessage(null), 4000);
            load();
          }}
          productIds={[...selectedIds]}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
}

// Real product edit -- confirmed scope: price, stock, and the real
// supplier-configurable low-stock alert threshold (migration 037).
// updateProduct() itself already existed in this app's own API client
// but was never actually called anywhere -- there was genuinely no
// way to edit a real existing product's price or stock at all before
// this, only at creation time.
function EditProductModal({ product, onClose, onSaved }) {
  const { lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const [price, setPrice] = useState(String(product.price));
  const [stockQuantity, setStockQuantity] = useState(String(product.stockQuantity));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product.lowStockThreshold ?? 5));
  // The category and the classification (the part) change together: the classification list is the chosen category's parts.
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(product.category || "");
  const [parts, setParts] = useState([]);
  const [part, setPart] = useState(product.part || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchCategories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => {
    if (!category) { setParts([]); return undefined; }
    let live = true;
    fetchPartsForCategory(category).then((list) => { if (live) setParts(Array.isArray(list) ? list : []); }).catch(() => { if (live) setParts([]); });
    return () => { live = false; };
  }, [category]);

  const handleSave = async () => {
    const priceNum = parseFloat(price);
    const stockNum = parseInt(stockQuantity, 10);
    const thresholdNum = parseInt(lowStockThreshold, 10);
    if (!Number.isFinite(priceNum) || priceNum <= 0) { setError(L("请输入有效价格", "Enter a valid price.")); return; }
    if (!Number.isInteger(stockNum) || stockNum < 0) { setError(L("请输入有效库存数量", "Enter a valid stock quantity.")); return; }
    if (!Number.isInteger(thresholdNum) || thresholdNum < 0) { setError(L("请输入有效的库存预警阈值", "Enter a valid low-stock threshold.")); return; }
    const classificationChanged = category !== (product.category || "") || part !== (product.part || "");
    if (classificationChanged && (!category || !part)) { setError(L("请选择分类和部件类型", "Choose the category and the classification.")); return; }
    setIsSaving(true);
    setError(null);
    try {
      await updateProduct(getStoredToken(), product.id, { price: priceNum, stockQuantity: stockNum, lowStockThreshold: thresholdNum, ...(classificationChanged ? { category, part } : {}) });
      onSaved();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const label = { fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 };
  const input = { width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, marginBottom: 12, boxSizing: "border-box", background: "#fff" };
  const catLabel = (c) => (lang === "zh" ? c.nameZh || c.nameEn : c.nameEn);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div role="dialog" aria-label={L("编辑商品", "Edit product")} style={{ background: "#fff", borderRadius: 12, padding: 24, width: 440, maxWidth: "92vw" }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{lang === "zh" ? product.nameZh || product.name : product.name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{L("编辑价格、分类、部件类型、库存与库存预警阈值", "Edit price, category, classification, stock and low-stock threshold")}</div>

        <label style={label} htmlFor="edit-price">{L("价格 (¥ 人民币)", "Price (¥ RMB)")}</label>
        <input id="edit-price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} style={input} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={label} htmlFor="edit-category">{L("分类", "Category")}</label>
            <select id="edit-category" value={category} onChange={(e) => { setCategory(e.target.value); setPart(""); }} style={input}>
              {!categories.some((c) => c.id === category) && <option value={category}>{category || L("请选择…", "Choose…")}</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
            </select>
          </div>
          <div>
            <label style={label} htmlFor="edit-part">{L("部件类型", "Classification")}</label>
            <select id="edit-part" value={part} onChange={(e) => setPart(e.target.value)} style={input} disabled={!category}>
              <option value="">{L("请选择…", "Choose…")}</option>
              {part && !parts.some((p) => p.nameEn === part) && <option value={part}>{part}</option>}
              {parts.map((p) => <option key={p.nameEn} value={p.nameEn}>{lang === "zh" ? p.nameZh || p.nameEn : p.nameEn}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={label} htmlFor="edit-stock">{L("库存数量", "Stock quantity")}</label>
            <input id="edit-stock" type="number" step="1" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} style={input} />
          </div>
          <div>
            <label style={label} htmlFor="edit-threshold">{L("库存预警阈值", "Low-stock threshold")}</label>
            <input id="edit-threshold" type="number" step="1" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} style={input} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: -6, marginBottom: 12 }}>{L("库存降至此数量或以下时，您将收到通知。", "You'll be notified once when stock falls to the threshold or below.")}</div>

        {error && <div role="alert" style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onClose} disabled={isSaving} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{L("取消", "Cancel")}</button>
          <button onClick={handleSave} disabled={isSaving} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{isSaving ? "…" : L("保存", "Save")}</button>
        </div>
      </div>
    </div>
  );
}
function BulkPriceModal({ selectedCount, productIds, onClose, onApplied, onSessionExpired }) {
  const { t, lang } = useLang();
  const L = (zh, en) => (lang === "zh" ? zh : en);
  // Bulk edit: tick what to change. Price by a percentage or a flat RMB amount; stock and threshold are set to the number given.
  const [changePrice, setChangePrice] = useState(true);
  const [adjustmentType, setAdjustmentType] = useState("percent");
  const [value, setValue] = useState("");
  const [changeStock, setChangeStock] = useState(false);
  const [stock, setStock] = useState("");
  const [changeThreshold, setChangeThreshold] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState(null);

  const nothingChosen = !changePrice && !changeStock && !changeThreshold;
  const handleApply = async () => {
    const num = parseFloat(value);
    const stockNum = parseInt(stock, 10);
    const thresholdNum = parseInt(threshold, 10);
    if (changePrice && !Number.isFinite(num)) { setError(L("请输入有效数字", "Enter a valid number.")); return; }
    if (changeStock && (!Number.isInteger(stockNum) || stockNum < 0)) { setError(L("请输入有效库存数量", "Enter a valid stock quantity.")); return; }
    if (changeThreshold && (!Number.isInteger(thresholdNum) || thresholdNum < 0)) { setError(L("请输入有效的库存预警阈值", "Enter a valid low-stock threshold.")); return; }
    setIsApplying(true);
    setError(null);
    try {
      // Only the price: the same request as before. Anything else: the bulk edit request (the price too, when ticked).
      const updated = changePrice && !changeStock && !changeThreshold
        ? await bulkUpdateProductPrices(getStoredToken(), productIds, adjustmentType, num)
        : await bulkUpdateProducts(getStoredToken(), {
          productIds,
          ...(changePrice ? { priceAdjustment: { type: adjustmentType, value: num } } : {}),
          ...(changeStock ? { stockQuantity: stockNum } : {}),
          ...(changeThreshold ? { lowStockThreshold: thresholdNum } : {}),
        });
      onApplied(updated.length);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const section = (on) => ({ border: `1px solid ${on ? C.ink : C.line}`, borderRadius: 10, padding: 12, marginBottom: 10 });
  const tick = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" };
  const input = { width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, marginTop: 8, boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div role="dialog" aria-label={L("批量编辑", "Bulk edit")} style={{ background: "#fff", borderRadius: 12, padding: 24, width: 420, maxWidth: "92vw" }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{L("批量编辑", "Bulk edit")}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{t.products.bulkPriceSelected(selectedCount)} · {L("勾选要修改的内容", "tick what to change")}</div>

        <div style={section(changePrice)}>
          <label style={tick}><input type="checkbox" checked={changePrice} onChange={(e) => setChangePrice(e.target.checked)} /> {L("价格", "Price")}</label>
          {changePrice && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {["percent", "flat"].map((type) => (
                  <button key={type} onClick={() => setAdjustmentType(type)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${adjustmentType === type ? C.ink : C.line}`, background: adjustmentType === type ? C.ink : "#fff", color: adjustmentType === type ? "#fff" : C.ink }}>
                    {type === "percent" ? t.products.bulkPricePercent : t.products.bulkPriceFlat}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{adjustmentType === "percent" ? t.products.bulkPricePercentHint : t.products.bulkPriceFlatHint}</div>
              <input aria-label={adjustmentType === "percent" ? L("百分比 (%)", "Percentage (%)") : L("金额 (¥ 人民币)", "Amount (¥ RMB)")} placeholder={adjustmentType === "percent" ? L("例如 10 或 -5", "e.g. 10 or -5") : L("例如 20 或 -15 (¥)", "e.g. 20 or -15 (¥)")} type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} style={input} />
            </>
          )}
        </div>

        <div style={section(changeStock)}>
          <label style={tick}><input type="checkbox" checked={changeStock} onChange={(e) => setChangeStock(e.target.checked)} /> {L("库存数量", "Stock quantity")}</label>
          {changeStock && <input aria-label={L("新的库存数量", "New stock quantity")} placeholder={L("所有选中的商品都设为此数量", "Every selected product is set to this number")} type="number" step="1" min="0" value={stock} onChange={(e) => setStock(e.target.value)} style={input} />}
        </div>

        <div style={section(changeThreshold)}>
          <label style={tick}><input type="checkbox" checked={changeThreshold} onChange={(e) => setChangeThreshold(e.target.checked)} /> {L("库存预警阈值", "Low-stock threshold")}</label>
          {changeThreshold && <input aria-label={L("新的库存预警阈值", "New low-stock threshold")} placeholder={L("所有选中的商品都设为此数量", "Every selected product is set to this number")} type="number" step="1" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={input} />}
        </div>

        {error && <div role="alert" style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onClose} disabled={isApplying} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.products.bulkPriceCancel}</button>
          <button onClick={handleApply} disabled={isApplying || nothingChosen || (changePrice && !value) || (changeStock && stock === "") || (changeThreshold && threshold === "")} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {isApplying ? t.products.bulkPriceApplying : t.products.bulkPriceApply}
          </button>
        </div>
      </div>
    </div>
  );
}

const ORDER_STAGES = ["pending", "preparing", "shipped"]; // the supplier's own leg, in order

function OrderDetailPanel({ order, onBack, onUpdated }) {
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const { t, lang } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  const o = t.orders;
  const labelRef = useRef(null);

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

  // Real, standard pattern for printing one specific section without a
  // real PDF-generation dependency: the label's own real content
  // (including the already-rendered real QR code SVG markup) is
  // cloned via innerHTML into a real, separate blank window with its
  // own minimal real print-friendly styling, then window.print() is
  // called on that real window specifically -- the main app's own
  // real UI never enters the print dialog at all.
  const handlePrintLabel = () => {
    if (!labelRef.current) return;
    const printWindow = window.open('', '_blank', 'width=420,height=560');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${order.orderId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 24px; }
            .label-row { margin-bottom: 14px; }
            .label-caps { font-size: 11px; font-weight: 700; color: #6B7280; letter-spacing: 0.03em; margin-bottom: 4px; }
            .label-value { font-size: 15px; font-weight: 700; }
            .qr-wrap { display: flex; justify-content: center; margin: 20px 0; }
          </style>
        </head>
        <body>${labelRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // CONFIRMED (migration 027): a supplier's own real leg ends at
  // "shipped" -- to the assigned hub, never to the buyer directly.
  // "Delivered" was removed entirely from here -- that's now a real
  // hub-portal action, since only the hub's own final leg to the buyer
  // (or real carrier tracking covering that same leg) has any real
  // visibility into whether a buyer actually received anything.
  // The SERVER decides what is allowed (order.allowedStatuses / locked / canEditTracking, see services/api/src/modules/supplier/orderRules.js); the portal
  // only shows it. The fallback below is for a reply without those fields: forward only.
  const stagePosition = ORDER_STAGES.indexOf(order.status);
  const allowedStatuses = Array.isArray(order.allowedStatuses) ? order.allowedStatuses : ORDER_STAGES.filter((_, i) => i > stagePosition);
  const locked = Boolean(order.locked);
  const canEditTracking = order.canEditTracking !== undefined ? Boolean(order.canEditTracking) : !locked;

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
                  <div style={{ minWidth: 0 }}><span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{it.name}</span><OrderVehicle vehicle={it.vehicle} /></div>
                  <span style={{ ...font, fontSize: 12.5, color: C.muted }}>{o.qty} × {it.quantity} · {it.unitPriceCny == null ? "—" : cny(it.unitPriceCny)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title={o.shippingTitle}>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label={o.trackingLabel}>
                <input style={inputStyle} value={tracking} onChange={e => setTracking(e.target.value)} placeholder={o.trackingPlaceholder} disabled={!canEditTracking || Boolean(order.canAccept)} />
              </Field>
              {error && <div style={{ ...font, fontSize: 12, color: C.red }}>{error}</div>}
              {order.canAccept ? null : allowedStatuses.includes("shipped") ? (
                <button
                disabled={isSaving}
                onClick={() => handleUpdate({ status: "shipped", trackingNumber: tracking })}
                style={{ ...font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, borderRadius: 8, border: "none", background: isSaving ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: isSaving ? "default" : "pointer" }}
              >
                <Truck size={14} /> {o.markShipped}
              </button>
              ) : canEditTracking ? (
                <button
                disabled={isSaving}
                onClick={() => handleUpdate({ trackingNumber: tracking })}
                style={{ ...font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, borderRadius: 8, border: "none", background: isSaving ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: isSaving ? "default" : "pointer" }}
              >
                <Truck size={14} /> {o.updateTracking}
              </button>
              ) : null}
            </div>
          </Card>
          {order.hubShipmentId && (
            <Card title={o.labelTitle}>
              <div style={{ padding: 16 }}>
                <div style={{ ...font, fontSize: 12, color: C.muted, marginBottom: 14 }}>{o.labelHint}</div>
                <div ref={labelRef}>
                  <div className="label-row" style={{ marginBottom: 14 }}>
                    <div className="label-caps" style={{ ...font, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.03em", marginBottom: 4 }}>{o.labelRecipient}</div>
                    <div className="label-value" style={{ ...font, fontSize: 15, fontWeight: 700, color: C.ink }}>{order.hubName}</div>
                    <div style={{ ...font, fontSize: 13, color: C.ink }}>{order.hubAddress}</div>
                  </div>
                  <div className="label-row" style={{ marginBottom: 14 }}>
                    <div className="label-caps" style={{ ...font, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.03em", marginBottom: 4 }}>{o.labelOrder}</div>
                    <div className="label-value" style={{ ...font, fontSize: 15, fontWeight: 700, color: C.ink }}>{order.orderId}</div>
                  </div>
                  <div className="qr-wrap" style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
                    <QRCodeSVG value={String(order.hubShipmentId)} size={160} level="M" />
                  </div>
                </div>
                <button
                  onClick={handlePrintLabel}
                  style={{ ...font, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 11, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {o.printLabel}
                </button>
              </div>
            </Card>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={o.actionsTitle}>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {order.canAccept && <AnswerBlock order={order} onUpdated={onUpdated} />}
                {locked && (
                  <div role="status" style={{ ...font, fontSize: 12.5, color: C.ink, background: "#FFF7E6", border: "1px solid #F5D9A8", borderRadius: 8, padding: 10, lineHeight: 1.5 }}>
                    {order.lockReason === "cancelled" ? (order.refusalReason ? refusedText(lang, order) : o.lockedCancelled) : o.lockedAtHub}
                  </div>
                )}
                {!order.canAccept && ORDER_STAGES.map(s => {
                  const isCurrent = order.status === s;
                  const isAllowed = allowedStatuses.includes(s);
                  return (
                    <button
                      key={s}
                      disabled={isSaving || !isAllowed}
                      onClick={() => handleUpdate({ status: s })}
                      style={{
                        ...font, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: isAllowed && !isSaving ? "pointer" : "default", textAlign: "left",
                        border: isCurrent ? `2px solid ${C.signal}` : `1px solid ${C.line}`,
                        background: isCurrent ? "#FDF1EB" : "#fff",
                        opacity: isAllowed || isCurrent ? 1 : 0.45,
                      }}
                    >{t.statusOrder[s] || s}</button>
                  );
                })}
                {!locked && !order.canAccept && <div style={{ ...font, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>{o.forwardOnlyHint}</div>}
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
  useAutoRefresh(() => fetchMyOrders(getStoredToken()).then(setIfChanged(setOrders)), { enabled: loadState === "ready" });

  const filtered = filterIdx === 0 ? orders : orders.filter(o => o.status === keys[filterIdx]);

  return (
    <div>
      <TopBar title={t.orders.title} subtitle={t.orders.subtitle} />
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {t.orders.filters.map((f, i) => (
            <button key={f} onClick={() => setFilterIdx(i)} style={{
              padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif",
              border: `1px solid ${filterIdx === i ? C.ink : C.line}`, background: filterIdx === i ? C.ink : "#fff", color: filterIdx === i ? "#fff" : C.ink,
            }}>{f}</button>
          ))}
        </div>
        {/* Real export (new) -- closes a real gap: this portal had no
            export capability anywhere before this, unlike the admin
            dashboard, which already has it on every list page. */}
        <button
          disabled={filtered.length === 0}
          onClick={() => exportToExcel({
            filename: `orders-${new Date().toISOString().slice(0, 10)}`,
            sheetName: lang === "zh" ? "订单" : "Orders",
            columns: [
              { header: t.orders.thId, key: "orderId", width: 16 },
              { header: t.orders.thItems, key: "items", width: 40 },
              { header: t.orders.thAmount, key: "amount", width: 12 },
              { header: t.orders.thStatus, key: "status", width: 16 },
            ],
            rows: filtered.map((o) => ({
              orderId: o.orderId,
              items: o.items.map((i) => i.name).join(lang === "zh" ? "，" : ", "),
              amount: o.items.reduce((sum, i) => sum + Number(i.unitPriceCny || 0) * i.quantity, 0).toFixed(2),
              status: t.statusOrder[o.status] || o.status,
            })),
          })}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: filtered.length === 0 ? "default" : "pointer", opacity: filtered.length === 0 ? 0.5 : 1, fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}
        >
          <Download size={13} /> {t.orders.export}
        </button>
      </div>
      <div style={{ padding: 24 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", fontSize: 13, color: C.red }}>{errorMessage}</div></Card>}
        {loadState === "ready" && (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>{t.orders.thId}</Th><Th>{t.orders.thItems}</Th><Th>{carHeader(lang)}</Th><Th align="right">{t.orders.thAmount}</Th><Th>{t.orders.thStatus}</Th><Th></Th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>{lang === "zh" ? "暂无订单" : "No orders yet."}</td></tr>
                )}
                {filtered.map(o => {
                  const amount = o.items.reduce((sum, i) => sum + Number(i.unitPriceCny || 0) * i.quantity, 0);
                  return (
                    <tr key={o.subOrderId} onClick={() => onOpen(o)} style={{ cursor: "pointer" }}>
                      <Td><PlateChip small>{o.orderId}</PlateChip></Td>
                      <Td style={{ maxWidth: 260 }}>{o.items.map(i => i.name).join(lang === "zh" ? "，" : ", ")}</Td>
                      <Td style={{ minWidth: 300 }}><OrderVehicleCell items={o.items} /></Td>
                      <Td align="right" style={{ fontWeight: 700 }}>{cny(amount)}</Td>
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
// One fault case, as the SUPPLIER sees it (migration 091): an unanswered "can you replace this?" question with its
// form, or - once answered - their answer and how the case is progressing. They never see the platform's private
// notes, who bears the cost, or any refund amount (the server doesn't send them).
// A click-to-enlarge evidence photo: a thumbnail that opens full size. Escape, the close button, or a click outside the picture
// closes it; "Open original" opens the file in a new tab.
function EvidencePhoto({ url }) {
  const { t, lang } = useLang();
  const font = useBodyFont();
  const [open, setOpen] = useState(false);
  const src = `${API_BASE_URL}${url}`;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <img
        src={src}
        alt=""
        role="button"
        tabIndex={0}
        title={t.replacement.photoOpen}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}`, cursor: "zoom-in" }}
      />
      {open && (
        <div role="dialog" aria-label={lang === "zh" ? "照片" : "Photo"} onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <img src={src} alt={lang === "zh" ? "质检照片" : "Evidence photo"} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8, background: "#111" }} />
          <button aria-label={t.replacement.photoClose} onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ ...font, position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 18, border: "none", background: "#fff", color: C.ink, fontSize: 20, lineHeight: "36px", cursor: "pointer" }}>×</button>
          <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ ...font, position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", padding: "8px 16px", borderRadius: 8, background: "#fff", color: C.ink, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>{t.replacement.photoOriginal}</a>
        </div>
      )}
    </>
  );
}

function ReplacementCard({ faultCase, onAnswered }) {
  const { t } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  const r = t.replacement;
  const [canReplace, setCanReplace] = useState(null); // null = not chosen yet
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const unanswered = faultCase.status === "awaiting_supplier";
  const today = new Date().toISOString().slice(0, 10);

  const submit = async () => {
    if (canReplace === null) { setError(r.errChoose); return; }
    if (canReplace && !eta) { setError(r.errEta); return; }
    setSaving(true);
    setError(null);
    try {
      await answerFaultCase(getStoredToken(), faultCase.id, { canReplace, eta: canReplace ? eta : undefined, note: note.trim() || undefined });
      onAnswered();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const choice = (value, label) => (
    <button
      type="button"
      onClick={() => { setCanReplace(value); setError(null); }}
      style={{ ...font, flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${canReplace === value ? C.ink : C.line}`, background: canReplace === value ? C.ink : "#fff", color: canReplace === value ? "#fff" : C.ink }}
    >
      {label}
    </button>
  );

  return (
    <Card>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ ...font, fontSize: 14, fontWeight: 700, color: C.ink }}>{r.orderLabel(faultCase.orderId)}</span>
          <Badge label={r.statusLabels[faultCase.status] || faultCase.status} statusKey={faultCase.status === "completed" ? "active" : "pending"} />
        </div>
        <div style={{ ...font, fontSize: 12.5, color: C.ink }}>
          <strong>{r.itemsLabel}:</strong> {faultCase.items.map((i) => `${i.name || i.productId} × ${i.quantity}`).join(", ")}
        </div>

        {/* The replacement the supplier now has to ship (migration 095). */}
        {faultCase.replacementOrderId && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: C.canvas, border: `1px solid ${C.gauge}` }}>
            <div style={{ ...font, fontSize: 12.5, color: C.ink }}>
              <strong>{r.replacementShipA} {faultCase.replacementOrderId}</strong> {r.replacementShipB}
            </div>
          </div>
        )}

        {/* WHY it was flagged: what the inspector found. Without this a supplier is asked to replace something with no way to see the fault. */}
        {faultCase.evidence && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: C.canvas, border: `1px solid ${C.line}` }}>
            <div style={{ ...font, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 6 }}>{r.evidenceTitle}</div>
            {faultCase.evidence.damageType && (
              <div style={{ ...font, fontSize: 12.5, color: C.ink }}><strong>{r.evidenceKind}:</strong> {r.damageTypes[faultCase.evidence.damageType] || faultCase.evidence.damageType}</div>
            )}
            {faultCase.evidence.note && (
              <div style={{ ...font, fontSize: 12.5, color: C.ink, marginTop: 2 }}><strong>{r.evidenceNote}:</strong> {faultCase.evidence.note}</div>
            )}
            {faultCase.evidence.photos.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {faultCase.evidence.photos.map((url) => <EvidencePhoto key={url} url={url} />)}
              </div>
            ) : (
              <div style={{ ...font, fontSize: 12, color: C.muted, marginTop: 6 }}>{r.evidenceNoPhotos}</div>
            )}
          </div>
        )}

        {unanswered ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>{r.question}</div>
            <div style={{ display: "flex", gap: 8 }}>{choice(true, r.yes)}{choice(false, r.no)}</div>
            {canReplace === true && (
              <div style={{ marginTop: 12 }}>
                <label style={{ ...font, display: "block", fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 6 }} htmlFor={`eta-${faultCase.id}`}>{r.etaLabel}</label>
                <input id={`eta-${faultCase.id}`} type="date" min={today} value={eta} onChange={(e) => setEta(e.target.value)} style={inputStyle} />
              </div>
            )}
            {canReplace !== null && (
              <div style={{ marginTop: 12 }}>
                <label style={{ ...font, display: "block", fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 6 }} htmlFor={`note-${faultCase.id}`}>{r.noteLabel}</label>
                <input id={`note-${faultCase.id}`} value={note} placeholder={r.notePlaceholder} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
              </div>
            )}
            {error && <div style={{ ...font, fontSize: 12, color: C.red, marginTop: 10 }}>{error}</div>}
            <button
              onClick={submit}
              disabled={saving}
              style={{ ...font, marginTop: 14, padding: "9px 16px", borderRadius: 8, border: "none", background: saving ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer" }}
            >
              {saving ? r.submitting : r.submit}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 10, ...font, fontSize: 12.5, color: C.ink }}>
            <div>{faultCase.canReplace ? r.answeredYes(faultCase.eta) : r.answeredNo}{faultCase.note ? ` — “${faultCase.note}”` : ""}</div>
            <div style={{ color: C.muted, marginTop: 4 }}>
              {faultCase.hubReturn === "returned" ? r.hubReturned : faultCase.hubReturn === "discarded" ? r.hubDiscarded : r.hubNone}
              {faultCase.returnTrackingNumber ? ` — ${r.returnTracking}: ${faultCase.returnTrackingNumber}` : ""}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// "Replacement requests": the questions Leap has sent this supplier about faulty items. Renders nothing at all for a
// supplier with none, so most suppliers see no change to the Returns page.
function ReplacementRequests() {
  const { t } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const [cases, setCases] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    fetchMyFaultCases(getStoredToken())
      .then(setCases)
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setError(err.message);
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return <div style={{ padding: "16px 24px 0" }}><div style={{ ...font, fontSize: 12.5, color: C.red }}>{t.replacement.loadError}{error}</div></div>;
  }
  if (!cases || cases.length === 0) return null;
  return (
    <div style={{ padding: "16px 24px 0" }}>
      <div style={{ ...font, fontSize: 15, fontWeight: 700, color: C.ink }}>{t.replacement.title}</div>
      <div style={{ ...font, fontSize: 12.5, color: C.muted, margin: "2px 0 12px" }}>{t.replacement.subtitle}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cases.map((c) => <ReplacementCard key={c.id} faultCase={c} onAnswered={load} />)}
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
  useAutoRefresh(() => fetchMyReturnCases(getStoredToken()).then(setIfChanged(setCases)), { enabled: loadState === "ready" });

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
      <ReplacementRequests />
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
  useAutoRefresh(() => fetchMyNotifications(getStoredToken()).then(setIfChanged(setNotifications)));

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
                <span style={{ ...font, fontSize: 10.5, color: C.muted, whiteSpace: "nowrap" }}>{new Date(n.createdAt).toLocaleDateString(uiLocale())}</span>
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

  // Real, silent load -- used by both the very first load and every
  // background poll below. showErrors is false for a background poll:
  // a real transient failure there shouldn't blank out an already-
  // loaded thread with an error message, only a real, user-initiated
  // load (the very first one) should ever show one.
  const load = (showErrors = true) => {
    fetchMyMessages(getStoredToken())
      .then(setMessages)
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        if (showErrors) setErrorMessage(err.message);
      });
  };

  // Real auto-refresh (new) -- mirrors the exact same proven pattern
  // just built for mobile's own ticket/return message threads (the
  // identical real gap: a supplier previously had to manually
  // navigate away and back to see whether an admin had replied yet).
  // Polls every 20s while this page is mounted.
  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const { onSessionExpired } = useSupplier();
  const fi = t.finance;

  // Real supplier payout method (migration 034) -- replaces what was
  // previously entirely fake, hardcoded placeholder text here ("China
  // Construction Bank •••• 8842", a made-up account holder name never
  // connected to anything real).
  const [payoutMethod, setPayoutMethod] = useState(undefined); // undefined = loading, null = none on file yet
  const [isEditing, setIsEditing] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // The supplier's real money figures (ready to be paid, in return window, paid so far,
  // commission rates, payout history). undefined = loading.
  const [finance, setFinance] = useState(undefined);
  const [financeError, setFinanceError] = useState(null);
  useEffect(() => {
    fetchMyFinance(getStoredToken())
      .then(setFinance)
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setFinanceError(err.message);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(() => fetchMyFinance(getStoredToken()).then(setIfChanged(setFinance)));

  useEffect(() => {
    fetchMyPayoutMethod(getStoredToken())
      .then((result) => {
        setPayoutMethod(result);
        if (result) {
          setBankName(result.bankName);
          setAccountNumber(result.accountNumber);
          setAccountHolderName(result.accountHolderName);
        } else {
          setIsEditing(true); // no real payout method yet -- go straight to the real form
        }
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountHolderName.trim()) {
      setErrorMessage(lang === "zh" ? "请填写所有字段" : "Please fill in every field.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updateMyPayoutMethod(getStoredToken(), {
        bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountHolderName: accountHolderName.trim(),
      });
      setPayoutMethod(result);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Amounts are RMB (¥): the supplier's own price x quantity (Leap's fees are inside the buyer's price, so nothing is taken from it).
  const cny = (n) => `¥${Number(n).toLocaleString(uiLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const font = useBodyFont();
  const legacyText = lang === "zh" ? `此前以美元 (USD) 记录的结算（不计入上方合计）：$${Number(finance && finance.legacyUsdPaid || 0).toFixed(2)}` : `Earlier payouts recorded in US dollars (not included in the total above): $${Number(finance && finance.legacyUsdPaid || 0).toFixed(2)}`;

  return (
    <div>
      <TopBar title={fi.title} subtitle={finance ? fi.subtitle(finance.returnWindowDays) : ""} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {financeError && (
          <div style={{ ...font, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 12 }}>{fi.loadError}{financeError}</div>
        )}
        {finance === undefined && !financeError && <div style={{ ...font, fontSize: 13, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div>}
        {finance && (
          <>
            <div style={{ display: "flex", gap: 16 }}>
              <KpiCard label={fi.kpiReady} value={cny(finance.readyToPay.amount)} sub={fi.kpiReadySub(finance.readyToPay.orderCount)} icon={Wallet} accent={C.torque} />
              <KpiCard label={fi.kpiWaiting} value={cny(finance.inReturnWindow.amount)} sub={fi.kpiWaitingSub(finance.inReturnWindow.orderCount, finance.returnWindowDays)} icon={RotateCcw} accent={C.amber} />
              <KpiCard label={fi.kpiPaid} value={cny(finance.totalPaid)} sub={fi.kpiPaidSub(finance.lastPayout ? new Date(finance.lastPayout.paidAt).toLocaleDateString(uiLocale()) : null)} icon={Check} accent={C.gauge} />
            </div>
            {finance.legacyUsdPaid > 0 && <div data-testid="legacy-usd-note" style={{ ...font, fontSize: 12, color: C.muted }}>{legacyText}</div>}
            {/* Payments Leap released for a fault that happened in ITS care (migration 097): why "ready to pay" can include more than delivered orders. */}
            {finance.readyToPay.adjustments && finance.readyToPay.adjustments.length > 0 && (
              <Card title={fi.adjTitle}>
                <div style={{ ...font, padding: "12px 16px", fontSize: 12.5, color: C.muted }}>{fi.adjIntro}</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {finance.readyToPay.adjustments.map((a, i) => (
                      <tr key={`${a.orderId}-${a.kind}-${i}`}>
                        <Td style={{ fontWeight: 600 }}>{a.orderId}</Td>
                        <Td>{a.kind === "original_order" ? fi.adjOriginal : fi.adjShipping}</Td>
                        <Td align="right">{cny(a.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            <Card title={fi.recordsTitle}>
              {finance.payouts.length === 0 ? (
                <div style={{ ...font, padding: 22, fontSize: 13, color: C.muted, textAlign: "center" }}>{fi.emptyRecords}</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><Th>{fi.thDate}</Th><Th align="right">{fi.thOrders}</Th><Th align="right">{fi.thPayout}</Th><Th>{fi.thNotes}</Th></tr></thead>
                  <tbody>
                    {finance.payouts.map((p) => (
                      <tr key={p.id}>
                        <Td style={{ fontWeight: 600 }}>{new Date(p.paidAt).toLocaleDateString(uiLocale())}</Td>
                        <Td align="right">{p.orderCount}</Td>
                        <Td align="right" style={{ fontWeight: 700 }}>{p.currencyCode === "CNY" ? cny(p.amount) : `$${Number(p.amount).toFixed(2)} USD`}</Td>
                        <Td style={{ color: C.muted }}>{p.notes || ""}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ ...font, padding: "10px 16px", fontSize: 11.5, color: C.muted, borderTop: `1px solid ${C.line}` }}>{fi.returnCaseNote}</div>
            </Card>
          </>
        )}
        <Card title={fi.bankTitle}>
          <div style={{ padding: 16 }}>
            {payoutMethod === undefined && <div style={{ fontSize: 12.5, color: C.muted }}>{lang === "zh" ? "加载中…" : "Loading…"}</div>}
            {payoutMethod !== undefined && !isEditing && payoutMethod && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CreditCard size={20} color={C.muted} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{payoutMethod.bankName} — {payoutMethod.accountNumber}</div>
                    <div style={{ fontSize: 11.5, color: C.muted }}>{lang === "zh" ? "户名：" : "Account holder: "}{payoutMethod.accountHolderName}</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >{lang === "zh" ? "编辑" : "Edit"}</button>
              </div>
            )}
            {payoutMethod !== undefined && isEditing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                <div style={{ fontSize: 11.5, color: C.muted }}>
                  {lang === "zh" ? "请输入用于接收付款的银行账户信息。" : "Enter the bank account details payouts should be sent to."}
                </div>
                <input placeholder={lang === "zh" ? "银行名称" : "Bank name"} value={bankName} onChange={(e) => setBankName(e.target.value)}
                  style={{ padding: "8px 11px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13 }} />
                <input placeholder={lang === "zh" ? "账号" : "Account number"} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                  style={{ padding: "8px 11px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13 }} />
                <input placeholder={lang === "zh" ? "账户持有人姓名" : "Account holder name"} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)}
                  style={{ padding: "8px 11px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13 }} />
                {errorMessage && <div style={{ fontSize: 12, color: C.red }}>{errorMessage}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={isSaving}
                    onClick={handleSave}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: isSaving ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSaving ? "default" : "pointer" }}
                  >{isSaving ? "…" : (lang === "zh" ? "保存" : "Save")}</button>
                  {payoutMethod && (
                    <button
                      onClick={() => { setIsEditing(false); setBankName(payoutMethod.bankName); setAccountNumber(payoutMethod.accountNumber); setAccountHolderName(payoutMethod.accountHolderName); setErrorMessage(null); }}
                      style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                    >{lang === "zh" ? "取消" : "Cancel"}</button>
                  )}
                </div>
              </div>
            )}
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

// Verification state (suppliers.verification_status) -> the badge color the portal already has.
const VERIFICATION_BADGE = { verified: "active", pending: "pending", rejected: "rejected" };

// The supplier's return address (migration 092): where the inspection hub sends a faulty unit back to. One address per
// supplier; saving replaces it. Admin can also correct it from the supplier's page.
function ReturnAddressCard() {
  const { t } = useLang();
  const { onSessionExpired } = useSupplier();
  const font = useBodyFont();
  const inputStyle = useInputStyle();
  const r = t.settings.returnAddress;
  const [saved, setSaved] = useState(undefined); // undefined = loading, null = nothing entered yet
  const [form, setForm] = useState({ contactName: "", phone: "", address: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    fetchMyReturnAddress(getStoredToken())
      .then((data) => {
        const entered = data && data.address ? data : null; // the server sends null when nothing has been entered
        setSaved(entered);
        if (entered) setForm({ contactName: entered.contactName, phone: entered.phone, address: entered.address });
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setError(`${r.loadError}${err.message}`);
        setSaved(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setJustSaved(false); };
  const save = async () => {
    if (!form.contactName.trim() || !form.phone.trim() || !form.address.trim()) { setError(r.errRequired); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await saveMyReturnAddress(getStoredToken(), form);
      setSaved(result);
      setForm({ contactName: result.contactName, phone: result.phone, address: result.address });
      setJustSaved(true);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const label = { ...font, display: "block", fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "12px 0 6px" };

  return (
    <Card title={r.title} style={{ flex: 1 }}>
      <div style={{ padding: 18 }}>
        <p style={{ ...font, fontSize: 12.5, color: C.muted, margin: "0 0 4px" }}>{r.help}</p>
        {saved === null && !error && <p style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.amber, margin: "6px 0 0" }}>{r.notSet}</p>}
        <label style={label} htmlFor="ra-name">{r.contactName}</label>
        <input id="ra-name" value={form.contactName} onChange={change("contactName")} style={inputStyle} />
        <label style={label} htmlFor="ra-phone">{r.phone}</label>
        <input id="ra-phone" value={form.phone} onChange={change("phone")} style={inputStyle} />
        <label style={label} htmlFor="ra-address">{r.address}</label>
        <textarea id="ra-address" value={form.address} onChange={change("address")} style={{ ...inputStyle, height: 78, resize: "vertical" }} />
        {error && <div style={{ ...font, fontSize: 12, color: C.red, marginTop: 10 }}>{error}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <button onClick={save} disabled={saving} style={{ ...font, padding: "9px 18px", borderRadius: 8, border: "none", background: saving ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer" }}>
            {saving ? r.saving : r.save}
          </button>
          {justSaved && <span style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.gauge }}>{r.saved}</span>}
        </div>
      </div>
    </Card>
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
            {/* Real profile data only. A business license number and a "main categories" list used to
                be typed in here (a placeholder number, and a fixed category list); neither exists in
                the database, so they are gone rather than shown as if they were real. */}
            <InfoRow icon={Building2} label={s.companyName} value={profile ? profile.name : ""} />
            <InfoRow
              icon={BadgeCheck}
              label={s.verification}
              value={profile ? <Badge label={s.verificationStates[profile.verificationStatus] || profile.verificationStatus} statusKey={VERIFICATION_BADGE[profile.verificationStatus] || "inactive"} /> : ""}
            />
            <InfoRow icon={Store} label={s.country} value={profile ? profile.country : ""} />
            <InfoRow icon={Send} label={s.contactEmail} value={profile ? profile.contactEmail : ""} />
          </div>
        </Card>
        <ReturnAddressCard />
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

const NAV_ICONS = { overview: LayoutGrid, products: PackageSearch, partRequests: FileQuestion, orders: ShoppingBag, returns: RotateCcw, messages: MessageSquare, finance: Wallet, settings: Settings };
const NAV_ORDER = ["overview", "products", "orders", "returns", "messages", "finance", "settings"];

function PortalShell() {
  const [page, setPage] = useState("overview");
  const [openOrder, setOpenOrder] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { t, lang } = useLang();
  const outerSupplierContext = useSupplier();
  const { profile, currentUser, onLogout } = outerSupplierContext;
  const font = useBodyFont();

  const isLeapSupplier = currentUser?.supplierId === "supplier_leap";
  const navOrder = isLeapSupplier
    ? ["overview", "products", "partRequests", "orders", "returns", "messages", "finance", "settings"]
    : NAV_ORDER;

  const refreshUnreadCount = () => {
    fetchUnreadNotificationCount(getStoredToken()).then(setUnreadCount).catch(() => {}); // non-critical -- badge just stays as-is
  };
  useEffect(refreshUnreadCount, []);
  useAutoRefresh(refreshUnreadCount);      // the sidebar's unread badge
  // The order that is open (a copy of its row) follows the supplier's orders: a change made elsewhere (the buyer cancelled it, the hub received it) appears in the open order by itself.
  useAutoRefresh(async () => {
    if (!openOrder) return;
    const list = await fetchMyOrders(getStoredToken());
    const fresh = Array.isArray(list) ? list.find((o) => o.subOrderId === openOrder.subOrderId) : null;
    if (fresh) setOpenOrder((current) => (current && current.subOrderId === fresh.subOrderId && !sameData(current, fresh) ? fresh : current));
  }, { enabled: !!openOrder });

  let content;
  if (openOrder) content = <OrderDetailPanel order={openOrder} onBack={() => setOpenOrder(null)} onUpdated={(updated) => setOpenOrder({ ...openOrder, ...updated })} />;
  else if (page === "overview") content = <OverviewPage onSessionExpired={onLogout} />;
  else if (page === "products") content = <ProductsPage />;
  else if (page === "partRequests") content = <PartRequestsPage onSessionExpired={onLogout} />;
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
          {navOrder.map(id => {
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
              {profile ? t.verifiedSince(new Date(profile.createdAt).toLocaleDateString(uiLocale())) : ""}
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
  setApiLanguage(lang);      // the server's messages, dates and numbers follow the chosen language

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
