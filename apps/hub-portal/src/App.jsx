import React, { useState, useEffect } from "react";
import {
  PackageCheck, LogOut, ChevronLeft, Camera, X, AlertTriangle,
  PackageOpen, Search as SearchIcon, ClipboardCheck, PackagePlus, Truck, Inbox,
} from "lucide-react";
import {
  getStoredToken, saveToken, clearToken, getCurrentUser, SessionExpiredError,
  fetchMyShipments, fetchMyShipmentById, recordShipmentEvent, uploadEvidencePhoto, confirmDelivery,
} from "./auth";
import LoginPage from "./LoginPage";
import { HubContext, useHub } from "./hubContext";
import { LangContext, useLang } from "./langContext";

const C = {
  ink: "#14171C", canvas: "#F5F6F8", card: "#FFFFFF", line: "#E4E6EA",
  signal: "#E8622C", torque: "#2A5FD9", gauge: "#1E9D6B", amber: "#B9791F", red: "#C0362C",
  muted: "#6B7280", gaugeBg: "#E4F5EC", amberBg: "#FCEFD8", torqueBg: "#E9EFFC", redBg: "#FBE7E5",
};
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

// Real bilingual support (new) -- this portal's own README flagged
// English-only as the #1 next step, unlike apps/supplier-portal, which
// already has real EN/ZH support. Same established pattern: a flat
// STRINGS dict keyed by lang, a LangContext (langContext.js) so both
// LoginPage and the authenticated shell share one toggle.
const STRINGS = {
  zh: {
    appName: "LEAP 质检中心", logout: "退出登录", checkingSession: "正在检查登录状态…",
    login: {
      subtitle: "质检中心员工登录", email: "邮箱", password: "密码",
      signIn: "登录", signingIn: "登录中…",
      restricted: "仅限 Leap 质检中心员工访问。",
      noAccess: "该账号没有质检中心访问权限。",
    },
    steps: {
      awaiting_receipt: { label: "待接收", actionLabel: "确认已接收", promptTitle: "接收此包裹", promptHint: "请在拆封前拍摄包裹外观照片。" },
      received: { label: "已接收", actionLabel: "确认已拆封", promptTitle: "拆封包裹", promptHint: "请拍摄拆封后的内容物照片。" },
      opened: { label: "已拆封", actionLabel: "确认已质检", promptTitle: "检查商品", promptHint: "请清晰拍摄商品照片——朝向、侧面及任何 OEM 标识。" },
      inspected: { label: "已质检", actionLabel: "确认已打包", promptTitle: "为买家打包", promptHint: "请拍摄重新打包完毕、准备发货的商品照片。" },
      packed: { label: "已打包", actionLabel: "确认已发货", promptTitle: "发货给买家", promptHint: "请拍摄最终包裹面单照片，并填写运单号。" },
      shipped_to_buyer: { label: "已发货给买家" },
      delivered: { label: "已送达" },
      flagged: { label: "已标记问题" },
    },
    filters: { all: "全部", awaiting_receipt: "待接收", in_progress: "处理中", shipped_to_buyer: "已发货", delivered: "已送达", flagged: "已标记" },
    queue: {
      title: "入库包裹", shownCount: (n, m) => `共 ${m} 个，显示 ${n} 个`, loading: "加载中…", empty: "暂无内容。",
      searchPlaceholder: "按订单号或供应商搜索…",
    },
    photoPicker: { addPhoto: "添加照片" },
    detail: {
      items: "商品清单", evidencePhotos: "凭证照片（至少 1 张）", notes: "备注（可选）",
      trackingNumber: "寄给买家的运单号", saving: "保存中…",
      flagInstead: "改为标记质量问题", flagTitle: "标记质量问题",
      flagDesc: "商品错发、损坏、车型不符——请描述问题并拍照。此信息将直接发送给 Leap 平台团队。",
      whatsWrong: "问题描述", submitFlag: "提交标记", cancel: "取消",
      confirmDeliveredTitle: "确认已送达",
      confirmDeliveredHint: "优先使用真实物流轨迹确认——物流商确认后系统会自动标记为已送达。仅当轨迹未更新且你有确切、独立的证据证明买家已收货时，才手动在此确认。",
      deliveryNotePlaceholder: "例如：物流轨迹未更新，买家已通过聊天确认收货",
      confirming: "确认中…", confirmDelivered: "确认已送达",
      flaggedBanner: "此包裹已标记问题，等待平台审核。",
      completedBanner: "此包裹已完成送达买家的全部流程。",
      history: "历史记录", noSteps: "暂无记录步骤。",
      tracking: (n) => `运单号：${n}`, by: (name) => `操作人：${name}`,
      errPhotoRequired: "此步骤至少需要 1 张凭证照片。",
      errTrackingRequired: "最后的发货步骤需要填写运单号。",
      errDeliveryNoteRequired: "需填写简短说明（例如为何真实物流轨迹未确认送达）。",
    },
  },
  en: {
    appName: "LEAP HUB", logout: "Log out", checkingSession: "Checking session…",
    login: {
      subtitle: "Inspection hub sign-in", email: "Email", password: "Password",
      signIn: "Sign in", signingIn: "Signing in…",
      restricted: "Access is restricted to Leap inspection hub staff.",
      noAccess: "This account doesn't have inspection hub access.",
    },
    steps: {
      awaiting_receipt: { label: "Awaiting receipt", actionLabel: "Confirm Received", promptTitle: "Receiving this shipment", promptHint: "Photograph the package as it arrives, before opening it." },
      received: { label: "Received", actionLabel: "Confirm Opened", promptTitle: "Opening the package", promptHint: "Photograph the contents once opened." },
      opened: { label: "Opened", actionLabel: "Confirm Inspected", promptTitle: "Inspecting the item", promptHint: "Photograph the part clearly — orientation, side, and any OEM markings." },
      inspected: { label: "Inspected", actionLabel: "Confirm Packed", promptTitle: "Packing for the buyer", promptHint: "Photograph the item repackaged and ready to ship." },
      packed: { label: "Packed", actionLabel: "Confirm Shipped", promptTitle: "Shipping to the buyer", promptHint: "Photograph the final package label, and enter the tracking number." },
      shipped_to_buyer: { label: "Shipped to buyer" },
      delivered: { label: "Delivered" },
      flagged: { label: "Flagged" },
    },
    filters: { all: "All", awaiting_receipt: "Awaiting receipt", in_progress: "In progress", shipped_to_buyer: "Shipped", delivered: "Delivered", flagged: "Flagged" },
    queue: {
      title: "Inbound shipments", shownCount: (n, m) => `${n} of ${m} shown`, loading: "Loading…", empty: "Nothing here right now.",
      searchPlaceholder: "Search by order ID or supplier…",
    },
    photoPicker: { addPhoto: "Add photo" },
    detail: {
      items: "Items", evidencePhotos: "Evidence photos (at least 1)", notes: "Notes (optional)",
      trackingNumber: "Tracking number to buyer", saving: "Saving…",
      flagInstead: "Flag a quality issue instead", flagTitle: "Flag a quality issue",
      flagDesc: "Wrong item, damage, mismatched fitment — describe what's wrong and photograph it. This goes straight to the Leap platform team.",
      whatsWrong: "What's wrong", submitFlag: "Submit flag", cancel: "Cancel",
      confirmDeliveredTitle: "Confirm delivered",
      confirmDeliveredHint: "Real carrier tracking is the preferred way to confirm this — a real webhook will mark this delivered automatically once the carrier confirms it. Only confirm here yourself if that hasn't happened and you have real, independent confirmation the buyer received it.",
      deliveryNotePlaceholder: "e.g. tracking never updated, buyer confirmed receipt via chat",
      confirming: "Confirming…", confirmDelivered: "Confirm delivered",
      flaggedBanner: "This shipment is flagged and awaiting platform review.",
      completedBanner: "This shipment has completed its journey to the buyer.",
      history: "History", noSteps: "No steps recorded yet.",
      tracking: (n) => `Tracking: ${n}`, by: (name) => `by ${name}`,
      errPhotoRequired: "At least 1 evidence photo is required for this step.",
      errTrackingRequired: "A tracking number is required for the final shipping step.",
      errDeliveryNoteRequired: "A short note is required (e.g. why real carrier tracking didn't confirm it).",
    },
  },
};

// Real Brand/Model/Generation(Year)-style step metadata -- language-
// INDEPENDENT data only now (icon, next step); all text moved into
// STRINGS above, looked up via t.steps[status] at each real usage site.
const STEP_INFO = {
  awaiting_receipt: { next: "received", icon: Inbox },
  received: { next: "opened", icon: PackageOpen },
  opened: { next: "inspected", icon: SearchIcon },
  inspected: { next: "packed", icon: PackagePlus },
  packed: { next: "shipped_to_buyer", icon: Truck },
  shipped_to_buyer: { next: null, icon: ClipboardCheck },
  delivered: { next: null, icon: PackageCheck },
  flagged: { next: null, icon: AlertTriangle },
};
const STATUS_COLOR = {
  awaiting_receipt: [C.amber, C.amberBg], received: [C.torque, C.torqueBg], opened: [C.torque, C.torqueBg],
  inspected: [C.torque, C.torqueBg], packed: [C.torque, C.torqueBg], shipped_to_buyer: [C.gauge, C.gaugeBg],
  delivered: [C.gauge, C.gaugeBg],
  flagged: [C.red, C.redBg],
};

function Badge({ status }) {
  const { t } = useLang();
  const [color, bg] = STATUS_COLOR[status] || [C.muted, "#EEEFF1"];
  const label = t.steps[status]?.label || status;
  return (
    <span style={{ ...body, fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 6, padding: "4px 9px", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <div style={{ display: "flex", border: "1px solid #3A3F48", borderRadius: 8, overflow: "hidden" }}>
      {["zh", "en"].map((l) => (
        <button key={l} onClick={() => lang !== l && toggle()} style={{
          border: "none", cursor: "pointer", padding: "5px 10px", fontSize: 11, fontWeight: 700,
          fontFamily: l === "zh" ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif",
          background: lang === l ? "#fff" : "transparent", color: lang === l ? C.ink : "#9AA1AC",
        }}>{l === "zh" ? "中文" : "EN"}</button>
      ))}
    </div>
  );
}

function TopBar() {
  const { currentUser, onLogout } = useHub();
  const { t } = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.signal, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PackageCheck size={16} color="#fff" />
        </div>
        <div style={{ ...disp, fontSize: 18, fontWeight: 700, color: C.ink }}>{t.appName}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LangToggle />
        <div style={{ ...body, fontSize: 12.5, color: C.muted }}>{currentUser?.email}</div>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
          <LogOut size={13} /> {t.logout}
        </button>
      </div>
    </div>
  );
}

const FILTER_IDS = ["all", "awaiting_receipt", "in_progress", "shipped_to_buyer", "delivered", "flagged"];
const IN_PROGRESS_STATUSES = ["received", "opened", "inspected", "packed"];

function QueueScreen({ onOpenShipment }) {
  const { onSessionExpired } = useHub();
  const { t } = useLang();
  const [shipments, setShipments] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [filter, setFilter] = useState("all");
  // Real search (new) -- closes a real gap: with no way to look up a
  // specific shipment, a hub worker had to scroll a filtered list to
  // find one. Client-side over the already-fetched list -- a real
  // hub's own real queue is naturally bounded (their own assigned
  // shipments), so no new backend endpoint is needed for this.
  const [searchQuery, setSearchQuery] = useState("");

  const load = () => {
    setLoadState("loading");
    fetchMyShipments(getStoredToken())
      .then((data) => { setShipments(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = shipments.filter((s) => {
    if (filter === "all") { /* no status filter */ }
    else if (filter === "in_progress") { if (!IN_PROGRESS_STATUSES.includes(s.status)) return false; }
    else if (s.status !== filter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchesOrder = s.orderId && s.orderId.toLowerCase().includes(q);
      const matchesSupplier = s.supplierName && s.supplierName.toLowerCase().includes(q);
      if (!matchesOrder && !matchesSupplier) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink }}>{t.queue.title}</div>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>
          {loadState === "ready" ? t.queue.shownCount(filtered.length, shipments.length) : t.queue.loading}
        </div>
      </div>
      <div style={{ padding: "14px 20px 0" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.queue.searchPlaceholder}
          style={{ ...body, width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13 }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, padding: "14px 20px 0", overflowX: "auto" }}>
        {FILTER_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              ...body, padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${filter === id ? C.ink : C.line}`, background: filter === id ? C.ink : "#fff", color: filter === id ? "#fff" : C.ink,
            }}
          >{t.filters[id]}</button>
        ))}
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {loadState === "loading" && <div style={{ ...body, textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>{t.queue.loading}</div>}
        {loadState === "error" && <div style={{ ...body, textAlign: "center", padding: 32, color: C.red, fontSize: 13 }}>{errorMessage}</div>}
        {loadState === "ready" && filtered.length === 0 && (
          <div style={{ ...body, textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>{t.queue.empty}</div>
        )}
        {loadState === "ready" && filtered.map((s) => (
          <div
            key={s.id}
            onClick={() => onOpenShipment(s.id)}
            style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <div style={{ ...body, fontWeight: 700, fontSize: 14, color: C.ink }}>{s.orderId}</div>
              <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }}>{s.supplierName}</div>
            </div>
            <Badge status={s.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidencePhotoPicker({ photos, onAdd, onRemove, isUploading }) {
  const { t } = useLang();
  const handleSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of files) await onAdd(file);
  };
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {photos.map((p) => (
        <div key={p.url} style={{ position: "relative", width: 80, height: 80 }}>
          <img src={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}${p.url}`} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
          <button onClick={() => onRemove(p.url)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: C.red, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={12} />
          </button>
        </div>
      ))}
      <label style={{ width: 80, height: 80, borderRadius: 8, border: `1.5px dashed ${C.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: C.muted }}>
        {isUploading ? <span style={{ fontSize: 11 }}>…</span> : <Camera size={20} />}
        <span style={{ fontSize: 10, ...body }}>{t.photoPicker.addPhoto}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" style={{ display: "none" }} onChange={handleSelect} disabled={isUploading} />
      </label>
    </div>
  );
}

function ShipmentDetailScreen({ shipmentId, onBack }) {
  const { onSessionExpired } = useHub();
  const { t } = useLang();
  const [shipment, setShipment] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [notes, setNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [photos, setPhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");

  const load = () => {
    setLoadState("loading");
    fetchMyShipmentById(getStoredToken(), shipmentId)
      .then((data) => { setShipment(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, [shipmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddPhoto = async (file) => {
    setIsUploadingPhoto(true);
    setErrorMessage(null);
    try {
      const result = await uploadEvidencePhoto(getStoredToken(), file);
      setPhotos((prev) => [...prev, result]);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };
  const removePhoto = (url) => setPhotos((prev) => prev.filter((p) => p.url !== url));

  const submitStep = async (step) => {
    if (photos.length < 1) {
      setErrorMessage(t.detail.errPhotoRequired);
      return;
    }
    if (step === "shipped_to_buyer" && !trackingNumber.trim()) {
      setErrorMessage(t.detail.errTrackingRequired);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await recordShipmentEvent(getStoredToken(), shipmentId, {
        step, notes: notes.trim() || undefined, photos: photos.map((p) => p.url),
        trackingNumber: step === "shipped_to_buyer" ? trackingNumber.trim() : undefined,
      });
      setNotes(""); setTrackingNumber(""); setPhotos([]); setShowFlagForm(false);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitConfirmDelivery = async () => {
    if (!deliveryNote.trim()) {
      setErrorMessage(t.detail.errDeliveryNoteRequired);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await confirmDelivery(getStoredToken(), shipmentId, deliveryNote.trim());
      setDeliveryNote("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadState === "loading") {
    return <div style={{ padding: 40, textAlign: "center", ...body, color: C.muted, fontSize: 13 }}>{t.queue.loading}</div>;
  }
  if (loadState === "error" && !shipment) {
    return <div style={{ padding: 40, textAlign: "center", ...body, color: C.red, fontSize: 13 }}>{errorMessage}</div>;
  }

  const info = STEP_INFO[shipment.status];
  const stepText = t.steps[shipment.status];
  // CONFIRMED (migration 027): "shipped_to_buyer" is no longer the real
  // terminal state -- a real "Confirm Delivered" action (or real
  // carrier tracking) still needs to happen from here. Only "delivered"
  // and "flagged" are genuinely final now.
  const isTerminal = shipment.status === "delivered" || shipment.status === "flagged";
  const needsDeliveryConfirmation = shipment.status === "shipped_to_buyer";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={22} color={C.ink} /></button>
        <div>
          <div style={{ ...disp, fontSize: 18, fontWeight: 700, color: C.ink }}>{shipment.orderId}</div>
          <div style={{ ...body, fontSize: 11.5, color: C.muted }}>{shipment.supplierName}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><Badge status={shipment.status} /></div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
          <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>{t.detail.items.toUpperCase()}</div>
          {shipment.items.map((item, i) => (
            <div key={i} style={{ ...body, fontSize: 13, color: C.ink, padding: "4px 0" }}>{item.name} × {item.quantity}</div>
          ))}
        </div>

        {errorMessage && (
          <div style={{ ...body, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{errorMessage}</div>
        )}

        {!isTerminal && !showFlagForm && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
            <div style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{stepText.promptTitle}</div>
            <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 16 }}>{stepText.promptHint}</div>

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>{t.detail.evidencePhotos.toUpperCase()}</div>
            <EvidencePhotoPicker photos={photos} onAdd={handleAddPhoto} onRemove={removePhoto} isUploading={isUploadingPhoto} />

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "16px 0 8px" }}>{t.detail.notes.toUpperCase()}</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...body, width: "100%", boxSizing: "border-box", height: 64, borderRadius: 8, border: `1px solid ${C.line}`, padding: 10, fontSize: 13, resize: "none" }}
            />

            {info.next === "shipped_to_buyer" && (
              <>
                <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "16px 0 8px" }}>{t.detail.trackingNumber.toUpperCase()}</div>
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  style={{ ...body, width: "100%", boxSizing: "border-box", borderRadius: 8, border: `1px solid ${C.line}`, padding: "10px 12px", fontSize: 13 }}
                />
              </>
            )}

            <button
              onClick={() => submitStep(info.next)}
              disabled={isSubmitting}
              style={{ ...body, width: "100%", marginTop: 18, padding: "13px 16px", borderRadius: 9, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: isSubmitting ? "default" : "pointer" }}
            >
              {isSubmitting ? t.detail.saving : stepText.actionLabel}
            </button>
            <button
              onClick={() => { setShowFlagForm(true); setPhotos([]); setNotes(""); setErrorMessage(null); }}
              style={{ ...body, width: "100%", marginTop: 8, padding: "11px 16px", borderRadius: 9, border: `1px solid ${C.red}`, background: "#fff", color: C.red, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {t.detail.flagInstead}
            </button>
          </div>
        )}

        {!isTerminal && showFlagForm && (
          <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={17} color={C.red} />
              <div style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink }}>{t.detail.flagTitle}</div>
            </div>
            <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 16 }}>
              {t.detail.flagDesc}
            </div>

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>{t.detail.evidencePhotos.toUpperCase()}</div>
            <EvidencePhotoPicker photos={photos} onAdd={handleAddPhoto} onRemove={removePhoto} isUploading={isUploadingPhoto} />

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "16px 0 8px" }}>{t.detail.whatsWrong.toUpperCase()}</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...body, width: "100%", boxSizing: "border-box", height: 64, borderRadius: 8, border: `1px solid ${C.line}`, padding: 10, fontSize: 13, resize: "none" }}
            />

            <button
              onClick={() => submitStep("flagged")}
              disabled={isSubmitting}
              style={{ ...body, width: "100%", marginTop: 18, padding: "13px 16px", borderRadius: 9, border: "none", background: isSubmitting ? "#D1D5DB" : C.red, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: isSubmitting ? "default" : "pointer" }}
            >
              {isSubmitting ? t.detail.saving : t.detail.submitFlag}
            </button>
            <button onClick={() => setShowFlagForm(false)} style={{ ...body, width: "100%", marginTop: 8, padding: "11px 16px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t.detail.cancel}
            </button>
          </div>
        )}

        {needsDeliveryConfirmation && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <PackageCheck size={18} color={C.ink} />
              <div style={{ ...disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{t.detail.confirmDeliveredTitle}</div>
            </div>
            <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 10 }}>
              {t.detail.confirmDeliveredHint}
            </div>
            <textarea
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder={t.detail.deliveryNotePlaceholder}
              style={{ ...body, width: "100%", minHeight: 60, padding: 10, borderRadius: 8, border: `1px solid ${C.line}`, marginBottom: 10, resize: "vertical", boxSizing: "border-box" }}
            />
            <button
              disabled={isSubmitting || !deliveryNote.trim()}
              onClick={submitConfirmDelivery}
              style={{ ...body, width: "100%", padding: 12, borderRadius: 8, border: "none", background: (isSubmitting || !deliveryNote.trim()) ? "#D1D5DB" : C.gauge, color: "#fff", fontSize: 13, fontWeight: 700, cursor: (isSubmitting || !deliveryNote.trim()) ? "default" : "pointer" }}
            >{isSubmitting ? t.detail.confirming : t.detail.confirmDelivered}</button>
          </div>
        )}

        {isTerminal && (
          <div style={{ background: shipment.status === "flagged" ? C.redBg : C.gaugeBg, borderRadius: 10, padding: 14, ...body, fontSize: 13, color: shipment.status === "flagged" ? C.red : C.gauge, fontWeight: 700 }}>
            {shipment.status === "flagged" ? t.detail.flaggedBanner : t.detail.completedBanner}
          </div>
        )}

        <div>
          <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>{t.detail.history.toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shipment.events.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>{t.detail.noSteps}</div>}
            {shipment.events.map((e) => {
              const stepInfo = STEP_INFO[e.step];
              const eventStepText = t.steps[e.step];
              const Icon = stepInfo?.icon || ClipboardCheck;
              return (
                <div key={e.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon size={14} color={e.step === "flagged" ? C.red : C.ink} />
                    <span style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{eventStepText?.label || e.step}</span>
                    <span style={{ ...body, fontSize: 11, color: C.muted, marginLeft: "auto" }}>{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.notes && <div style={{ ...body, fontSize: 12.5, color: C.ink, marginBottom: 8 }}>{e.notes}</div>}
                  {e.trackingNumber && <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 8 }}>{t.detail.tracking(e.trackingNumber)}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {e.photos.map((url, i) => (
                      <img key={i} src={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}${url}`} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
                    ))}
                  </div>
                  <div style={{ ...body, fontSize: 10.5, color: C.muted, marginTop: 6 }}>{t.detail.by(e.performedBy)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HubShell() {
  const [openShipmentId, setOpenShipmentId] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: C.canvas }}>
      <TopBar />
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {openShipmentId
          ? <ShipmentDetailScreen shipmentId={openShipmentId} onBack={() => setOpenShipmentId(null)} />
          : <QueueScreen onOpenShipment={setOpenShipmentId} />}
      </div>
    </div>
  );
}

export default function LeapHubPortalApp() {
  const [lang, setLang] = useState("zh");
  const t = STRINGS[lang];
  const toggle = () => setLang((l) => (l === "zh" ? "en" : "zh"));

  const [authState, setAuthState] = useState({ status: "checking", user: null });

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthState({ status: "loggedOut", user: null });
      return;
    }
    getCurrentUser(token)
      .then((user) => {
        if (user.role !== "hub_staff") {
          clearToken();
          setAuthState({ status: "loggedOut", user: null });
          return;
        }
        setAuthState({ status: "loggedIn", user });
      })
      .catch(() => {
        clearToken();
        setAuthState({ status: "loggedOut", user: null });
      });
  }, []);

  const handleLoginSuccess = (token, user) => {
    saveToken(token);
    setAuthState({ status: "loggedIn", user });
  };
  const handleLogout = () => {
    clearToken();
    setAuthState({ status: "loggedOut", user: null });
  };

  return (
    <LangContext.Provider value={{ lang, t, toggle }}>
      {authState.status === "checking" && (
        <div style={{ ...body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: C.muted, fontSize: 13 }}>{t.checkingSession}</div>
      )}
      {authState.status === "loggedOut" && <LoginPage onLoginSuccess={handleLoginSuccess} />}
      {authState.status === "loggedIn" && (
        <HubContext.Provider value={{ currentUser: authState.user, onLogout: handleLogout, onSessionExpired: handleLogout }}>
          <HubShell />
        </HubContext.Provider>
      )}
    </LangContext.Provider>
  );
}
