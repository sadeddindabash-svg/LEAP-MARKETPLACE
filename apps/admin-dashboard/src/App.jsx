import React, { useState, useEffect, createContext, useContext } from "react";
import LoginPage from "./LoginPage";
import { exportToExcel } from "./exportToExcel";
import { getStoredToken, saveToken, clearToken, getCurrentUser, fetchOrders, fetchOrderById, fetchSuppliers, verifySupplier, fetchModerationQueue, moderateProduct, bulkModerateProducts, fetchTickets, fetchTicketById, replyToTicket, updateTicketStatus, fetchReturnCases, fetchReturnCaseById, replyToReturnCaseBuyer, replyToReturnCaseSupplier, updateReturnCaseStatus, fetchOverview, API_BASE_URL, SessionExpiredError,
  fetchBrands, fetchModelsForBrand, fetchGenerationsForModel, fetchEnginesForGeneration, fetchTransmissionsForGeneration,
  createBrand, deleteBrand, createModel, deleteModel, createGeneration, deleteGeneration, createEngine, deleteEngine, createTransmission, deleteTransmission,
  fetchHubLocations, createHubLocation, deleteHubLocation, assignHubToSubOrder,
  fetchFeeComponents, createFeeComponent, updateFeeComponent, deleteFeeComponent, moveFeeComponent, fetchFxRate, updateFxRate, fetchFxRateMode, updateFxRateMode, previewPricing,
  fetchFlaggedShipments,
  fetchCategories, createCategory, deleteCategory, fetchPartsForCategory, createPart, deletePart,
  fetchSupplierMessagesInbox, fetchSupplierMessageThread, sendSupplierMessage,
  fetchPromoCodes, createPromoCode, updatePromoCode, deletePromoCode,
  fetchAdminUsers, createAdminUser, updateAdminPermissions, deleteAdminUser,
  fetchPayoutsOwed, fetchPayoutHistory, recordPayout, fetchSupplierPayoutMethod, fetchReturnWindow, updateReturnWindow, updateCategoryCommission,
  fetchPendingReviews, moderateReview, fetchRequireVerifiedPurchase, updateRequireVerifiedPurchase,
  fetchAuditLog,
  fetchSupplierAnalytics,
  fetchHubWorkload, updateHubCapacity,
  fetchHubPerformance,
  fetchFlaggedReviews, dismissReviewFlags,
} from "./auth";
import {
  LayoutGrid, ShoppingBag, Store, PackageSearch, Wallet, LifeBuoy, Settings,
  Search, Bell, ChevronDown, ChevronUp, ChevronRight, TrendingUp, TrendingDown, Truck, Plus,
  CheckCircle2, XCircle, Clock, AlertTriangle, MoreHorizontal, ArrowUpRight,
  Filter as FilterIcon, Download, Check, X, MessageSquare, Star, Globe, Users,
  CreditCard, ExternalLink, ChevronLeft, RotateCcw, Warehouse, Calculator, Layers, Send, Tag
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

/* ============================================================
   LEAP OPS — token system (shared brand, ops-tool execution)
   Color:  Asphalt #14171C (chrome/sidebar) · Cloud #F5F6F8 (canvas)
           Signal #E8622C (primary action / attention) · Torque #2A5FD9 (data / links)
           Gauge #1E9D6B (success) · Amber #B9791F (pending) · Red #C0362C (risk)
   Type:   Barlow Condensed (numerals/headings) · Inter (UI/body) · JetBrains Mono (codes/IDs)
   Signature: "plate chip" tags for order/supplier/tracking codes — same device as the buyer app.
   ============================================================ */

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";

const C = {
  ink: "#14171C",
  panel: "#1B1F26",
  canvas: "#F5F6F8",
  card: "#FFFFFF",
  line: "#E4E6EA",
  lineDark: "#2A2F38",
  signal: "#E8622C",
  torque: "#2A5FD9",
  gauge: "#1E9D6B",
  amber: "#B9791F",
  red: "#C0362C",
  muted: "#6B7280",
  gaugeBg: "#E4F5EC",
  amberBg: "#FCEFD8",
  torqueBg: "#E9EFFC",
  redBg: "#FBE7E5",
};
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

/* ---------------- Mock data ---------------- */
// GMV_TREND and CATEGORY_SPLIT mock arrays removed — OverviewPage now
// fetches real aggregate data from GET /overview. See that endpoint's
// header comment for why GMV (a blended dollar figure) was deliberately
// NOT replicated with real data — it would require FX conversion across
// 26+ currencies that doesn't exist anywhere in this system yet.

const ORDER_STATUS_META = {
  to_pay: { label: "To pay", color: C.amber, bg: C.amberBg },
  to_ship: { label: "To ship", color: C.torque, bg: C.torqueBg },
  processing: { label: "Processing", color: C.amber, bg: C.amberBg },
  shipped: { label: "Shipped", color: C.torque, bg: C.torqueBg },
  delivered: { label: "Delivered", color: C.gauge, bg: C.gaugeBg },
  to_review: { label: "Awaiting review", color: C.amber, bg: C.amberBg },
  dispute: { label: "Dispute", color: C.red, bg: C.redBg },
  returns: { label: "Returns", color: C.red, bg: C.redBg },
};
// Falls back gracefully for any status the backend returns that isn't
// mapped above yet, rather than throwing — real API data can drift from
// what a UI was built against.
function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || "Unknown", color: C.muted, bg: "#EEEFF1" };
}

/* ---------------- shared bits ---------------- */

function PlateChip({ children, small }) {
  return (
    <span style={{
      ...mono, border: `1.5px solid ${C.ink}`, color: C.ink, display: "inline-flex", alignItems: "center",
      padding: small ? "2px 7px" : "4px 10px", borderRadius: 6, fontSize: small ? 10.5 : 12, fontWeight: 700,
      letterSpacing: "0.05em",
    }}>{children}</span>
  );
}
function Badge({ label, color, bg }) {
  return <span style={{ ...body, background: bg, color, fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{label}</span>;
}
function Stars({ rating }) {
  if (rating == null) return <span style={{ ...body, fontSize: 11.5, color: C.muted }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Star size={12} fill={C.amber} color={C.amber} />
      <span style={{ ...body, fontSize: 12, fontWeight: 600, color: C.ink }}>{rating}</span>
    </span>
  );
}

function KpiCard({ label, value, delta, positive, icon: Icon }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ ...body, fontSize: 11.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
        <Icon size={16} color={C.muted} />
      </div>
      <div style={{ ...disp, fontSize: 28, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {positive ? <TrendingUp size={13} color={C.gauge} /> : <TrendingDown size={13} color={C.red} />}
        <span style={{ ...body, fontSize: 12, fontWeight: 600, color: positive ? C.gauge : C.red }}>{delta}</span>
        <span style={{ ...body, fontSize: 11.5, color: C.muted }}>vs last week</span>
      </div>
    </div>
  );
}

function Card({ title, action, children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <span style={{ ...disp, fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Th({ children, align }) {
  return <th style={{ ...body, textAlign: align || "left", fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", padding: "10px 16px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, align, style }) {
  return <td style={{ ...body, fontSize: 13, color: C.ink, padding: "13px 16px", borderBottom: `1px solid ${C.line}`, textAlign: align || "left", ...style }}>{children}</td>;
}

// Real, minimal context (new) -- so TopBar (rendered once per page, ~20
// call sites, each only passing title/subtitle) can read the real
// logged-in admin without threading currentUser through every single
// page component's props. Provided once, at AdminDashboardShell.
const CurrentUserContext = createContext(null);

// REAL BUG FOUND AND FIXED HERE: this previously always showed a
// hardcoded "Omar M. / Ops Admin" placeholder, regardless of who was
// actually logged in -- flagged as a known gap in this project's own
// README for a while, never fixed until now. Now reads the real
// logged-in admin via CurrentUserContext (same currentUser already
// used correctly in the sidebar footer below).
function TopBar({ title, subtitle }) {
  const currentUser = useContext(CurrentUserContext);
  const displayName = currentUser?.name || currentUser?.email || "Admin";
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || "A";
  const roleLabel = currentUser?.isOwner ? "Owner" : "Admin";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
      <div>
        <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink }}>{title}</div>
        {subtitle && <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.canvas, borderRadius: 8, padding: "8px 12px", width: 260 }}>
          <Search size={14} color={C.muted} />
          <span style={{ ...body, fontSize: 12.5, color: C.muted }}>Search orders, suppliers, tickets…</span>
        </div>
        <Bell size={18} color={C.ink} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...body, fontWeight: 700, fontSize: 12.5 }}>{initials}</div>
          <div>
            <div style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{displayName}</div>
            <div style={{ ...body, fontSize: 10.5, color: C.muted }}>{roleLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pages ---------------- */

// Matches the mobile app's real category IDs (see
// apps/mobile/lib/features/home/home_screen.dart kCategories) so labels
// are consistent across apps.
const CATEGORY_LABELS = {
  brake: "Brake System", engine: "Engine", electrical: "Electrical",
  filters: "Filters", suspension: "Suspension", lighting: "Lighting",
};
const CATEGORY_COLORS = [C.signal, C.torque, C.gauge, C.amber, "#9AA1AC", "#6E7681"];

// Real supplier analytics (confirmed scope, picked from a list of 10
// real options): revenue+volume over time, top-selling products,
// order status breakdown, low-stock products at a glance, and payout
// summary. Confirmed scope for the admin side: an admin picks any one
// real supplier to view, not a platform-wide aggregate -- same real
// shape as the supplier portal's own equivalent section, which shows
// this same data forced to that supplier's own account.
function SupplierAnalyticsPicker({ onSessionExpired }) {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loadState, setLoadState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchSuppliers(getStoredToken())
      .then((data) => setSuppliers(data))
      .catch((err) => {
        if (err instanceof SessionExpiredError) onSessionExpired();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (id) => {
    setSelectedId(id);
    if (!id) { setAnalytics(null); return; }
    setLoadState("loading");
    setErrorMessage(null);
    fetchSupplierAnalytics(getStoredToken(), id)
      .then((data) => { setAnalytics(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };

  const revenueTrend = analytics ? analytics.revenueAndVolume.map((d) => ({
    d: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    revenue: d.revenue,
  })) : [];

  return (
    <Card
      title="Supplier analytics"
      action={
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5 }}
        >
          <option value="">Select a supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      }
    >
      <div style={{ padding: 16 }}>
        {loadState === "idle" && <div style={{ ...body, fontSize: 12.5, color: C.muted, textAlign: "center", padding: 20 }}>Pick a supplier above to see their analytics.</div>}
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, textAlign: "center", padding: 20 }}>Loading…</div>}
        {loadState === "error" && <div style={{ ...body, fontSize: 12.5, color: C.red, textAlign: "center", padding: 20 }}>{errorMessage}</div>}
        {loadState === "ready" && analytics && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <div style={{ ...body, fontSize: 11, color: C.muted, fontWeight: 600 }}>Total paid out</div>
                <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink, marginTop: 2 }}>${analytics.payoutSummary.totalPaid.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ ...body, fontSize: 11, color: C.muted, fontWeight: 600 }}>Current amount owed</div>
                <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: analytics.payoutSummary.amountOwed > 0 ? C.gauge : C.ink, marginTop: 2 }}>${analytics.payoutSummary.amountOwed.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ height: 180 }}>
              {revenueTrend.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", ...body, fontSize: 12.5, color: C.muted }}>No revenue in the last 30 days.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.muted }} axisLine={{ stroke: C.line }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                    <Bar dataKey="revenue" fill={C.signal} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...body, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Top-selling products</div>
                {analytics.topProducts.length === 0 && <div style={{ ...body, fontSize: 12, color: C.muted }}>No sales data yet.</div>}
                {analytics.topProducts.map((p) => (
                  <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: C.muted }}>{p.unitsSold} units · ${p.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...body, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Order status breakdown</div>
                {analytics.statusBreakdown.map((s) => {
                  const total = analytics.statusBreakdown.reduce((sum, x) => sum + x.count, 0);
                  const pct = total > 0 ? (s.count / total) * 100 : 0;
                  return (
                    <div key={s.status} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                        <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{s.status.replace(/_/g, " ")}</span>
                        <span style={{ color: C.muted }}>{s.count}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: C.line, overflow: "hidden", marginTop: 2 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: C.signal, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {analytics.lowStockProducts.length > 0 && (
              <div>
                <div style={{ ...body, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Low-stock products</div>
                {analytics.lowStockProducts.slice(0, 6).map((p) => (
                  <div key={p.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color: p.stockQuantity === 0 ? C.red : C.amber }}>{p.stockQuantity} / {p.lowStockThreshold}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function OverviewPage({ onSessionExpired }) {
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchOverview(getStoredToken())
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
        <TopBar title="Overview" subtitle="Loading…" />
        <div style={{ padding: 24 }}><Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading dashboard…</div></Card></div>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div>
        <TopBar title="Overview" subtitle="" />
        <div style={{ padding: 24 }}><Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load the overview: {errorMessage}</div></Card></div>
      </div>
    );
  }

  const dayTrend = data.ordersByDay.map(d => ({ d: new Date(d.day).toLocaleDateString(undefined, { weekday: "short" }), v: d.count }));
  const totalUnits = data.unitsByCategory.reduce((sum, c) => sum + c.units, 0);
  const categorySplit = data.unitsByCategory.map((c, i) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    value: totalUnits > 0 ? Math.round((c.units / totalUnits) * 100) : 0,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <div>
      <TopBar title="Overview" subtitle="Real counts across the platform — see README for what's intentionally not shown yet (blended $ GMV, top markets by country)" />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <SupplierAnalyticsPicker onSessionExpired={onSessionExpired} />

        <div style={{ display: "flex", gap: 16 }}>
          <KpiCard label="Total orders" value={data.totalOrders.toLocaleString()} icon={ShoppingBag} />
          <KpiCard label="Active suppliers" value={data.activeSuppliers.toLocaleString()} icon={Store} />
          <KpiCard label="Open disputes" value={data.openDisputes.toLocaleString()} icon={AlertTriangle} />
          <KpiCard label="Open tickets" value={data.openTickets.toLocaleString()} icon={LifeBuoy} />
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <Card title="Orders per day (last 7 days)" style={{ flex: 2 }}>
            <div style={{ padding: "16px 18px 8px", height: 220 }}>
              {dayTrend.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", ...body, fontSize: 12.5, color: C.muted }}>No orders in the last 7 days.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dayTrend} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.signal} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={C.signal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.muted, fontFamily: "Inter" }} axisLine={{ stroke: C.line }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, "Orders"]} contentStyle={{ fontFamily: "Inter", fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                    <Area type="monotone" dataKey="v" stroke={C.signal} strokeWidth={2.5} fill="url(#ordersFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
          <Card title="Units sold by category" style={{ flex: 1 }}>
            {categorySplit.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 12.5, color: C.muted }}>No sales data yet.</div>
            ) : (
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categorySplit} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={2}>
                        {categorySplit.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {categorySplit.map(c => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                      <span style={{ ...body, fontSize: 11.5, color: C.ink }}>{c.name}</span>
                      <span style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: "auto", paddingLeft: 10 }}>{c.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <Card title="Needs attention" style={{ flex: 1 }}>
            <div style={{ padding: 6 }}>
              <AttentionRow icon={AlertTriangle} color={C.red} text={`${data.openDisputes} return case(s) awaiting resolution`} sub="See the Returns page" />
              <AttentionRow icon={PackageSearch} color={C.amber} text={`${data.pendingModeration} listing(s) pending moderation`} sub="See the Moderation page" />
              <AttentionRow icon={Store} color={C.torque} text={`${data.pendingSuppliers} supplier(s) awaiting verification`} sub="See the Suppliers page" last />
            </div>
          </Card>
          <Card title="Top suppliers by order volume" style={{ flex: 1 }}>
            {data.topSuppliers.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 12.5, color: C.muted }}>No orders yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><Th>Supplier</Th><Th align="right">Orders</Th></tr></thead>
                <tbody>
                  {data.topSuppliers.map(s => (
                    <tr key={s.id}>
                      <Td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Store size={13} color={C.muted} />{s.name}</span></Td>
                      <Td align="right" style={{ fontWeight: 700 }}>{s.orderCount}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function AttentionRow({ icon: Icon, color, text, sub, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: last ? "none" : `1px solid ${C.line}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ ...body, fontSize: 12.5, fontWeight: 600, color: C.ink }}>{text}</div>
        <div style={{ ...body, fontSize: 11, color: C.muted }}>{sub}</div>
      </div>
      <ChevronRight size={15} color={C.muted} />
    </div>
  );
}

function OrdersPage({ onOpenOrder, onSessionExpired }) {
  const [orders, setOrders] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchOrders(getStoredToken())
      .then((data) => {
        if (cancelled) return;
        setOrders(data);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof SessionExpiredError) {
          onSessionExpired();
          return;
        }
        setErrorMessage(err.message);
        setLoadState("error");
      });
    return () => { cancelled = true; };
  }, [onSessionExpired]);

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const filters = [["all", "All"], ["to_ship", "To ship"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["dispute", "Disputes"]];

  return (
    <div>
      <TopBar title="Orders" subtitle={loadState === "ready" ? `${orders.length} orders across all suppliers` : "Loading…"} />
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {filters.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              ...body, padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${filter === id ? C.ink : C.line}`, background: filter === id ? C.ink : "#fff", color: filter === id ? "#fff" : C.ink,
            }}>{label}</button>
          ))}
        </div>
        <button
          disabled={filtered.length === 0}
          onClick={() => exportToExcel({
            filename: `orders-${filter}-${new Date().toISOString().slice(0, 10)}`,
            sheetName: "Orders",
            columns: [
              { header: "Order ID", key: "id", width: 16 },
              { header: "Buyer", key: "buyer", width: 30 },
              { header: "Total", key: "total", width: 12 },
              { header: "Currency", key: "currencyCode", width: 10 },
              { header: "Placed", key: "placedAt", width: 18 },
              { header: "Status", key: "status", width: 14 },
            ],
            rows: filtered.map((o) => ({
              id: o.id,
              buyer: o.userId || o.guestEmail || "—",
              total: Number(o.total),
              currencyCode: o.currencyCode,
              placedAt: new Date(o.placedAt).toLocaleDateString(),
              status: getOrderStatusMeta(o.status).label,
            })),
          })}
          style={{ ...body, display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: `1px solid ${C.line}`, background: "#fff", cursor: filtered.length === 0 ? "default" : "pointer", opacity: filtered.length === 0 ? 0.5 : 1 }}
        >
          <Download size={13} /> Export
        </button>
      </div>
      <div style={{ padding: 24 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading orders…</div></Card>}
        {loadState === "error" && (
          <Card>
            <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>
              Couldn't load orders: {errorMessage}
            </div>
          </Card>
        )}
        {loadState === "ready" && (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><Th>Order</Th><Th>Buyer</Th><Th align="right">Total</Th><Th>Placed</Th><Th>Status</Th><Th></Th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ ...body, textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>No orders match this filter.</td></tr>
                )}
                {filtered.map(o => {
                  const meta = getOrderStatusMeta(o.status);
                  return (
                    <tr key={o.id} onClick={() => onOpenOrder(o.id)} style={{ cursor: "pointer" }}>
                      <Td><PlateChip small>{o.id}</PlateChip></Td>
                      <Td>{o.userId || o.guestEmail || "—"}{!o.userId && o.guestEmail ? " (guest)" : ""}</Td>
                      <Td align="right" style={{ fontWeight: 700 }}>${Number(o.total).toFixed(2)} {o.currencyCode}</Td>
                      <Td style={{ color: C.muted }}>{new Date(o.placedAt).toLocaleDateString()}</Td>
                      <Td><Badge label={meta.label} color={meta.color} bg={meta.bg} /></Td>
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

// Real hub assignment + evidence trail, shown inline on each supplier
// sub-order in the Order detail page. If no hub is assigned yet, shows a
// real picker (an admin must assign one before the supplier can mark
// their leg 'shipped' — see services/api/README.md's Inspection Hubs
// section). If a hub_shipment already exists, shows the real status and
// the full step-by-step evidence trail (photos, notes, who, when).
//
// Uses a key tied to hubId at the call site (see below) to force a
// clean remount when a sub-order transitions from unassigned to
// assigned — found via testing that without this, the panel could fail
// to reliably reflect the new state after the interactive assign action,
// a real bug not just a test artifact.
function HubAssignmentPanel({ subOrder, onAssigned, onSessionExpired }) {
  const [hubs, setHubs] = useState([]);
  const [selectedHubId, setSelectedHubId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    if (!subOrder.hubId) {
      fetchHubLocations().then(setHubs).catch((e) => setErrorMessage(e.message));
    }
  }, [subOrder.hubId]);

  const handleAssign = async () => {
    if (!selectedHubId) return;
    setIsAssigning(true);
    setErrorMessage(null);
    try {
      await assignHubToSubOrder(getStoredToken(), subOrder.subOrderId, selectedHubId);
      onAssigned();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  if (!subOrder.hubId) {
    return (
      <div style={{ margin: "8px 0 0 25px", padding: 10, background: C.amberBg, borderRadius: 8 }}>
        <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.amber, marginBottom: 8 }}>
          NO INSPECTION HUB ASSIGNED — required before the supplier can ship
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={selectedHubId} onChange={(e) => setSelectedHubId(e.target.value)} style={{ ...body, flex: 1, border: `1px solid ${C.line}`, borderRadius: 7, padding: "7px 9px", fontSize: 12.5 }}>
            <option value="">Select a hub…</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.region})</option>)}
          </select>
          <button
            disabled={isAssigning || !selectedHubId}
            onClick={handleAssign}
            style={{ ...body, padding: "7px 14px", borderRadius: 7, border: "none", background: isAssigning || !selectedHubId ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isAssigning || !selectedHubId ? "default" : "pointer" }}
          >Assign</button>
        </div>
        {errorMessage && <div style={{ ...body, fontSize: 11.5, color: C.red, marginTop: 6 }}>{errorMessage}</div>}
      </div>
    );
  }

  const shipment = subOrder.hubShipment;
  return (
    <div style={{ margin: "8px 0 0 25px", padding: 10, background: C.canvas, borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted }}>HUB:</span>
        <span style={{ ...body, fontSize: 12, fontWeight: 700, color: C.ink }}>{subOrder.hubName}</span>
        {shipment && <Badge label={shipment.status.replace(/_/g, " ")} color={shipment.status === "flagged" ? C.red : shipment.status === "shipped_to_buyer" ? C.gauge : C.torque} bg={shipment.status === "flagged" ? C.redBg : shipment.status === "shipped_to_buyer" ? C.gaugeBg : C.torqueBg} />}
        {shipment && shipment.events.length > 0 && (
          <button onClick={() => setShowEvidence((v) => !v)} style={{ marginLeft: "auto", ...body, fontSize: 11.5, fontWeight: 700, color: C.torque, background: "none", border: "none", cursor: "pointer" }}>
            {showEvidence ? "Hide evidence" : `View evidence (${shipment.events.length})`}
          </button>
        )}
      </div>
      {!shipment && (
        <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 6 }}>Awaiting the supplier to ship this leg — no evidence yet.</div>
      )}
      {showEvidence && shipment && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {shipment.events.map((e) => (
            <div key={e.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...body, fontSize: 11.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                <span>{e.step.replace(/_/g, " ")}</span>
                <span style={{ color: C.muted, fontWeight: 400 }}>{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              {e.notes && <div style={{ ...body, fontSize: 12, color: C.ink, marginBottom: 6 }}>{e.notes}</div>}
              {e.trackingNumber && <div style={{ ...body, fontSize: 11.5, color: C.muted, marginBottom: 6 }}>Tracking: {e.trackingNumber}</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {e.photos.map((url, i) => (
                  <img key={i} src={`${API_BASE_URL}${url}`} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
                ))}
              </div>
              <div style={{ ...body, fontSize: 10.5, color: C.muted, marginTop: 6 }}>by {e.performedBy}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDetailPage({ orderId, onBack, onSessionExpired }) {
  const [order, setOrder] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  const load = () => {
    fetchOrderById(getStoredToken(), orderId)
      .then((data) => {
        setOrder(data);
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          onSessionExpired();
          return;
        }
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadState === "loading") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
          <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Order</div>
        </div>
        <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading order details…</div>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
          <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Order</div>
        </div>
        <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load this order: {errorMessage}</div>
      </div>
    );
  }

  const meta = getOrderStatusMeta(order.status);
  const buyerLabel = order.userId || order.guestEmail || "Unknown";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Order</div>
        <PlateChip>{order.id}</PlateChip>
        <Badge label={meta.label} color={meta.color} bg={meta.bg} />
      </div>
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Supplier sub-orders">
            <div style={{ padding: 6 }}>
              {order.supplierSubOrders.map((so, i) => (
                <div key={i} style={{ padding: "12px 12px", borderBottom: i < order.supplierSubOrders.length - 1 ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: so.items?.length ? 8 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Store size={15} color={C.muted} />
                      <span style={{ ...body, fontSize: 13, fontWeight: 600, color: C.ink }}>{so.supplierName || so.supplierId}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {so.trackingNumber && <PlateChip small>{so.trackingNumber}</PlateChip>}
                      <Badge label={getOrderStatusMeta(so.status).label} color={getOrderStatusMeta(so.status).color} bg={getOrderStatusMeta(so.status).bg} />
                    </div>
                  </div>
                  {so.items?.map((item, j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 6px 25px", ...body, fontSize: 12.5, color: C.muted }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span>${Number(item.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                  <HubAssignmentPanel key={so.hubId || "unassigned"} subOrder={so} onAssigned={load} onSessionExpired={onSessionExpired} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Buyer">
            <div style={{ padding: 16 }}>
              <div style={{ ...body, fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>{buyerLabel}</div>
              <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 10 }}>
                {order.isGuestOrder ? "Guest checkout" : "Registered account"}
              </div>
              <div style={{ ...body, fontSize: 12, color: C.muted }}>
                Placed {new Date(order.placedAt).toLocaleString()}
              </div>
            </div>
          </Card>
          <Card title="Actions">
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={{ ...body, padding: 10, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>Message buyer</button>
              <button style={{ ...body, padding: 10, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>Message supplier(s)</button>
              <button style={{ ...body, padding: 10, borderRadius: 8, border: `1px solid ${C.red}`, background: C.redBg, color: C.red, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>Issue refund</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SuppliersPage({ onSessionExpired }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const load = () => {
    setLoadState("loading");
    fetchSuppliers(getStoredToken())
      .then((data) => {
        setSuppliers(data);
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async (supplierId, status) => {
    setActioningId(supplierId);
    try {
      await verifySupplier(getStoredToken(), supplierId, status);
      // Re-fetch rather than optimistically patch local state — keeps
      // this in sync with whatever the server actually persisted.
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const verifiedCount = suppliers.filter(s => s.verificationStatus === "verified").length;
  const pendingCount = suppliers.filter(s => s.verificationStatus === "pending").length;

  return (
    <div>
      <TopBar title="Suppliers" subtitle={loadState === "ready" ? `${verifiedCount} verified · ${pendingCount} pending review` : "Loading…"} />
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end" }}>
        {/* Real export (new) -- same reusable exportToExcel() util already
            used for Orders/Payouts/Audit Log, just never added here. */}
        <button
          disabled={suppliers.length === 0}
          onClick={() => exportToExcel({
            filename: `suppliers-${new Date().toISOString().slice(0, 10)}`,
            sheetName: "Suppliers",
            columns: [
              { header: "Supplier", key: "name", width: 30 },
              { header: "Contact email", key: "contactEmail", width: 30 },
              { header: "Listings", key: "listingCount", width: 12 },
              { header: "Status", key: "verificationStatus", width: 16 },
              { header: "Joined", key: "createdAt", width: 16 },
            ],
            rows: suppliers.map((s) => ({
              name: s.name, contactEmail: s.contactEmail || "—", listingCount: s.listingCount,
              verificationStatus: s.verificationStatus, createdAt: new Date(s.createdAt).toLocaleDateString(),
            })),
          })}
          style={{ display: "flex", alignItems: "center", gap: 6, ...body, fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, cursor: suppliers.length === 0 ? "default" : "pointer", opacity: suppliers.length === 0 ? 0.5 : 1 }}
        >
          <Download size={13} /> Export
        </button>
      </div>
      <div style={{ padding: 24 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading suppliers…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load suppliers: {errorMessage}</div></Card>}
        {loadState === "ready" && (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><Th>Supplier</Th><Th>Contact</Th><Th align="right">Listings</Th><Th>Status</Th><Th>Joined</Th><Th></Th></tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <Td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Store size={13} color={C.muted} /><span style={{ fontWeight: 600 }}>{s.name}</span></span></Td>
                    <Td style={{ color: C.muted }}>{s.contactEmail || "—"}</Td>
                    <Td align="right">{s.listingCount.toLocaleString()}</Td>
                    <Td>
                      {s.verificationStatus === "verified" && <Badge label="Verified" color={C.gauge} bg={C.gaugeBg} />}
                      {s.verificationStatus === "pending" && <Badge label="Pending review" color={C.amber} bg={C.amberBg} />}
                      {s.verificationStatus === "rejected" && <Badge label="Rejected" color={C.red} bg={C.redBg} />}
                    </Td>
                    <Td style={{ color: C.muted }}>{new Date(s.createdAt).toLocaleDateString()}</Td>
                    <Td align="right">
                      {s.verificationStatus === "pending" ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            disabled={actioningId === s.id}
                            onClick={() => handleVerify(s.id, "verified")}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: C.gaugeBg, color: C.gauge, border: "none", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, cursor: actioningId === s.id ? "default" : "pointer", opacity: actioningId === s.id ? 0.5 : 1, ...body }}
                          ><Check size={12} />Approve</button>
                          <button
                            disabled={actioningId === s.id}
                            onClick={() => handleVerify(s.id, "rejected")}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: C.redBg, color: C.red, border: "none", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, cursor: actioningId === s.id ? "default" : "pointer", opacity: actioningId === s.id ? 0.5 : 1, ...body }}
                          ><X size={12} />Reject</button>
                        </div>
                      ) : <MoreHorizontal size={15} color={C.muted} />}
                    </Td>
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

function ModerationPage({ onSessionExpired }) {
  const [queue, setQueue] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null); // which item has the translation panel open
  const [nameEn, setNameEn] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");

  // Real bulk actions (new). Bulk reject is simple (no review needed,
  // matching the single-item reject flow). Bulk approve deliberately
  // does NOT skip the real translation-review gate -- selecting "Review
  // & approve selected" opens a real batch table where each item still
  // needs its own real reviewed English/Arabic name, just filled in
  // together in one screen instead of one page navigation at a time.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState("none"); // 'none' | 'reviewing_approve'
  const [bulkTranslations, setBulkTranslations] = useState({}); // { [productId]: { nameEn, descriptionEn, nameAr, descriptionAr } }
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkResultMessage, setBulkResultMessage] = useState(null);

  const load = () => {
    setLoadState("loading");
    fetchModerationQueue(getStoredToken())
      .then((data) => { setQueue(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openReview = (m) => {
    setReviewingId(m.id);
    setNameEn(m.nameZh || "");
    setDescriptionEn(m.descriptionZh || "");
    setNameAr("");
    setDescriptionAr("");
  };
  const cancelReview = () => { setReviewingId(null); setNameEn(""); setDescriptionEn(""); setNameAr(""); setDescriptionAr(""); };

  const confirmApproval = async (productId) => {
    // Both required, not just English — the confirmed 40-country launch
    // list includes the entire GCC plus Jordan, real markets where
    // Arabic isn't optional.
    const missing = [];
    if (!nameEn.trim()) missing.push("English name");
    if (!nameAr.trim()) missing.push("Arabic name");
    if (missing.length > 0) {
      setErrorMessage(`Enter the reviewed ${missing.join(" and ")} before approving.`);
      return;
    }
    setActioningId(productId);
    try {
      await moderateProduct(getStoredToken(), productId, "approve", {
        nameEn: nameEn.trim(), descriptionEn: descriptionEn.trim() || undefined,
        nameAr: nameAr.trim(), descriptionAr: descriptionAr.trim() || undefined,
      });
      cancelReview();
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (productId) => {
    setActioningId(productId);
    try {
      await moderateProduct(getStoredToken(), productId, "reject");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === queue.length ? new Set() : new Set(queue.map((m) => m.id))));
  };
  const clearSelection = () => { setSelectedIds(new Set()); setBulkMode("none"); };

  const handleBulkReject = async () => {
    setIsBulkSubmitting(true);
    setBulkResultMessage(null);
    try {
      const items = Array.from(selectedIds).map((productId) => ({ productId, action: "reject" }));
      const { results } = await bulkModerateProducts(getStoredToken(), items);
      const failCount = results.filter((r) => !r.success).length;
      setBulkResultMessage(failCount === 0 ? `${results.length} listing(s) rejected.` : `${results.length - failCount} rejected, ${failCount} failed.`);
      clearSelection();
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const openBulkApprovalReview = () => {
    const initial = {};
    queue.filter((m) => selectedIds.has(m.id)).forEach((m) => {
      initial[m.id] = { nameEn: m.nameZh || "", descriptionEn: m.descriptionZh || "", nameAr: "", descriptionAr: "" };
    });
    setBulkTranslations(initial);
    setBulkMode("reviewing_approve");
  };
  const updateBulkField = (productId, field, value) => {
    setBulkTranslations((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
  };

  const handleBulkApprove = async () => {
    const missing = Array.from(selectedIds).filter((id) => !bulkTranslations[id]?.nameEn?.trim() || !bulkTranslations[id]?.nameAr?.trim());
    if (missing.length > 0) {
      setErrorMessage(`${missing.length} item(s) are still missing a required English or Arabic name.`);
      return;
    }
    setIsBulkSubmitting(true);
    setErrorMessage(null);
    setBulkResultMessage(null);
    try {
      const items = Array.from(selectedIds).map((productId) => ({
        productId, action: "approve",
        nameEn: bulkTranslations[productId].nameEn.trim(),
        descriptionEn: bulkTranslations[productId].descriptionEn?.trim() || undefined,
        nameAr: bulkTranslations[productId].nameAr.trim(),
        descriptionAr: bulkTranslations[productId].descriptionAr?.trim() || undefined,
      }));
      const { results } = await bulkModerateProducts(getStoredToken(), items);
      const failCount = results.filter((r) => !r.success).length;
      setBulkResultMessage(failCount === 0 ? `${results.length} listing(s) approved.` : `${results.length - failCount} approved, ${failCount} failed — check each item's translation.`);
      clearSelection();
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <div>
      <TopBar title="Catalog moderation" subtitle={loadState === "ready" ? `${queue.length} listings awaiting review` : "Loading…"} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading moderation queue…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load the moderation queue: {errorMessage}</div></Card>}
        {loadState === "ready" && queue.length === 0 && (
          <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Nothing awaiting review right now.</div></Card>
        )}
        {errorMessage && loadState === "ready" && (
          <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{errorMessage}</div>
        )}
        {bulkResultMessage && (
          <div style={{ ...body, fontSize: 12, color: C.gauge, background: C.gaugeBg, borderRadius: 8, padding: 10 }}>{bulkResultMessage}</div>
        )}

        {loadState === "ready" && queue.length > 0 && bulkMode === "none" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 4px" }}>
            <label style={{ ...body, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={selectedIds.size === queue.length && queue.length > 0} onChange={toggleSelectAll} />
              Select all
            </label>
            {selectedIds.size > 0 && (
              <>
                <span style={{ ...body, fontSize: 12.5, color: C.muted }}>{selectedIds.size} selected</span>
                <button
                  disabled={isBulkSubmitting}
                  onClick={openBulkApprovalReview}
                  style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, border: "none", background: C.gaugeBg, color: C.gauge, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                ><Check size={13} />Review &amp; approve selected</button>
                <button
                  disabled={isBulkSubmitting}
                  onClick={handleBulkReject}
                  style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, border: "none", background: C.redBg, color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                ><X size={13} />{isBulkSubmitting ? "Rejecting…" : "Reject selected"}</button>
                <button onClick={() => { clearSelection(); setBulkResultMessage(null); }} style={{ ...body, padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        {bulkMode === "reviewing_approve" && (
          <Card>
            <div style={{ padding: 16 }}>
              <div style={{ ...body, fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>Batch review — {selectedIds.size} listing(s)</div>
              <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 14 }}>
                Every listing still needs its own reviewed English and Arabic name before it can be approved.
              </div>
              {queue.filter((m) => selectedIds.has(m.id)).map((m, i, arr) => (
                <div key={m.id} style={{ padding: "14px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ ...body, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{m.nameZh || m.name} <span style={{ color: C.muted, fontWeight: 500 }}>· OEM {m.oemNumber}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      value={bulkTranslations[m.id]?.nameEn || ""}
                      onChange={(e) => updateBulkField(m.id, "nameEn", e.target.value)}
                      placeholder="English name (required)"
                      style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                    <input
                      value={bulkTranslations[m.id]?.nameAr || ""}
                      onChange={(e) => updateBulkField(m.id, "nameAr", e.target.value)}
                      placeholder="Arabic name (required)"
                      dir="rtl"
                      style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                <button onClick={() => { clearSelection(); setBulkResultMessage(null); }} style={{ ...body, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                <button
                  disabled={isBulkSubmitting}
                  onClick={handleBulkApprove}
                  style={{ ...body, padding: "9px 16px", borderRadius: 8, border: "none", background: isBulkSubmitting ? "#D1D5DB" : C.gauge, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isBulkSubmitting ? "default" : "pointer" }}
                >{isBulkSubmitting ? "Approving…" : `Approve all (${selectedIds.size})`}</button>
              </div>
            </div>
          </Card>
        )}

        {bulkMode === "none" && loadState === "ready" && queue.map(m => {
          const isReviewing = reviewingId === m.id;
          return (
            <Card key={m.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelected(m.id)} style={{ marginRight: 2 }} />
                  {m.images && m.images.length > 0 ? (
                    <img src={`${API_BASE_URL}${m.images[0]}`} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", border: `1px solid ${C.line}` }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 9, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <PackageSearch size={19} color={C.ink} />
                    </div>
                  )}
                  <div>
                    <div style={{ ...body, fontWeight: 700, fontSize: 13.5, color: C.ink }}>{m.nameZh || m.name}</div>
                    <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {m.supplierName} · {m.category} · {m.part} · {m.position} · OEM {m.oemNumber} · submitted {new Date(m.submittedAt).toLocaleDateString()}
                    </div>
                    {m.flags.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        {m.flags.map(f => <Badge key={f} label={f} color={C.amber} bg={C.amberBg} />)}
                      </div>
                    )}
                  </div>
                </div>
                {!isReviewing && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      disabled={actioningId === m.id}
                      onClick={() => openReview(m)}
                      style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: C.gaugeBg, color: C.gauge, fontSize: 12.5, fontWeight: 700, cursor: actioningId === m.id ? "default" : "pointer", opacity: actioningId === m.id ? 0.5 : 1 }}
                    ><Check size={13} />Review &amp; Approve</button>
                    <button
                      disabled={actioningId === m.id}
                      onClick={() => handleReject(m.id)}
                      style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: C.redBg, color: C.red, fontSize: 12.5, fontWeight: 700, cursor: actioningId === m.id ? "default" : "pointer", opacity: actioningId === m.id ? 0.5 : 1 }}
                    ><X size={13} />Reject</button>
                  </div>
                )}
              </div>

              {isReviewing && (
                <div style={{ padding: "0 16px 16px" }}>
                  <div style={{ background: C.canvas, borderRadius: 10, padding: 16 }}>
                    {m.images && m.images.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        {m.images.map((url, i) => (
                          <img key={i} src={`${API_BASE_URL}${url}`} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.line}` }} />
                        ))}
                      </div>
                    )}
                    {m.descriptionZh && (
                      <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 12 }}>
                        <strong>Original (Chinese):</strong> {m.descriptionZh}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>English name (required to approve)</div>
                        <input
                          value={nameEn}
                          onChange={(e) => setNameEn(e.target.value)}
                          style={{ ...body, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>English description (optional)</div>
                        <input
                          value={descriptionEn}
                          onChange={(e) => setDescriptionEn(e.target.value)}
                          style={{ ...body, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Arabic name (required to approve)</div>
                        <input
                          value={nameAr}
                          onChange={(e) => setNameAr(e.target.value)}
                          dir="rtl"
                          style={{ ...body, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Arabic description (optional)</div>
                        <input
                          value={descriptionAr}
                          onChange={(e) => setDescriptionAr(e.target.value)}
                          dir="rtl"
                          style={{ ...body, width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, boxSizing: "border-box" }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                      <button onClick={cancelReview} style={{ ...body, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                      <button
                        disabled={actioningId === m.id}
                        onClick={() => confirmApproval(m.id)}
                        style={{ ...body, padding: "9px 16px", borderRadius: 8, border: "none", background: actioningId === m.id ? "#D1D5DB" : C.gauge, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: actioningId === m.id ? "default" : "pointer" }}
                      >{actioningId === m.id ? "Approving…" : "Confirm Approval"}</button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Real, admin-only management of the Brand->Model->Generation->Engine/
// Transmission cascade the structured supplier product-submission form
// depends on. Without this, that cascade could only ever contain
// whatever was hardcoded into db/seed.js — an admin can now add (or
// remove) a brand/model/generation/engine/transmission directly.
//
// Drill-down navigation (Brands -> Models -> Generations -> Engines &
// Transmissions) with breadcrumbs, rather than one giant flat page —
// matches how deep the real cascade actually is.
function VehicleDataPage({ onSessionExpired }) {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [engines, setEngines] = useState([]);
  const [transmissions, setTransmissions] = useState([]);

  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [newName, setNewName] = useState("");
  const [newYearStart, setNewYearStart] = useState("");
  const [newYearEnd, setNewYearEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadBrands = () => {
    setLoadState("loading");
    fetchBrands().then((b) => { setBrands(b); setLoadState("ready"); }).catch((e) => { setErrorMessage(e.message); setLoadState("error"); });
  };
  useEffect(loadBrands, []);

  const openBrand = (brand) => {
    setSelectedBrand(brand); setSelectedModel(null); setSelectedGeneration(null);
    setNewName(""); setErrorMessage(null);
    fetchModelsForBrand(brand.id).then(setModels).catch((e) => setErrorMessage(e.message));
  };
  const openModel = (model) => {
    setSelectedModel(model); setSelectedGeneration(null);
    setNewName(""); setErrorMessage(null);
    fetchGenerationsForModel(model.id).then(setGenerations).catch((e) => setErrorMessage(e.message));
  };
  const openGeneration = (generation) => {
    setSelectedGeneration(generation);
    setNewName(""); setErrorMessage(null);
    Promise.all([fetchEnginesForGeneration(generation.id), fetchTransmissionsForGeneration(generation.id)])
      .then(([eng, trans]) => { setEngines(eng); setTransmissions(trans); })
      .catch((e) => setErrorMessage(e.message));
  };

  const backToBrands = () => { setSelectedBrand(null); setSelectedModel(null); setSelectedGeneration(null); setErrorMessage(null); };
  const backToModels = () => { setSelectedModel(null); setSelectedGeneration(null); setErrorMessage(null); };
  const backToGenerations = () => { setSelectedGeneration(null); setErrorMessage(null); };

  const handleAdd = async (kind) => {
    if (!newName.trim()) { setErrorMessage("Name is required."); return; }
    if (kind === "generation" && !newYearStart) { setErrorMessage("Start year is required."); return; }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const token = getStoredToken();
      if (kind === "brand") {
        await createBrand(token, newName.trim());
        loadBrands();
      } else if (kind === "model") {
        await createModel(token, selectedBrand.id, newName.trim());
        openBrand(selectedBrand);
      } else if (kind === "generation") {
        await createGeneration(token, selectedModel.id, newName.trim(), parseInt(newYearStart, 10), newYearEnd ? parseInt(newYearEnd, 10) : undefined);
        openModel(selectedModel);
      } else if (kind === "engine") {
        await createEngine(token, selectedGeneration.id, newName.trim());
        openGeneration(selectedGeneration);
      } else if (kind === "transmission") {
        await createTransmission(token, selectedGeneration.id, newName.trim());
        openGeneration(selectedGeneration);
      }
      setNewName(""); setNewYearStart(""); setNewYearEnd("");
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (kind, id) => {
    try {
      const token = getStoredToken();
      if (kind === "brand") { await deleteBrand(token, id); loadBrands(); }
      else if (kind === "model") { await deleteModel(token, id); openBrand(selectedBrand); }
      else if (kind === "generation") { await deleteGeneration(token, id); openModel(selectedModel); }
      else if (kind === "engine") { await deleteEngine(token, id); openGeneration(selectedGeneration); }
      else if (kind === "transmission") { await deleteTransmission(token, id); openGeneration(selectedGeneration); }
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message); // e.g. the real 409 "products reference this" message
    }
  };

  const breadcrumb = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...body, fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
      <span onClick={backToBrands} style={{ cursor: selectedBrand ? "pointer" : "default", fontWeight: selectedBrand ? 400 : 700, color: selectedBrand ? C.muted : C.ink }}>Brands</span>
      {selectedBrand && <>
        <ChevronRight size={12} />
        <span onClick={backToModels} style={{ cursor: selectedModel ? "pointer" : "default", fontWeight: selectedModel ? 400 : 700, color: selectedModel ? C.muted : C.ink }}>{selectedBrand.name}</span>
      </>}
      {selectedModel && <>
        <ChevronRight size={12} />
        <span onClick={backToGenerations} style={{ cursor: selectedGeneration ? "pointer" : "default", fontWeight: selectedGeneration ? 400 : 700, color: selectedGeneration ? C.muted : C.ink }}>{selectedModel.name}</span>
      </>}
      {selectedGeneration && <>
        <ChevronRight size={12} />
        <span style={{ fontWeight: 700, color: C.ink }}>{selectedGeneration.name}</span>
      </>}
    </div>
  );

  const addRow = (kind, placeholder, showYears) => (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={placeholder} style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
      {showYears && <>
        <input value={newYearStart} onChange={(e) => setNewYearStart(e.target.value)} placeholder="Start year" type="number" style={{ ...body, width: 100, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
        <input value={newYearEnd} onChange={(e) => setNewYearEnd(e.target.value)} placeholder="End year (optional)" type="number" style={{ ...body, width: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
      </>}
      <button disabled={isSubmitting} onClick={() => handleAdd(kind)} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
        <Check size={13} /> Add
      </button>
    </div>
  );

  const listRow = (label, sub, onOpen, onDelete) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>
      <div onClick={onOpen} style={{ cursor: onOpen ? "pointer" : "default", flex: 1 }}>
        <span style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</span>
        {sub && <span style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: 8 }}>{sub}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onOpen && <ChevronRight size={14} color={C.muted} onClick={onOpen} style={{ cursor: "pointer" }} />}
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color={C.red} /></button>
      </div>
    </div>
  );

  if (loadState === "loading") {
    return <div><TopBar title="Vehicle Data" subtitle="Loading…" /><div style={{ padding: 24 }}><Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading…</div></Card></div></div>;
  }
  if (loadState === "error" && !selectedBrand) {
    return <div><TopBar title="Vehicle Data" subtitle="" /><div style={{ padding: 24 }}><Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>{errorMessage}</div></Card></div></div>;
  }

  return (
    <div>
      <TopBar title="Vehicle Data" subtitle="Manage the Brand → Model → Generation → Engine/Transmission cascade the supplier product form uses" />
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ padding: 18 }}>
            {breadcrumb}
            {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: "#FBE7E5", borderRadius: 8, padding: 10, marginBottom: 14 }}>{errorMessage}</div>}

            {!selectedBrand && (
              <>
                {addRow("brand", "New brand name (e.g. Nissan)", false)}
                {brands.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>No brands yet.</div>}
                {brands.map((b) => listRow(b.name, null, () => openBrand(b), () => handleDelete("brand", b.id)))}
              </>
            )}

            {selectedBrand && !selectedModel && (
              <>
                {addRow("model", `New model under ${selectedBrand.name} (e.g. Focus)`, false)}
                {models.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>No models yet.</div>}
                {models.map((m) => listRow(m.name, null, () => openModel(m), () => handleDelete("model", m.id)))}
              </>
            )}

            {selectedModel && !selectedGeneration && (
              <>
                {addRow("generation", `New generation under ${selectedModel.name} (e.g. Mk4)`, true)}
                {generations.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>No generations yet.</div>}
                {generations.map((g) => listRow(g.name, `${g.yearStart}–${g.yearEnd || "present"}`, () => openGeneration(g), () => handleDelete("generation", g.id)))}
              </>
            )}

            {selectedGeneration && (
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Engines</div>
                  {addRow("engine", "e.g. 1.0L EcoBoost", false)}
                  {engines.length === 0 && <div style={{ ...body, fontSize: 12, color: C.muted, padding: 8 }}>None yet.</div>}
                  {engines.map((e) => listRow(e.name, null, null, () => handleDelete("engine", e.id)))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Transmissions</div>
                  {addRow("transmission", "e.g. 6-Speed Manual", false)}
                  {transmissions.length === 0 && <div style={{ ...body, fontSize: 12, color: C.muted, padding: 8 }}>None yet.</div>}
                  {transmissions.map((t) => listRow(t.name, null, null, () => handleDelete("transmission", t.id)))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Real, admin-only management of hub locations — create/remove regional
// inspection hubs. Simpler than Vehicle Data (no drill-down levels), but
// the same real-data-with-real-protection pattern: deleting a hub that
// real staff accounts or shipments reference is refused, not silently
// allowed or a raw DB error.
// Real hub workload/capacity dashboard (migration 042). "In-hub
// workload" is deliberately every real stage BEFORE shipped_to_buyer
// plus flagged -- once shipped to the buyer, a real shipment has
// physically left the hub and isn't really part of its active
// workload anymore, even though the row isn't deleted.
function HubWorkloadSection({ onSessionExpired }) {
  const [workload, setWorkload] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const load = () => {
    setLoadState("loading");
    fetchHubWorkload(getStoredToken())
      .then((data) => { setWorkload(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveCapacity = async (hubId) => {
    const value = parseInt(editValue, 10);
    if (!Number.isInteger(value) || value <= 0) {
      setErrorMessage("Capacity must be a positive whole number.");
      return;
    }
    try {
      await updateHubCapacity(getStoredToken(), hubId, value);
      setEditingId(null);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  return (
    <Card title="Hub workload & capacity">
      <div style={{ padding: 16 }}>
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        {loadState === "error" && <div style={{ ...body, fontSize: 12.5, color: C.red }}>{errorMessage}</div>}
        {loadState === "ready" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workload.map((h) => (
              <div key={h.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ ...disp, fontWeight: 700, fontSize: 14 }}>{h.name}</span>
                    <span style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: 8 }}>{h.region}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...body, fontSize: 12, fontWeight: 700, color: h.utilizationPercent >= 100 ? C.red : h.utilizationPercent >= 75 ? C.amber : C.gauge }}>
                      {h.totalWorkload} / {h.dailyCapacity} ({h.utilizationPercent}%)
                    </span>
                    {editingId === h.id ? (
                      <>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{ ...body, width: 70, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 8px", fontSize: 12 }}
                        />
                        <button onClick={() => handleSaveCapacity(h.id)} style={{ ...body, fontSize: 11.5, fontWeight: 700, color: "#fff", background: C.signal, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => { setEditingId(h.id); setEditValue(String(h.dailyCapacity)); }} style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit capacity</button>
                    )}
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: C.line, overflow: "hidden", marginTop: 10 }}>
                  <div style={{ height: "100%", width: `${Math.min(h.utilizationPercent, 100)}%`, background: h.utilizationPercent >= 100 ? C.red : h.utilizationPercent >= 75 ? C.amber : C.gauge, borderRadius: 3 }} />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                  {Object.entries(h.stageCounts).map(([stage, count]) => (
                    <span key={stage} style={{ ...body, fontSize: 11, color: C.muted }}>
                      {stage.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}: <strong style={{ color: C.ink }}>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// Real, deliberately simple duration formatter -- no library needed
// for "2h 15m" / "45s" style output.
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

// Real hub performance metrics (no new migration needed -- built
// entirely on hub_shipment_events' existing timestamps from migration
// 011, same as supplier analytics; see services/api/db/README.md's
// migration table) -- average time per real stage transition, for
// every real hub. See services/api/src/modules/hub/routes.js's
// GET /hub/performance for the full real design, including why
// 'flagged' events are excluded from this real, linear-stage calculation.
function HubPerformanceSection({ onSessionExpired }) {
  const [performance, setPerformance] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchHubPerformance(getStoredToken())
      .then((data) => { setPerformance(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stages = [
    { key: "toOpened", label: "Received → Opened" },
    { key: "toInspected", label: "Opened → Inspected" },
    { key: "toPacked", label: "Inspected → Packed" },
    { key: "toShippedToBuyer", label: "Packed → Shipped" },
  ];

  return (
    <Card title="Hub performance — average time per stage">
      <div style={{ padding: 16 }}>
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        {loadState === "error" && <div style={{ ...body, fontSize: 12.5, color: C.red }}>{errorMessage}</div>}
        {loadState === "ready" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Hub</Th>
                {stages.map((s) => <Th key={s.key} align="right">{s.label}</Th>)}
              </tr>
            </thead>
            <tbody>
              {performance.map((h) => (
                <tr key={h.id}>
                  <Td style={{ fontWeight: 700 }}>{h.name}</Td>
                  {stages.map((s) => (
                    <Td key={s.key} align="right" style={{ color: h.stageTimes[s.key] ? C.ink : C.muted }}>
                      {h.stageTimes[s.key] ? `${formatDuration(h.stageTimes[s.key].avgSeconds)} (n=${h.stageTimes[s.key].sampleCount})` : "—"}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function HubsPage({ onSessionExpired }) {
  const [hubs, setHubs] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [newName, setNewName] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    setLoadState("loading");
    fetchHubLocations().then((h) => { setHubs(h); setLoadState("ready"); }).catch((e) => { setErrorMessage(e.message); setLoadState("error"); });
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newRegion.trim()) {
      setErrorMessage("Name and region are required.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createHubLocation(getStoredToken(), newName.trim(), newRegion.trim(), newAddress.trim() || undefined);
      setNewName(""); setNewRegion(""); setNewAddress("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteHubLocation(getStoredToken(), id);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message); // e.g. the real 409 "staff/shipments reference this" message
    }
  };

  return (
    <div>
      <TopBar title="Inspection Hubs" subtitle="Regional facilities between suppliers and buyers — receive, inspect, pack, ship" />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <HubWorkloadSection onSessionExpired={onSessionExpired} />
        <HubPerformanceSection onSessionExpired={onSessionExpired} />
        <Card>
          <div style={{ padding: 18 }}>
            {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 14 }}>{errorMessage}</div>}

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Hub name (e.g. Rotterdam Hub)" style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder="Region (e.g. Europe)" style={{ ...body, flex: 1, minWidth: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Address (optional)" style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <button disabled={isSubmitting} onClick={handleAdd} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
                <Check size={13} /> Add hub
              </button>
            </div>

            {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
            {loadState === "ready" && hubs.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>No hubs yet.</div>}
            {loadState === "ready" && hubs.map((h, i) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: i < hubs.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div>
                  <div style={{ ...body, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{h.name}</div>
                  <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }}>{h.region}{h.address ? ` · ${h.address}` : ""}</div>
                </div>
                <button onClick={() => handleDelete(h.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.red} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Real, admin-only management of the pricing equation — the fee
// components and FX rate that services/api/src/modules/pricing/engine.js
// actually uses to compute every buyer-facing USD price, LIVE, from a
// supplier's RMB cost. Confirmed design: changing a fee here is
// reflected immediately in every listing's displayed price (not
// retroactively in already-placed orders — see the Preview calculator's
// note below on why).
function PricingPage({ onSessionExpired }) {
  const [fees, setFees] = useState([]);
  const [fxRate, setFxRate] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("percentage");
  const [newValue, setNewValue] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rateInput, setRateInput] = useState("");
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [fxRateMode, setFxRateMode] = useState("manual");
  const [isSavingMode, setIsSavingMode] = useState(false);

  const [previewCost, setPreviewCost] = useState("");
  const [previewWeight, setPreviewWeight] = useState("");
  const [previewLength, setPreviewLength] = useState("");
  const [previewWidth, setPreviewWidth] = useState("");
  const [previewHeight, setPreviewHeight] = useState("");
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const load = () => {
    setLoadState("loading");
    Promise.all([fetchFeeComponents(getStoredToken()), fetchFxRate(getStoredToken()), fetchFxRateMode(getStoredToken())])
      .then(([f, rate, modeResult]) => { setFees(f); setFxRate(rate); setRateInput(String(rate.rate)); setFxRateMode(modeResult.mode); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddFee = async () => {
    if (!newName.trim() || !newValue) {
      setErrorMessage("Name and value are required.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createFeeComponent(getStoredToken(), newName.trim(), newType, parseFloat(newValue), newSortOrder ? parseInt(newSortOrder, 10) : 0);
      setNewName(""); setNewValue(""); setNewSortOrder("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (fee) => {
    try {
      await updateFeeComponent(getStoredToken(), fee.id, { isActive: !fee.isActive });
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  const handleValueChange = async (fee, newVal) => {
    try {
      await updateFeeComponent(getStoredToken(), fee.id, { value: parseFloat(newVal) });
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  const handleDeleteFee = async (id) => {
    try {
      await deleteFeeComponent(getStoredToken(), id);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  const handleMoveFee = async (id, direction) => {
    try {
      await moveFeeComponent(getStoredToken(), id, direction);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message); // e.g. the real "already the first/last" message
    }
  };

  const handleSaveRate = async () => {
    if (!rateInput || parseFloat(rateInput) <= 0) {
      setErrorMessage("Rate must be a positive number.");
      return;
    }
    setIsSavingRate(true);
    setErrorMessage(null);
    try {
      await updateFxRate(getStoredToken(), "CNY_USD", parseFloat(rateInput));
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSavingRate(false);
    }
  };

  // Real automatic/manual toggle (migration 028) -- switching to
  // automatic triggers a real, immediate live refresh from
  // Frankfurter.app rather than waiting up to a real 24 hours.
  const handleToggleFxRateMode = async () => {
    const newMode = fxRateMode === "automatic" ? "manual" : "automatic";
    setIsSavingMode(true);
    setErrorMessage(null);
    try {
      await updateFxRateMode(getStoredToken(), newMode);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSavingMode(false);
    }
  };

  const handlePreview = async () => {
    setPreviewError(null);
    setPreviewResult(null);
    if (!previewCost) {
      setPreviewError("Enter a supplier cost (RMB) to preview.");
      return;
    }
    setIsPreviewing(true);
    try {
      const result = await previewPricing(getStoredToken(), {
        supplierCostCny: parseFloat(previewCost),
        weightKg: previewWeight ? parseFloat(previewWeight) : undefined,
        lengthCm: previewLength ? parseFloat(previewLength) : undefined,
        widthCm: previewWidth ? parseFloat(previewWidth) : undefined,
        heightCm: previewHeight ? parseFloat(previewHeight) : undefined,
      });
      setPreviewResult(result);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setPreviewError(err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const typeLabel = { percentage: "%", flat: "flat RMB", shipping_volumetric: "RMB/chargeable kg" };

  return (
    <div>
      <TopBar title="Pricing" subtitle="Real equation: supplier RMB cost → buyer USD price. Changes here apply live to every listing." />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{errorMessage}</div>}

        <Card title="Exchange rate (CNY → USD)">
          <div style={{ padding: 18 }}>
            {loadState === "ready" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <Badge label={fxRate.source === "live" ? "Live" : "Manual"} color={fxRate.source === "live" ? C.gauge : C.amber} bg={fxRate.source === "live" ? C.gaugeBg : C.amberBg} />
                  <span style={{ ...body, fontSize: 11.5, color: C.muted }}>Last updated {new Date(fxRate.updatedAt).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
                  <div>
                    <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>{fxRateMode === "automatic" ? "Automatic" : "Manual"}</div>
                    <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                      {fxRateMode === "automatic" ? "Refreshed once a day from a real, free live rate (Frankfurter.app)." : "You set the rate by hand below."}
                    </div>
                  </div>
                  <button
                    onClick={handleToggleFxRateMode}
                    disabled={isSavingMode}
                    style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: fxRateMode === "automatic" ? C.gauge : C.line, color: fxRateMode === "automatic" ? "#fff" : C.muted, fontSize: 12, fontWeight: 700, cursor: isSavingMode ? "default" : "pointer" }}
                  >{isSavingMode ? "…" : fxRateMode === "automatic" ? "Automatic" : "Manual"}</button>
                </div>
                {fxRateMode === "manual" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" step="0.0001" value={rateInput} onChange={(e) => setRateInput(e.target.value)} style={{ ...body, width: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
                    <button disabled={isSavingRate} onClick={handleSaveRate} style={{ ...body, padding: "8px 16px", borderRadius: 8, border: "none", background: isSavingRate ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSavingRate ? "default" : "pointer" }}>
                      {isSavingRate ? "Saving…" : "Update rate"}
                    </button>
                  </div>
                ) : (
                  <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>{fxRate.rate}</div>
                )}
              </>
            )}
            {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
          </div>
        </Card>

        <Card title="Fee components (applied in order, top to bottom)">
          <div style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Fee name (e.g. Insurance)" style={{ ...body, flex: 2, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...body, flex: 1, minWidth: 130, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }}>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat (RMB)</option>
                <option value="shipping_volumetric">Shipping (RMB/kg)</option>
              </select>
              <input type="number" step="0.01" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value" style={{ ...body, flex: 1, minWidth: 90, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input type="number" value={newSortOrder} onChange={(e) => setNewSortOrder(e.target.value)} placeholder="Order" style={{ ...body, flex: 1, minWidth: 80, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <button disabled={isSubmitting} onClick={handleAddFee} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
                <Check size={13} /> Add fee
              </button>
            </div>

            {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
            {loadState === "ready" && fees.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>No fee components yet.</div>}
            {loadState === "ready" && fees.map((f, i) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: i < fees.length - 1 ? `1px solid ${C.line}` : "none", opacity: f.isActive ? 1 : 0.45 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <button
                    onClick={() => handleMoveFee(f.id, "up")}
                    disabled={i === 0}
                    style={{ background: "none", border: "none", padding: 0, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.25 : 1 }}
                    title="Move up"
                  >
                    <ChevronUp size={14} color={C.ink} />
                  </button>
                  <button
                    onClick={() => handleMoveFee(f.id, "down")}
                    disabled={i === fees.length - 1}
                    style={{ background: "none", border: "none", padding: 0, cursor: i === fees.length - 1 ? "default" : "pointer", opacity: i === fees.length - 1 ? 0.25 : 1 }}
                    title="Move down"
                  >
                    <ChevronDown size={14} color={C.ink} />
                  </button>
                </div>
                <div style={{ width: 30, ...body, fontSize: 11.5, color: C.muted, textAlign: "center" }}>{f.sortOrder}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...body, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{f.name}</div>
                  <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 2 }}>{f.type.replace(/_/g, " ")}</div>
                </div>
                <input
                  type="number" step="0.01" defaultValue={f.value}
                  onBlur={(e) => { if (parseFloat(e.target.value) !== f.value) handleValueChange(f, e.target.value); }}
                  style={{ ...body, width: 90, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 9px", fontSize: 12.5 }}
                />
                <span style={{ ...body, fontSize: 11.5, color: C.muted, width: 110 }}>{typeLabel[f.type]}</span>
                <button onClick={() => handleToggleActive(f)} style={{ ...body, padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.line}`, background: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: f.isActive ? C.gauge : C.muted }}>
                  {f.isActive ? "Active" : "Inactive"}
                </button>
                <button onClick={() => handleDeleteFee(f.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.red} /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Preview calculator">
          <div style={{ padding: 18 }}>
            <div style={{ ...body, fontSize: 11.5, color: C.muted, marginBottom: 14 }}>
              Test the equation against a hypothetical product without needing a real one.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input type="number" step="0.01" value={previewCost} onChange={(e) => setPreviewCost(e.target.value)} placeholder="Supplier cost (RMB)" style={{ ...body, flex: 1, minWidth: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input type="number" step="0.01" value={previewWeight} onChange={(e) => setPreviewWeight(e.target.value)} placeholder="Weight (kg)" style={{ ...body, flex: 1, minWidth: 100, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input type="number" step="0.1" value={previewLength} onChange={(e) => setPreviewLength(e.target.value)} placeholder="Length (cm)" style={{ ...body, flex: 1, minWidth: 100, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input type="number" step="0.1" value={previewWidth} onChange={(e) => setPreviewWidth(e.target.value)} placeholder="Width (cm)" style={{ ...body, flex: 1, minWidth: 100, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input type="number" step="0.1" value={previewHeight} onChange={(e) => setPreviewHeight(e.target.value)} placeholder="Height (cm)" style={{ ...body, flex: 1, minWidth: 100, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <button disabled={isPreviewing} onClick={handlePreview} style={{ ...body, padding: "8px 16px", borderRadius: 8, border: "none", background: isPreviewing ? "#D1D5DB" : C.torque, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isPreviewing ? "default" : "pointer" }}>
                {isPreviewing ? "Calculating…" : "Calculate"}
              </button>
            </div>
            {previewError && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 12 }}>{previewError}</div>}
            {previewResult && (
              <div style={{ background: C.canvas, borderRadius: 10, padding: 14 }}>
                {previewResult.breakdown.map((step, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < previewResult.breakdown.length - 1 ? `1px solid ${C.line}` : "none", ...body, fontSize: 12.5 }}>
                    <span style={{ color: i === 0 ? C.ink : C.muted, fontWeight: i === 0 ? 700 : 400 }}>{step.step}</span>
                    <span style={{ color: C.ink }}>¥{step.runningTotalCny.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `2px solid ${C.ink}` }}>
                  <span style={{ ...disp, fontSize: 16, fontWeight: 700 }}>Buyer pays</span>
                  <span style={{ ...disp, fontSize: 18, fontWeight: 800 }}>${previewResult.buyerPriceUsd.toFixed(2)} USD</span>
                </div>
                <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 6 }}>
                  at {previewResult.fxRate} CNY→USD ({previewResult.fxSource})
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Real queue of every flagged hub shipment across all orders — the
// actual answer to "where do I find a flagged issue," which before this
// existed had no answer at all beyond already knowing which order to
// open. See services/api/src/modules/hub/routes.js's GET /hub/flagged.
function FlaggedShipmentsPage({ onOpenOrder, onSessionExpired }) {
  const [shipments, setShipments] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchFlaggedShipments(getStoredToken())
      .then((data) => { setShipments(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <TopBar title="Flagged Shipments" subtitle="Quality issues hub staff have flagged during inspection, across every order" />
      <div style={{ padding: 24 }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>}

        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
        {loadState === "ready" && shipments.length === 0 && (
          <Card>
            <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>
              Nothing flagged right now.
            </div>
          </Card>
        )}
        {loadState === "ready" && shipments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shipments.map((s) => (
              <Card key={s.id}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ ...disp, fontSize: 16, fontWeight: 700, color: C.ink }}>{s.orderId}</span>
                        <Badge label="Flagged" color={C.red} bg={C.redBg} />
                      </div>
                      <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 3 }}>
                        {s.supplierName} · {s.hubName || "no hub"} · {new Date(s.flaggedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenOrder(s.orderId)}
                      style={{ ...body, padding: "7px 14px", borderRadius: 7, border: "none", background: C.signal, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      View order
                    </button>
                  </div>
                  {s.flagNote && <div style={{ ...body, fontSize: 13, color: C.ink, marginBottom: 10 }}>{s.flagNote}</div>}
                  {s.flagPhotos.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {s.flagPhotos.map((url, i) => (
                        <img key={i} src={`${API_BASE_URL}${url}`} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Real, admin-managed category + part reference lists (migration 015).
// Confirmed requirement: a supplier picks a real Part from a real list
// scoped to the Category they picked, rather than typing free text.
// Two-level drill-down, same structural idea as Vehicle Data's fitment
// cascade (just two levels instead of four) and the same real-
// protection-on-delete pattern as Vehicle Data and Hubs.
function CategoriesPage({ onSessionExpired }) {
  const [categories, setCategories] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [openCategory, setOpenCategory] = useState(null); // {id, nameEn}

  const [newCatId, setNewCatId] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  const loadCategories = () => {
    setLoadState("loading");
    fetchCategories().then((c) => { setCategories(c); setLoadState("ready"); }).catch((e) => { setErrorMessage(e.message); setLoadState("error"); });
  };
  useEffect(loadCategories, []);

  const handleAddCategory = async () => {
    if (!newCatId.trim() || !newCatNameEn.trim()) {
      setErrorMessage("A real id (e.g. \"tires\") and an English name are required.");
      return;
    }
    setIsSubmittingCat(true);
    setErrorMessage(null);
    try {
      await createCategory(getStoredToken(), newCatId.trim(), newCatNameEn.trim(), newCatNameAr.trim() || undefined, categories.length * 10 + 10);
      setNewCatId(""); setNewCatNameEn(""); setNewCatNameAr("");
      loadCategories();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(getStoredToken(), id);
      loadCategories();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message); // e.g. the real 409 messages for real products or attached parts
    }
  };

  if (openCategory) {
    return (
      <CategoryPartsPage
        category={openCategory}
        onBack={() => { setOpenCategory(null); loadCategories(); }}
        onSessionExpired={onSessionExpired}
      />
    );
  }

  return (
    <div>
      <TopBar title="Categories" subtitle="Major categories and the real parts a supplier picks from within each" />
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ padding: 18 }}>
            {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 14 }}>{errorMessage}</div>}

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={newCatId} onChange={(e) => setNewCatId(e.target.value)} placeholder="id (e.g. tires)" style={{ ...body, flex: 1, minWidth: 120, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input value={newCatNameEn} onChange={(e) => setNewCatNameEn(e.target.value)} placeholder="English name" style={{ ...body, flex: 1, minWidth: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input value={newCatNameAr} onChange={(e) => setNewCatNameAr(e.target.value)} placeholder="Arabic name (optional)" dir="rtl" style={{ ...body, flex: 1, minWidth: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <button disabled={isSubmittingCat} onClick={handleAddCategory} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: isSubmittingCat ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSubmittingCat ? "default" : "pointer" }}>
                <Check size={13} /> Add category
              </button>
            </div>

            {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
            {loadState === "ready" && categories.map((c, i) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: i < categories.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer" }}
                onClick={() => setOpenCategory(c)}>
                <div>
                  <div style={{ ...body, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{c.nameEn}</div>
                  {c.nameAr && <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }} dir="rtl">{c.nameAr}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...body, fontSize: 11.5, color: C.muted }}>{c.id}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.red} /></button>
                  <ChevronRight size={16} color={C.muted} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CategoryPartsPage({ category, onBack, onSessionExpired }) {
  const [parts, setParts] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  const [newNameEn, setNewNameEn] = useState("");
  const [newNameAr, setNewNameAr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    setLoadState("loading");
    fetchPartsForCategory(category.id).then((p) => { setParts(p); setLoadState("ready"); }).catch((e) => { setErrorMessage(e.message); setLoadState("error"); });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddPart = async () => {
    if (!newNameEn.trim()) {
      setErrorMessage("An English name is required.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createPart(getStoredToken(), category.id, newNameEn.trim(), newNameAr.trim() || undefined, parts.length * 10 + 10);
      setNewNameEn(""); setNewNameAr("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePart = async (id) => {
    try {
      await deletePart(getStoredToken(), id);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message); // e.g. the real 409 "products still reference it" message
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 24px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div>
          <div style={{ ...body, fontSize: 11.5, color: C.muted }}>Categories</div>
          <div style={{ ...disp, fontSize: 18, fontWeight: 700, color: C.ink }}>{category.nameEn} — Parts</div>
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ padding: 18 }}>
            {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 14 }}>{errorMessage}</div>}

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} placeholder="English part name" style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input value={newNameAr} onChange={(e) => setNewNameAr(e.target.value)} placeholder="Arabic name (optional)" dir="rtl" style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <button disabled={isSubmitting} onClick={handleAddPart} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
                <Check size={13} /> Add part
              </button>
            </div>

            {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
            {loadState === "ready" && parts.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>No parts yet — suppliers can't submit anything under this category until you add at least one.</div>}
            {loadState === "ready" && parts.map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: i < parts.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div>
                  <div style={{ ...body, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{p.nameEn}</div>
                  {p.nameAr && <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }} dir="rtl">{p.nameAr}</div>}
                </div>
                <button onClick={() => handleDeletePart(p.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.red} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Real supplier <-> platform messaging (new). Bidirectional
// auto-translation (Chinese <-> English) -- see
// services/api/src/modules/supplier-messages/translate.js for the full
// honest state of that integration. Deliberately separate from the
// buyer Support Tickets page -- that system exists specifically to
// enforce buyers never contacting suppliers directly; this is a
// genuinely different relationship.
function SupplierMessagesPage({ onSessionExpired }) {
  const [inbox, setInbox] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [openSupplier, setOpenSupplier] = useState(null); // {supplierId, supplierName}

  const load = () => {
    setLoadState("loading");
    fetchSupplierMessagesInbox(getStoredToken())
      .then((data) => { setInbox(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (openSupplier) {
    return (
      <SupplierMessageThreadPage
        supplierId={openSupplier.supplierId}
        supplierName={openSupplier.supplierName}
        onBack={() => { setOpenSupplier(null); load(); }}
        onSessionExpired={onSessionExpired}
      />
    );
  }

  return (
    <div>
      <TopBar title="Supplier Messages" subtitle="Real bidirectional messaging with suppliers — Chinese and English, auto-translated both ways" />
      <div style={{ padding: 24 }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>}
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
        {loadState === "ready" && inbox.length === 0 && (
          <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>No supplier messages yet.</div></Card>
        )}
        {loadState === "ready" && inbox.length > 0 && (
          <Card>
            <div style={{ padding: 6 }}>
              {inbox.map((entry, i) => (
                <div
                  key={entry.supplierId}
                  onClick={() => setOpenSupplier({ supplierId: entry.supplierId, supplierName: entry.supplierName })}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 12px", borderBottom: i < inbox.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer" }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ ...body, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{entry.supplierName}</div>
                    <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.lastMessagePreview}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...body, fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{new Date(entry.lastMessageAt).toLocaleString()}</span>
                    <ChevronRight size={16} color={C.muted} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SupplierMessageThreadPage({ supplierId, supplierName, onBack, onSessionExpired }) {
  const [messages, setMessages] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showOriginalFor, setShowOriginalFor] = useState({});

  const load = () => {
    fetchSupplierMessageThread(getStoredToken(), supplierId)
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
      await sendSupplierMessage(getStoredToken(), supplierId, input.trim());
      setInput("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 24px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div>
          <div style={{ ...body, fontSize: 11.5, color: C.muted }}>Supplier Messages</div>
          <div style={{ ...disp, fontSize: 18, fontWeight: 700, color: C.ink }}>{supplierName}</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{errorMessage}</div>}
        {messages === null && !errorMessage && <div style={{ ...body, fontSize: 13, color: C.muted }}>Loading…</div>}
        {messages !== null && messages.length === 0 && <div style={{ ...body, fontSize: 13, color: C.muted }}>No messages yet.</div>}
        {messages !== null && messages.map((m) => {
          const isMe = m.senderRole === "admin";
          // Admin's OWN messages show their own real English original
          // by default. A supplier's messages show the real Chinese ->
          // English TRANSLATION by default, since that's what admin
          // actually needs to read -- with a toggle to see the real
          // Chinese original, since auto-translation isn't perfect and
          // admin should be able to check it, not just trust it blindly.
          const defaultText = isMe ? m.originalText : (m.translatedText || m.originalText);
          const showingOriginal = showOriginalFor[m.id] || false;
          const displayText = (!isMe && showingOriginal) ? m.originalText : defaultText;
          const canToggle = !isMe && m.translationStatus === "success";
          return (
            <div key={m.id} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "65%" }}>
              <div style={{ ...body, fontSize: 13, padding: "10px 14px", borderRadius: 12, lineHeight: 1.5, background: isMe ? C.signal : "#fff", color: isMe ? "#fff" : C.ink, border: isMe ? "none" : `1px solid ${C.line}` }}>
                {displayText}
              </div>
              {!isMe && m.translationStatus === "unavailable" && (
                <div style={{ ...body, fontSize: 10.5, color: C.muted, marginTop: 3 }}>(auto-translation unavailable — showing original Chinese)</div>
              )}
              {canToggle && (
                <button
                  onClick={() => setShowOriginalFor((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                  style={{ ...body, fontSize: 10.5, color: C.torque, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 3 }}
                >
                  {showingOriginal ? "Show translation" : "Show original (Chinese)"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 16, borderTop: `1px solid ${C.line}`, background: C.card }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message (English)…"
          style={{ ...body, flex: 1, border: `1px solid ${C.line}`, borderRadius: 20, padding: "10px 16px", fontSize: 13, outline: "none" }}
        />
        <button onClick={send} disabled={isSending} style={{ width: 40, height: 40, borderRadius: "50%", background: isSending ? "#D1D5DB" : C.signal, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: isSending ? "default" : "pointer" }}>
          <Send size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// Real, admin-managed promo codes (migration 020) — a general
// promotions engine, deliberately expanded beyond "just referral
// rewards" once it became clear the actual need was broader: real
// event/campaign codes alongside real referral-generated ones, same
// underlying system either way.
function PromoCodesPage({ onSessionExpired }) {
  const [codes, setCodes] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("percentage");
  const [newValue, setNewValue] = useState("");
  const [newMaxTotalUses, setNewMaxTotalUses] = useState("");
  const [newMaxUsesPerBuyer, setNewMaxUsesPerBuyer] = useState("1");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  // Real audience targeting (migration 021) -- combinable, AND logic.
  const [newRequireNewUser, setNewRequireNewUser] = useState(false);
  const [newMinTotalSpend, setNewMinTotalSpend] = useState("");
  const [newMinOrderCount, setNewMinOrderCount] = useState("");
  const [newMinInactiveDays, setNewMinInactiveDays] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    setLoadState("loading");
    fetchPromoCodes(getStoredToken())
      .then((data) => { setCodes(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!newCode.trim() || (newType !== "free_shipping" && !newValue)) {
      setErrorMessage("A code, and a value for percentage/flat codes, are required.");
      return;
    }
    if (newStartsAt && newExpiresAt && new Date(newStartsAt) >= new Date(newExpiresAt)) {
      setErrorMessage("The start date must be before the expiry date.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createPromoCode(getStoredToken(), {
        code: newCode.trim().toUpperCase(),
        type: newType,
        value: newType === "free_shipping" ? null : Number(newValue),
        maxTotalUses: newMaxTotalUses ? Number(newMaxTotalUses) : null,
        maxUsesPerBuyer: Number(newMaxUsesPerBuyer) || 1,
        startsAt: newStartsAt ? new Date(newStartsAt).toISOString() : null,
        expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
        requireNewUser: newRequireNewUser,
        minTotalSpend: newMinTotalSpend ? Number(newMinTotalSpend) : null,
        minOrderCount: newMinOrderCount ? Number(newMinOrderCount) : null,
        minInactiveDays: newMinInactiveDays ? Number(newMinInactiveDays) : null,
      });
      setNewCode(""); setNewValue(""); setNewMaxTotalUses(""); setNewMaxUsesPerBuyer("1"); setNewStartsAt(""); setNewExpiresAt("");
      setNewRequireNewUser(false); setNewMinTotalSpend(""); setNewMinOrderCount(""); setNewMinInactiveDays("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (code, isActive) => {
    try {
      await updatePromoCode(getStoredToken(), code, { isActive: !isActive });
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  const handleDelete = async (code) => {
    try {
      await deletePromoCode(getStoredToken(), code);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message); // e.g. the real 409 "has redemptions" message
    }
  };

  return (
    <div>
      <TopBar title="Promo Codes" subtitle="Real admin-created event/campaign codes, and real referral-generated rewards — one system" />
      <div style={{ padding: 24 }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>}

        <Card>
          <div style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code (e.g. SUMMER10)" style={{ ...body, flex: 1, minWidth: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }}>
                <option value="percentage">% off</option>
                <option value="flat">$ off</option>
                <option value="free_shipping">Free shipping</option>
              </select>
              {newType !== "free_shipping" && (
                <input value={newValue} onChange={(e) => setNewValue(e.target.value)} type="number" placeholder={newType === "percentage" ? "10 (%)" : "5.00 ($)"} style={{ ...body, width: 100, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              )}
              <input value={newMaxTotalUses} onChange={(e) => setNewMaxTotalUses(e.target.value)} type="number" placeholder="Max total uses (blank = ∞)" style={{ ...body, width: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <input value={newMaxUsesPerBuyer} onChange={(e) => setNewMaxUsesPerBuyer(e.target.value)} type="number" placeholder="Max per buyer" style={{ ...body, width: 110, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ ...body, fontSize: 10, color: C.muted }}>Starts (blank = now)</span>
                <input value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} type="date" style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ ...body, fontSize: 10, color: C.muted }}>Expires (blank = never)</span>
                <input value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} type="date" style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
              </div>
              <button disabled={isSubmitting} onClick={handleCreate} style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
                <Check size={13} /> Create
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", background: C.canvas, borderRadius: 8 }}>
              <span style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted }}>Audience targeting (optional, combinable):</span>
              <label style={{ ...body, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                <input type="checkbox" checked={newRequireNewUser} onChange={(e) => setNewRequireNewUser(e.target.checked)} />
                New users only
              </label>
              <input value={newMinTotalSpend} onChange={(e) => setNewMinTotalSpend(e.target.value)} type="number" placeholder="Min lifetime spend ($)" style={{ ...body, width: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }} />
              <input value={newMinOrderCount} onChange={(e) => setNewMinOrderCount(e.target.value)} type="number" placeholder="Min real orders" style={{ ...body, width: 130, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }} />
              <input value={newMinInactiveDays} onChange={(e) => setNewMinInactiveDays(e.target.value)} type="number" placeholder="Inactive days (win-back)" style={{ ...body, width: 170, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }} />
            </div>

            {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
            {loadState === "ready" && codes.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 20, textAlign: "center" }}>No promo codes yet.</div>}
            {loadState === "ready" && codes.map((c, i) => (
              <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: i < codes.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...disp, fontSize: 15, fontWeight: 700, color: C.ink }}>{c.code}</span>
                    <PlateChip small>{c.source === "referral" ? "Referral" : "Admin"}</PlateChip>
                    {!c.isActive && <span style={{ ...body, fontSize: 10.5, fontWeight: 700, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 6, padding: "2px 7px" }}>Inactive</span>}
                    {c.startsAt && new Date(c.startsAt) > new Date() && (
                      <span style={{ ...body, fontSize: 10.5, fontWeight: 700, color: C.torque, border: `1px solid ${C.torque}`, borderRadius: 6, padding: "2px 7px" }}>Scheduled</span>
                    )}
                  </div>
                  <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {c.type === "percentage" && `${c.value}% off`}
                    {c.type === "flat" && `$${c.value} off`}
                    {c.type === "free_shipping" && "Free shipping"}
                    {" · "}Max {c.maxTotalUses ?? "∞"} uses total, {c.maxUsesPerBuyer} per buyer
                    {c.startsAt && ` · Starts ${new Date(c.startsAt).toLocaleDateString()}`}
                    {c.expiresAt && ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                  </div>
                  {(c.requireNewUser || c.minTotalSpend != null || c.minOrderCount != null || c.minInactiveDays != null) && (
                    <div style={{ ...body, fontSize: 11, color: C.torque, marginTop: 2 }}>
                      Targets: {[
                        c.requireNewUser && "new users only",
                        c.minTotalSpend != null && `$${c.minTotalSpend}+ lifetime spend`,
                        c.minOrderCount != null && `${c.minOrderCount}+ real orders`,
                        c.minInactiveDays != null && `inactive ${c.minInactiveDays}+ days`,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => handleToggleActive(c.code, c.isActive)} style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.torque, background: "none", border: "none", cursor: "pointer" }}>
                    {c.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(c.code)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={15} color={C.red} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Real payouts (migration 024) -- CONFIRMED SCOPE: no automatic payout
// schedule (real timing varies per supplier based on individual
// agreements) -- instead, a real "amount currently owed" per supplier
// (delivered, past the real return window, no return case ever filed),
// and a real, manual "Record payout" action an owner/admin triggers
// whenever it's actually time to pay a given supplier.
// Real product reviews moderation (migration 025) -- the same real
// quality gate every product listing already goes through. CONFIRMED
// SCOPE: whether a review requires a real verified purchase is
// admin-decided, not hardcoded either way.
function StarRatingDisplay({ rating }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={n <= rating ? C.amber : "none"} color={n <= rating ? C.amber : C.line} />
      ))}
    </div>
  );
}

function ReviewsPage({ onSessionExpired }) {
  const [activeTab, setActiveTab] = useState("pending");
  const [reviews, setReviews] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [requireVerified, setRequireVerified] = useState(false);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  const load = () => {
    setLoadState("loading");
    // Real, defensive clearing on every tab switch -- avoids briefly
    // showing the real previous tab's stale reviews while the new
    // tab's real data is still in flight. The render logic itself is
    // ALSO defensive (see the flagReasons fallback below), since React
    // can still render once with the new activeTab before this state
    // update takes effect -- belt and suspenders, not just one fix.
    setReviews([]);
    const fetchReviews = activeTab === "pending" ? fetchPendingReviews(getStoredToken()) : fetchFlaggedReviews(getStoredToken());
    Promise.all([fetchReviews, fetchRequireVerifiedPurchase(getStoredToken())])
      .then(([reviewData, settingData]) => {
        setReviews(reviewData);
        setRequireVerified(settingData.requireVerifiedPurchase);
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModerate = async (reviewId, action) => {
    setActioningId(reviewId);
    setErrorMessage(null);
    try {
      await moderateReview(getStoredToken(), reviewId, action);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setActioningId(null);
    }
  };

  // Real dismiss-flags action (migration 033) -- clears the real flags
  // on this review without changing its real status at all. To hide
  // the review instead, the existing real "Reject" action (above) is
  // reused directly, since a rejected review is already correctly
  // hidden from public view -- no separate "hide" action needed.
  const handleDismissFlags = async (reviewId) => {
    setActioningId(reviewId);
    setErrorMessage(null);
    try {
      await dismissReviewFlags(getStoredToken(), reviewId);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleToggleRequireVerified = async () => {
    setIsSavingSetting(true);
    setErrorMessage(null);
    try {
      const result = await updateRequireVerifiedPurchase(getStoredToken(), !requireVerified);
      setRequireVerified(result.requireVerifiedPurchase);
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSavingSetting(false);
    }
  };

  return (
    <div>
      <TopBar title="Reviews" subtitle={loadState === "ready" ? `${reviews.length} ${activeTab} review${reviews.length === 1 ? "" : "s"}` : "Loading…"} />
      <div style={{ padding: 24 }}>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink }}>Require verified purchase to review</div>
              <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 2 }}>When on, only buyers who actually received the product can submit a review.</div>
            </div>
            <button
              onClick={handleToggleRequireVerified}
              disabled={isSavingSetting}
              style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: requireVerified ? C.gauge : C.line, color: requireVerified ? "#fff" : C.muted, fontSize: 12, fontWeight: 700, cursor: isSavingSetting ? "default" : "pointer" }}
            >{requireVerified ? "On" : "Off"}</button>
          </div>
        </Card>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setActiveTab("pending")}
            style={{ ...body, padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "pending" ? C.ink : C.line, color: activeTab === "pending" ? "#fff" : C.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >Pending</button>
          <button
            onClick={() => setActiveTab("flagged")}
            style={{ ...body, padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "flagged" ? C.ink : C.line, color: activeTab === "flagged" ? "#fff" : C.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >Flagged</button>
        </div>

        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>}
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load reviews: {errorMessage}</div></Card>}
        {loadState === "ready" && reviews.length === 0 && (
          <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>
            {activeTab === "pending" ? "Nothing awaiting review right now." : "No reviews have been reported."}
          </div></Card>
        )}
        {loadState === "ready" && reviews.map((r) => (
          <Card key={r.id} style={{ marginBottom: 12 }}>
            <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...body, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.productName}</div>
                <div style={{ marginBottom: 6 }}><StarRatingDisplay rating={r.rating} /></div>
                {r.comment && <div style={{ ...body, fontSize: 12.5, color: C.ink, marginBottom: 4 }}>{r.comment}</div>}
                {r.photos && r.photos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    {r.photos.map((url, i) => (
                      <img key={i} src={`${API_BASE_URL}${url}`} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.line}` }} />
                    ))}
                  </div>
                )}
                <div style={{ ...body, fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  {r.buyerName || "Buyer"} · {new Date(r.createdAt).toLocaleDateString()}
                  {r.isVerifiedPurchase && (
                    <span style={{ ...body, fontSize: 10, fontWeight: 700, color: C.gauge, background: "#E8F7F0", padding: "2px 6px", borderRadius: 4 }}>
                      ✓ Verified Purchase
                    </span>
                  )}
                </div>
                {activeTab === "flagged" && (
                  <div style={{ marginTop: 8, padding: 10, background: C.redBg, borderRadius: 8 }}>
                    <div style={{ ...body, fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 }}>
                      Reported {r.flagCount} time{r.flagCount === 1 ? "" : "s"}
                    </div>
                    {(r.flagReasons || []).map((reason, i) => (
                      <div key={i} style={{ ...body, fontSize: 11.5, color: C.ink }}>“{reason}”</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {activeTab === "pending" ? (
                  <>
                    <button
                      disabled={actioningId === r.id}
                      onClick={() => handleModerate(r.id, "approve")}
                      style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: C.gauge, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Approve</button>
                    <button
                      disabled={actioningId === r.id}
                      onClick={() => handleModerate(r.id, "reject")}
                      style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: C.redBg, color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Reject</button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={actioningId === r.id}
                      onClick={() => handleDismissFlags(r.id)}
                      style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: C.line, color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Dismiss</button>
                    <button
                      disabled={actioningId === r.id}
                      onClick={() => handleModerate(r.id, "reject")}
                      style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: C.redBg, color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Hide review</button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PayoutsPage({ onSessionExpired }) {
  const [owed, setOwed] = useState([]);
  const [payoutMethods, setPayoutMethods] = useState({}); // supplierId -> payout method (or null)
  const [history, setHistory] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [payingSupplierId, setPayingSupplierId] = useState(null);

  const load = () => {
    setLoadState("loading");
    Promise.all([fetchPayoutsOwed(getStoredToken()), fetchPayoutHistory(getStoredToken())])
      .then(async ([owedData, historyData]) => {
        setOwed(owedData);
        setHistory(historyData);
        // Real payout method per supplier currently owed (migration
        // 034) -- fetched alongside, so an admin can see (or confirm
        // the real absence of) where the money is supposed to go,
        // right next to the amount and the Record payout action.
        const methods = {};
        await Promise.all(owedData.map(async (o) => {
          try {
            methods[o.supplierId] = await fetchSupplierPayoutMethod(getStoredToken(), o.supplierId);
          } catch {
            methods[o.supplierId] = null;
          }
        }));
        setPayoutMethods(methods);
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecordPayout = async (supplierId) => {
    setPayingSupplierId(supplierId);
    setErrorMessage(null);
    try {
      await recordPayout(getStoredToken(), supplierId);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setPayingSupplierId(null);
    }
  };

  const totalOwed = owed.reduce((s, o) => s + o.amountOwed, 0);

  return (
    <div>
      <TopBar title="Commission & payouts" subtitle="Recorded manually per supplier, based on each supplier's own payment agreement — no fixed platform-wide schedule" />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <KpiCard label="Currently owed" value={`$${totalOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Wallet} />
          <KpiCard label="Suppliers with a balance" value={owed.length} icon={TrendingUp} />
        </div>

        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load payouts: {errorMessage}</div></Card>}
        {errorMessage && loadState === "ready" && (
          <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 16 }}>{errorMessage}</div>
        )}

        {loadState === "ready" && (
          <>
            <Card
              title="Amount owed"
              style={{ marginBottom: 16 }}
              action={
                owed.length > 0 && (
                  <button
                    onClick={() => exportToExcel({
                      filename: `payouts-owed-${new Date().toISOString().slice(0, 10)}`,
                      sheetName: "Amount Owed",
                      columns: [
                        { header: "Supplier", key: "supplierName", width: 30 },
                        { header: "Amount owed", key: "amountOwed", width: 16 },
                        { header: "Eligible orders", key: "eligibleSubOrderCount", width: 16 },
                        { header: "Payout method", key: "payoutMethod", width: 40 },
                      ],
                      rows: owed.map((o) => {
                        const method = payoutMethods[o.supplierId];
                        return {
                          supplierName: o.supplierName,
                          amountOwed: o.amountOwed,
                          eligibleSubOrderCount: o.eligibleSubOrderCount,
                          payoutMethod: method ? `${method.bankName} — ${method.accountNumber} (${method.accountHolderName})` : "None on file",
                        };
                      }),
                    })}
                    style={{ ...body, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Download size={14} /> Export
                  </button>
                )
              }
            >
              {owed.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Nothing is currently owed to any supplier.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><Th>Supplier</Th><Th align="right">Owed</Th><Th align="right">Eligible orders</Th><Th>Payout method</Th><Th></Th></tr></thead>
                  <tbody>
                    {owed.map((o) => {
                      const method = payoutMethods[o.supplierId];
                      return (
                      <tr key={o.supplierId}>
                        <Td style={{ fontWeight: 600 }}>{o.supplierName}</Td>
                        <Td align="right">${o.amountOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Td>
                        <Td align="right" style={{ color: C.muted }}>{o.eligibleSubOrderCount}</Td>
                        <Td>
                          {method ? (
                            <div style={{ ...body, fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{method.bankName} — {method.accountNumber}</div>
                              <div style={{ color: C.muted, fontSize: 11 }}>{method.accountHolderName}</div>
                            </div>
                          ) : (
                            <span style={{ ...body, fontSize: 11.5, color: C.red, background: C.redBg, padding: "3px 8px", borderRadius: 6 }}>No payout method on file</span>
                          )}
                        </Td>
                        <Td align="right">
                          <button
                            disabled={payingSupplierId === o.supplierId || !method}
                            onClick={() => handleRecordPayout(o.supplierId)}
                            title={!method ? "This supplier has no payout method on file yet" : undefined}
                            style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: (payingSupplierId === o.supplierId || !method) ? "#D1D5DB" : C.gauge, color: "#fff", fontSize: 12, fontWeight: 700, cursor: (payingSupplierId === o.supplierId || !method) ? "default" : "pointer" }}
                          >{payingSupplierId === o.supplierId ? "Recording…" : "Record payout"}</button>
                        </Td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>

            <Card
              title="Payout history"
              action={
                history.length > 0 && (
                  <button
                    onClick={() => exportToExcel({
                      filename: `payout-history-${new Date().toISOString().slice(0, 10)}`,
                      sheetName: "Payout History",
                      columns: [
                        { header: "Supplier", key: "supplierName", width: 30 },
                        { header: "Amount", key: "amount", width: 14 },
                        { header: "Orders covered", key: "subOrderCount", width: 16 },
                        { header: "Date", key: "date", width: 16 },
                        { header: "Notes", key: "notes", width: 40 },
                      ],
                      rows: history.map((p) => ({
                        supplierName: p.supplierName,
                        amount: p.amount,
                        subOrderCount: p.subOrderCount,
                        date: new Date(p.createdAt).toLocaleDateString(),
                        notes: p.notes || "",
                      })),
                    })}
                    style={{ ...body, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Download size={14} /> Export
                  </button>
                )
              }
            >
              {history.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>No payouts recorded yet.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><Th>Supplier</Th><Th align="right">Amount</Th><Th align="right">Orders covered</Th><Th>Date</Th><Th>Notes</Th></tr></thead>
                  <tbody>
                    {history.map((p) => (
                      <tr key={p.id}>
                        <Td style={{ fontWeight: 600 }}>{p.supplierName}</Td>
                        <Td align="right">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Td>
                        <Td align="right" style={{ color: C.muted }}>{p.subOrderCount}</Td>
                        <Td style={{ color: C.muted }}>{new Date(p.createdAt).toLocaleDateString()}</Td>
                        <Td style={{ color: C.muted }}>{p.notes || "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function TicketsPage({ onOpenTicket, onSessionExpired }) {
  const [tickets, setTickets] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const priorityColor = { high: C.red, medium: C.amber, low: C.muted };

  useEffect(() => {
    fetchTickets(getStoredToken())
      .then((data) => { setTickets(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, [onSessionExpired]);

  const openCount = tickets.filter(t => t.status !== "resolved").length;

  return (
    <div>
      <TopBar title="Support tickets" subtitle={loadState === "ready" ? `${openCount} open · buyer ↔ platform only` : "Loading…"} />
      <div style={{ padding: 24 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading tickets…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load tickets: {errorMessage}</div></Card>}
        {loadState === "ready" && (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Ticket</Th><Th>Subject</Th><Th>Buyer</Th><Th>Order</Th><Th>Priority</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr><td colSpan={7} style={{ ...body, textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>No support tickets.</td></tr>
                )}
                {tickets.map(t => (
                  <tr key={t.id} onClick={() => onOpenTicket(t.id)} style={{ cursor: "pointer" }}>
                    <Td><PlateChip small>{t.id}</PlateChip></Td>
                    <Td style={{ fontWeight: 600 }}>{t.subject}</Td>
                    <Td>{t.buyerId || t.guestEmail || "—"}</Td>
                    <Td style={{ color: C.muted }}>{t.orderId || "—"}</Td>
                    <Td><span style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: priorityColor[t.priority] }} />{t.priority}</span></Td>
                    <Td>
                      {t.status === "open" && <Badge label="Open" color={C.red} bg={C.redBg} />}
                      {t.status === "in_progress" && <Badge label="In progress" color={C.torque} bg={C.torqueBg} />}
                      {t.status === "resolved" && <Badge label="Resolved" color={C.gauge} bg={C.gaugeBg} />}
                    </Td>
                    <Td style={{ color: C.muted }}>{new Date(t.updatedAt).toLocaleString()}</Td>
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

function TicketDetailPage({ ticketId, onBack, onSessionExpired }) {
  const [ticket, setTicket] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const load = () => {
    fetchTicketById(getStoredToken(), ticketId)
      .then((data) => { setTicket(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setIsSending(true);
    try {
      await replyToTicket(getStoredToken(), ticketId, replyText.trim());
      setReplyText("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await updateTicketStatus(getStoredToken(), ticketId, status);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  if (loadState === "loading") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
          <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Ticket</div>
        </div>
        <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading ticket…</div>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
          <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Ticket</div>
        </div>
        <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load this ticket: {errorMessage}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>{ticket.subject}</div>
        <PlateChip>{ticket.id}</PlateChip>
      </div>
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Conversation">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {ticket.messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.senderRole === "admin" ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                  <div style={{
                    ...body, fontSize: 13, padding: "10px 14px", borderRadius: 12,
                    background: m.senderRole === "admin" ? C.signal : C.canvas,
                    color: m.senderRole === "admin" ? "#fff" : C.ink,
                  }}>{m.message}</div>
                  <div style={{ ...body, fontSize: 10.5, color: C.muted, marginTop: 3, textAlign: m.senderRole === "admin" ? "right" : "left" }}>
                    {m.senderRole === "admin" ? "Platform" : "Buyer"} · {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 16, borderTop: `1px solid ${C.line}`, display: "flex", gap: 8 }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
                placeholder="Reply to the buyer…"
                style={{ ...body, flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
              />
              <button
                disabled={isSending}
                onClick={handleReply}
                style={{ ...body, padding: "9px 16px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: isSending ? "default" : "pointer", opacity: isSending ? 0.6 : 1 }}
              >Send</button>
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Details">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...body, fontSize: 12, color: C.muted }}>Buyer</div>
              <div style={{ ...body, fontSize: 13, fontWeight: 600 }}>{ticket.buyerId || ticket.guestEmail}</div>
              {ticket.orderId && (
                <>
                  <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 6 }}>Related order</div>
                  <PlateChip small>{ticket.orderId}</PlateChip>
                </>
              )}
            </div>
          </Card>
          <Card title="Status">
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {["open", "in_progress", "resolved"].map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  style={{
                    ...body, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left",
                    border: ticket.status === s ? `2px solid ${C.signal}` : `1px solid ${C.line}`,
                    background: ticket.status === s ? "#FDF1EB" : "#fff",
                  }}
                >{s === "open" ? "Open" : s === "in_progress" ? "In progress" : "Resolved"}</button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const RETURN_STATUS_META = {
  awaiting: { label: "Awaiting reply", color: C.amber, bg: C.amberBg },
  in_progress: { label: "In progress", color: C.torque, bg: C.torqueBg },
  approved: { label: "Approved", color: C.gauge, bg: C.gaugeBg },
  rejected: { label: "Rejected", color: C.red, bg: C.redBg },
  completed: { label: "Completed", color: C.gauge, bg: C.gaugeBg },
};
function getReturnStatusMeta(status) {
  return RETURN_STATUS_META[status] || { label: status || "Unknown", color: C.muted, bg: "#EEEFF1" };
}

function ReturnsPage({ onOpenCase, onSessionExpired }) {
  const [cases, setCases] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    fetchReturnCases(getStoredToken())
      .then((data) => { setCases(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, [onSessionExpired]);

  return (
    <div>
      <TopBar title="Returns & disputes" subtitle={loadState === "ready" ? `${cases.length} cases` : "Loading…"} />
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end" }}>
        {/* Real export (new) -- same reusable exportToExcel() util already
            used for Orders/Payouts/Audit Log, just never added here. */}
        <button
          disabled={cases.length === 0}
          onClick={() => exportToExcel({
            filename: `returns-${new Date().toISOString().slice(0, 10)}`,
            sheetName: "Returns",
            columns: [
              { header: "Case", key: "id", width: 14 },
              { header: "Order", key: "orderId", width: 16 },
              { header: "Buyer", key: "buyer", width: 30 },
              { header: "Reason", key: "reason", width: 30 },
              { header: "Status", key: "status", width: 16 },
              { header: "Updated", key: "updatedAt", width: 16 },
            ],
            rows: cases.map((c) => ({
              id: c.id, orderId: c.orderId, buyer: c.buyerId || c.guestEmail || "—",
              reason: c.reason, status: getReturnStatusMeta(c.status).label,
              updatedAt: new Date(c.updatedAt).toLocaleDateString(),
            })),
          })}
          style={{ display: "flex", alignItems: "center", gap: 6, ...body, fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, cursor: cases.length === 0 ? "default" : "pointer", opacity: cases.length === 0 ? 0.5 : 1 }}
        >
          <Download size={13} /> Export
        </button>
      </div>
      <div style={{ padding: 24 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading return cases…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load return cases: {errorMessage}</div></Card>}
        {loadState === "ready" && (
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Case</Th><Th>Order</Th><Th>Buyer</Th><Th>Reason</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {cases.length === 0 && (
                  <tr><td colSpan={6} style={{ ...body, textAlign: "center", color: C.muted, fontSize: 13, padding: 32 }}>No return cases.</td></tr>
                )}
                {cases.map(c => {
                  const meta = getReturnStatusMeta(c.status);
                  return (
                    <tr key={c.id} onClick={() => onOpenCase(c.id)} style={{ cursor: "pointer" }}>
                      <Td><PlateChip small>{c.id}</PlateChip></Td>
                      <Td><PlateChip small>{c.orderId}</PlateChip></Td>
                      <Td>{c.buyerId || c.guestEmail || "—"}</Td>
                      <Td style={{ maxWidth: 260 }}>{c.reason}</Td>
                      <Td><Badge label={meta.label} color={meta.color} bg={meta.bg} /></Td>
                      <Td style={{ color: C.muted }}>{new Date(c.updatedAt).toLocaleString()}</Td>
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

function ReturnCaseDetailPage({ caseId, onBack, onSessionExpired }) {
  const [returnCase, setReturnCase] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [buyerReply, setBuyerReply] = useState("");
  const [supplierReply, setSupplierReply] = useState("");
  const [isSending, setIsSending] = useState(false);

  const load = () => {
    fetchReturnCaseById(getStoredToken(), caseId)
      .then((data) => { setReturnCase(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendBuyerReply = async () => {
    if (!buyerReply.trim()) return;
    setIsSending(true);
    try {
      await replyToReturnCaseBuyer(getStoredToken(), caseId, buyerReply.trim());
      setBuyerReply("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const sendSupplierReply = async () => {
    if (!supplierReply.trim()) return;
    setIsSending(true);
    try {
      await replyToReturnCaseSupplier(getStoredToken(), caseId, supplierReply.trim());
      setSupplierReply("");
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await updateReturnCaseStatus(getStoredToken(), caseId, status);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  if (loadState === "loading") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
          <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Return case</div>
        </div>
        <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading…</div>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
          <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>Return case</div>
        </div>
        <div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load this case: {errorMessage}</div>
      </div>
    );
  }

  const meta = getReturnStatusMeta(returnCase.status);
  const statusOptions = ["awaiting", "in_progress", "approved", "rejected", "completed"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={20} color={C.ink} /></button>
        <div style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>{returnCase.reason}</div>
        <PlateChip>{returnCase.id}</PlateChip>
        <Badge label={meta.label} color={meta.color} bg={meta.bg} />
      </div>
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Buyer thread">
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto" }}>
              {returnCase.buyerMessages.map((m, i) => (
                <div key={i} style={{ ...body, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, background: m.senderRole === "admin" ? C.torqueBg : C.canvas }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, color: C.muted, marginBottom: 2 }}>{m.senderRole === "admin" ? "Platform" : "Buyer"}</div>
                  {m.message}
                </div>
              ))}
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: "flex", gap: 8 }}>
              <input value={buyerReply} onChange={(e) => setBuyerReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendBuyerReply()} placeholder="Reply to buyer…" style={{ ...body, flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }} />
              <button disabled={isSending} onClick={sendBuyerReply} style={{ ...body, padding: "8px 14px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSending ? "default" : "pointer" }}>Send</button>
            </div>
          </Card>
          <Card title="Supplier thread">
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto" }}>
              {returnCase.supplierMessages.map((m, i) => (
                <div key={i} style={{ ...body, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, background: m.senderRole === "admin" ? C.torqueBg : C.canvas }}>
                  <div style={{ fontWeight: 700, fontSize: 10.5, color: C.muted, marginBottom: 2 }}>{m.senderRole === "admin" ? "Platform" : "Supplier"}</div>
                  {m.message}
                </div>
              ))}
              {returnCase.supplierMessages.length === 0 && <div style={{ ...body, fontSize: 12, color: C.muted, textAlign: "center", padding: 12 }}>No messages yet.</div>}
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: "flex", gap: 8 }}>
              <input value={supplierReply} onChange={(e) => setSupplierReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendSupplierReply()} placeholder="Message supplier…" style={{ ...body, flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }} />
              <button disabled={isSending} onClick={sendSupplierReply} style={{ ...body, padding: "8px 14px", borderRadius: 8, border: "none", background: C.signal, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: isSending ? "default" : "pointer" }}>Send</button>
            </div>
          </Card>
          <div style={{ ...body, fontSize: 11, color: C.muted, padding: "0 4px" }}>
            These two threads are structurally separate — the buyer never sees supplier messages, and the supplier never sees buyer messages or identity. No direct buyer↔supplier contact, per policy.
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Case details">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ ...body, fontSize: 12, color: C.muted }}>Buyer</div>
              <div style={{ ...body, fontSize: 13, fontWeight: 600 }}>{returnCase.buyerId || returnCase.guestEmail}</div>
              <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 6 }}>Related order</div>
              <PlateChip small>{returnCase.orderId}</PlateChip>
              {/* Real evidence photos (migration 043) -- this field was
                  already returned by GET /returns/:id, just never
                  rendered here until now. Deliberately shown in this
                  admin-only card, not the buyer/supplier threads --
                  matches the backend's own isolation (never exposed via
                  GET /returns/supplier/me/:id at all). */}
              {returnCase.photos && returnCase.photos.length > 0 && (
                <>
                  <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 6 }}>Evidence photos</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {returnCase.photos.map((url, i) => (
                      <a key={i} href={`${API_BASE_URL}${url}`} target="_blank" rel="noreferrer">
                        <img src={`${API_BASE_URL}${url}`} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.line}` }} />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
          <Card title="Status">
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {statusOptions.map(s => {
                const m = getReturnStatusMeta(s);
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    style={{
                      ...body, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left",
                      border: returnCase.status === s ? `2px solid ${C.signal}` : `1px solid ${C.line}`,
                      background: returnCase.status === s ? "#FDF1EB" : "#fff",
                    }}
                  >{m.label}</button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Real admin team & permissions management (migration 022), owner-only.
// CONFIRMED SCOPE, 2 real scenarios validated before building: one real
// "owner" admin manages permissions for every other admin account;
// page-level access control (can a given admin see a given page,
// yes/no), not finer view-vs-edit control within a page.
function TeamPermissionsSection({ currentUser, onSessionExpired }) {
  const [admins, setAdmins] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [editingPages, setEditingPages] = useState({}); // { [userId]: Set<pageId> }

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPages, setNewPages] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = () => {
    setLoadState("loading");
    fetchAdminUsers(getStoredToken())
      .then((data) => {
        setAdmins(data);
        const initialEditing = {};
        data.forEach((a) => { initialEditing[a.id] = new Set(a.isOwner ? [] : a.allowedPages); });
        setEditingPages(initialEditing);
        setLoadState("ready");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser.isOwner) {
    return (
      <Card title="Team & permissions" style={{ flex: 1 }}>
        <div style={{ padding: 20, ...body, fontSize: 12.5, color: C.muted }}>
          Only the owner account can manage other admins' permissions.
        </div>
      </Card>
    );
  }

  const togglePageForUser = (userId, pageId) => {
    setEditingPages((prev) => {
      const next = new Set(prev[userId]);
      if (next.has(pageId)) next.delete(pageId); else next.add(pageId);
      return { ...prev, [userId]: next };
    });
  };

  const handleSavePermissions = async (userId) => {
    try {
      await updateAdminPermissions(getStoredToken(), userId, Array.from(editingPages[userId] || []));
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  const handleDelete = async (userId) => {
    try {
      await deleteAdminUser(getStoredToken(), userId);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    }
  };

  const handleCreate = async () => {
    if (!newEmail.trim() || newPassword.length < 8) {
      setErrorMessage("A valid email and a password of at least 8 characters are required.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createAdminUser(getStoredToken(), {
        email: newEmail.trim(), password: newPassword, name: newName.trim() || null,
        allowedPages: Array.from(newPages),
      });
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewPages(new Set()); setShowCreateForm(false);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card title="Team & permissions" style={{ flex: 1 }}>
      <div style={{ padding: 12 }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 12 }}>{errorMessage}</div>}

        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted, padding: 12 }}>Loading…</div>}
        {loadState === "ready" && admins.map((a, i) => (
          <div key={a.id} style={{ padding: "12px 6px", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: a.isOwner ? 0 : 8 }}>
              <div>
                <div style={{ ...body, fontWeight: 700, fontSize: 13 }}>{a.name || a.email}</div>
                <div style={{ ...body, fontSize: 11.5, color: C.muted }}>{a.email}</div>
              </div>
              {a.isOwner ? (
                <PlateChip small>Owner — full access</PlateChip>
              ) : (
                <button onClick={() => handleDelete(a.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} title="Remove admin">
                  <X size={15} color={C.red} />
                </button>
              )}
            </div>
            {!a.isOwner && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 6 }}>
                  {NAV.map((n) => (
                    <label key={n.id} style={{ ...body, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={(editingPages[a.id] || new Set()).has(n.id)}
                        onChange={() => togglePageForUser(a.id, n.id)}
                      />
                      {n.label}
                    </label>
                  ))}
                </div>
                <button onClick={() => handleSavePermissions(a.id)} style={{ ...body, marginTop: 8, padding: "6px 12px", borderRadius: 7, border: "none", background: C.signal, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  Save permissions
                </button>
              </>
            )}
          </div>
        ))}

        {!showCreateForm ? (
          <button onClick={() => setShowCreateForm(true)} style={{ ...body, marginTop: 12, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1.5px dashed ${C.line}`, background: "none", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={14} /> Add admin
          </button>
        ) : (
          <div style={{ marginTop: 12, padding: 14, background: C.canvas, borderRadius: 8 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }} />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Password (min 8 chars)" style={{ ...body, flex: 1, minWidth: 160, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }} />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (optional)" style={{ ...body, flex: 1, minWidth: 140, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }} />
            </div>
            <div style={{ ...body, fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Pages this admin can access:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 10 }}>
              {NAV.map((n) => (
                <label key={n.id} style={{ ...body, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={newPages.has(n.id)}
                    onChange={() => setNewPages((prev) => {
                      const next = new Set(prev);
                      if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
                      return next;
                    })}
                  />
                  {n.label}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={isSubmitting} onClick={handleCreate} style={{ ...body, padding: "7px 14px", borderRadius: 8, border: "none", background: isSubmitting ? "#D1D5DB" : C.signal, color: "#fff", fontSize: 12, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer" }}>
                Create admin
              </button>
              <button onClick={() => setShowCreateForm(false)} style={{ ...body, padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "none", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Real, admin-editable per-category commission rates (migration 024) --
// replaces what was previously a hardcoded, fake display-only card.
// These real rates are what the Payouts page actually calculates from.
function CommissionRulesSection({ onSessionExpired }) {
  const [categories, setCategories] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const load = () => {
    setLoadState("loading");
    fetchCategories()
      .then((data) => { setCategories(data); setLoadState("ready"); })
      .catch((err) => { setErrorMessage(err.message); setLoadState("error"); });
  };
  useEffect(load, []);

  const startEditing = (cat) => { setEditingId(cat.id); setEditValue(String(cat.commissionPercent)); };

  const handleSave = async (categoryId) => {
    const value = Number(editValue);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setErrorMessage("Commission must be a real number between 0 and 100.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await updateCategoryCommission(getStoredToken(), categoryId, value);
      setEditingId(null);
      load();
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card title="Commission rules" style={{ flex: 1 }}>
      <div style={{ padding: 6 }}>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, margin: "0 6px 8px" }}>{errorMessage}</div>}
        {loadState === "loading" && <div style={{ padding: 20, ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        {loadState === "ready" && categories.map((c, i) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: i < categories.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ ...body, fontSize: 13, fontWeight: 600 }}>{c.nameEn}</span>
            {editingId === c.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  style={{ ...body, width: 60, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 6px", fontSize: 12.5 }}
                  autoFocus
                />
                <button disabled={isSaving} onClick={() => handleSave(c.id)} style={{ ...body, padding: "5px 10px", borderRadius: 6, border: "none", background: C.gauge, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ ...body, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.line}`, background: "none", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => startEditing(c)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <PlateChip small>{c.commissionPercent}%</PlateChip>
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// Real, admin-configurable return window (migration 024), constrained
// to the confirmed 3-7 real day range -- this determines both the real
// deadline for a buyer to file a return, and when an order genuinely
// becomes eligible for payout on the Payouts page.
function ReturnWindowSection({ onSessionExpired }) {
  const [days, setDays] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [savedMessage, setSavedMessage] = useState(null);

  useEffect(() => {
    fetchReturnWindow(getStoredToken())
      .then((data) => { setDays(data.returnWindowDays); setLoadState("ready"); })
      .catch((err) => { setErrorMessage(err.message); setLoadState("error"); });
  }, []);

  const handleChange = async (value) => {
    setDays(value);
    setIsSaving(true);
    setErrorMessage(null);
    setSavedMessage(null);
    try {
      await updateReturnWindow(getStoredToken(), value);
      setSavedMessage("Saved.");
    } catch (err) {
      if (err instanceof SessionExpiredError) return onSessionExpired();
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card title="Return window" style={{ flex: 1 }}>
      <div style={{ padding: 20 }}>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 14 }}>
          How many days after delivery a buyer can file a return. This also determines when an order becomes eligible for payout on the Payouts page.
        </div>
        {errorMessage && <div style={{ ...body, fontSize: 12, color: C.red, background: C.redBg, borderRadius: 8, padding: 10, marginBottom: 12 }}>{errorMessage}</div>}
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        {loadState === "ready" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={days}
              onChange={(e) => handleChange(Number(e.target.value))}
              disabled={isSaving}
              style={{ ...body, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 11px", fontSize: 13 }}
            >
              {[3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
            {isSaving && <span style={{ ...body, fontSize: 12, color: C.muted }}>Saving…</span>}
            {!isSaving && savedMessage && <span style={{ ...body, fontSize: 12, color: C.gauge }}>{savedMessage}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

function AuditLogSection({ currentUser, onSessionExpired }) {
  const [entries, setEntries] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!currentUser.isOwner) return;
    fetchAuditLog(getStoredToken())
      .then((data) => { setEntries(data); setLoadState("ready"); })
      .catch((err) => {
        if (err instanceof SessionExpiredError) return onSessionExpired();
        setErrorMessage(err.message);
        setLoadState("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Real, owner-only section (migration 036) -- who did what across
  // the whole real platform is sensitive enough that it shouldn't be
  // visible to every admin, only the one account with full real
  // oversight, matching the same real restriction already used for
  // admin account management just above.
  if (!currentUser.isOwner) return null;

  return (
    <Card
      title="Audit log"
      style={{ flex: 1, minWidth: 420 }}
      action={
        entries.length > 0 && (
          <button
            onClick={() => exportToExcel({
              filename: `audit-log-${new Date().toISOString().slice(0, 10)}`,
              sheetName: "Audit Log",
              columns: [
                { header: "Date/time", key: "createdAt", width: 22 },
                { header: "Admin", key: "adminEmail", width: 28 },
                { header: "Action", key: "action", width: 28 },
                { header: "Target type", key: "targetType", width: 16 },
                { header: "Target ID", key: "targetId", width: 20 },
                { header: "Details", key: "details", width: 50 },
              ],
              rows: entries.map((e) => ({
                createdAt: new Date(e.createdAt).toLocaleString(),
                adminEmail: e.adminEmail,
                action: e.action,
                targetType: e.targetType,
                targetId: e.targetId || "",
                details: e.details ? JSON.stringify(e.details) : "",
              })),
            })}
            style={{ ...body, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            <Download size={14} /> Export
          </button>
        )
      }
    >
      <div style={{ padding: 16 }}>
        <div style={{ ...body, fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
          A real record of sensitive admin actions — supplier verification, review moderation, payouts, promo codes, admin account changes, and pricing/settings changes.
        </div>
        {loadState === "loading" && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>Loading…</div>}
        {loadState === "error" && <div style={{ ...body, fontSize: 12.5, color: C.red }}>Couldn't load the audit log: {errorMessage}</div>}
        {loadState === "ready" && entries.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>No actions recorded yet.</div>}
        {loadState === "ready" && entries.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {entries.map((e) => (
              <div key={e.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ ...body, fontSize: 12.5, fontWeight: 700 }}>{e.action.replace(/_/g, " ")}</span>
                  <span style={{ ...body, fontSize: 11, color: C.muted }}>{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ ...body, fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                  {e.adminEmail} · {e.targetType}{e.targetId ? ` #${e.targetId}` : ""}
                </div>
                {e.details && (
                  <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>
                    {Object.entries(e.details).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function SettingsPage({ currentUser, onSessionExpired }) {
  return (
    <div>
      <TopBar title="Settings" subtitle="Team permissions, commission rules, and platform configuration" />
      <div style={{ padding: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <TeamPermissionsSection currentUser={currentUser} onSessionExpired={onSessionExpired} />
        <CommissionRulesSection onSessionExpired={onSessionExpired} />
        <ReturnWindowSection onSessionExpired={onSessionExpired} />
        <AuditLogSection currentUser={currentUser} onSessionExpired={onSessionExpired} />
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "suppliers", label: "Suppliers", icon: Store },
  { id: "moderation", label: "Moderation", icon: PackageSearch },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "vehicleData", label: "Vehicle Data", icon: Truck },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "supplierMessages", label: "Supplier Messages", icon: MessageSquare },
  { id: "promoCodes", label: "Promo Codes", icon: Tag },
  { id: "hubs", label: "Hubs", icon: Warehouse },
  { id: "pricing", label: "Pricing", icon: Calculator },
  { id: "flagged", label: "Flagged Shipments", icon: AlertTriangle },
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "tickets", label: "Support", icon: LifeBuoy },
  { id: "settings", label: "Settings", icon: Settings },
];

function AdminDashboardShell({ currentUser, onLogout }) {
  const [page, setPage] = useState(() => {
    const hasAccess = (id) => currentUser.isOwner || currentUser.allowedPages === 'all' || (currentUser.allowedPages || []).includes(id);
    if (hasAccess('overview')) return 'overview';
    const firstAllowed = NAV.find((n) => hasAccess(n.id));
    return firstAllowed ? firstAllowed.id : 'overview';
  });
  const [openOrder, setOpenOrder] = useState(null);
  const [openTicket, setOpenTicket] = useState(null);
  const [openCase, setOpenCase] = useState(null);
  const [flaggedCount, setFlaggedCount] = useState(0);

  useEffect(() => {
    fetchFlaggedShipments(getStoredToken())
      .then((data) => setFlaggedCount(data.length))
      .catch(() => {}); // non-critical -- the sidebar badge just stays at 0 rather than breaking the shell
  }, [page]); // refetch whenever navigating, so returning from the Flagged Shipments page reflects any change

  let content;
  if (openOrder) content = <OrderDetailPage orderId={openOrder} onBack={() => setOpenOrder(null)} onSessionExpired={onLogout} />;
  else if (openTicket) content = <TicketDetailPage ticketId={openTicket} onBack={() => setOpenTicket(null)} onSessionExpired={onLogout} />;
  else if (openCase) content = <ReturnCaseDetailPage caseId={openCase} onBack={() => setOpenCase(null)} onSessionExpired={onLogout} />;
  else if (page === "overview") content = <OverviewPage onSessionExpired={onLogout} />;
  else if (page === "orders") content = <OrdersPage onOpenOrder={setOpenOrder} onSessionExpired={onLogout} />;
  else if (page === "suppliers") content = <SuppliersPage onSessionExpired={onLogout} />;
  else if (page === "moderation") content = <ModerationPage onSessionExpired={onLogout} />;
  else if (page === "returns") content = <ReturnsPage onOpenCase={setOpenCase} onSessionExpired={onLogout} />;
  else if (page === "vehicleData") content = <VehicleDataPage onSessionExpired={onLogout} />;
  else if (page === "categories") content = <CategoriesPage onSessionExpired={onLogout} />;
  else if (page === "supplierMessages") content = <SupplierMessagesPage onSessionExpired={onLogout} />;
  else if (page === "promoCodes") content = <PromoCodesPage onSessionExpired={onLogout} />;
  else if (page === "hubs") content = <HubsPage onSessionExpired={onLogout} />;
  else if (page === "pricing") content = <PricingPage onSessionExpired={onLogout} />;
  else if (page === "flagged") content = <FlaggedShipmentsPage onOpenOrder={setOpenOrder} onSessionExpired={onLogout} />;
  else if (page === "payouts") content = <PayoutsPage onSessionExpired={onLogout} />;
  else if (page === "reviews") content = <ReviewsPage onSessionExpired={onLogout} />;
  else if (page === "tickets") content = <TicketsPage onOpenTicket={setOpenTicket} onSessionExpired={onLogout} />;
  else if (page === "settings") content = <SettingsPage currentUser={currentUser} onSessionExpired={onLogout} />;

  return (
    <CurrentUserContext.Provider value={currentUser}>
    <div style={{ display: "flex", height: "100%", minHeight: 700, background: C.canvas, ...body }}>
      <style>{FONT_IMPORT}</style>
      <style>{`tbody tr:hover { background: ${C.canvas}; }`}</style>
      <div style={{ width: 224, background: C.ink, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 20px 18px" }}>
          <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>LEAP</div>
          <span style={{ ...mono, fontSize: 9, color: "#9AA1AC", border: "1px solid #3A3F48", borderRadius: 4, padding: "2px 5px" }}>OPS</span>
        </div>
        <div style={{ flex: 1, padding: "0 12px" }}>
          {NAV.filter((n) => currentUser.isOwner || currentUser.allowedPages === 'all' || (currentUser.allowedPages || []).includes(n.id)).map(n => {
            const Icon = n.icon;
            const active = page === n.id && !openOrder && !openTicket && !openCase;
            return (
              <button key={n.id} onClick={() => { setPage(n.id); setOpenOrder(null); setOpenTicket(null); setOpenCase(null); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 2, borderRadius: 8,
                border: "none", cursor: "pointer", textAlign: "left",
                background: active ? C.signal : "transparent", color: active ? "#fff" : "#B8BEC9",
              }}>
                <Icon size={16} />
                <span style={{ ...body, fontSize: 13, fontWeight: active ? 700 : 500, flex: 1 }}>{n.label}</span>
                {n.id === "flagged" && flaggedCount > 0 && (
                  <span style={{ ...body, fontSize: 10.5, fontWeight: 700, color: "#fff", background: active ? "rgba(255,255,255,0.25)" : C.red, borderRadius: 10, padding: "1px 7px", minWidth: 18, textAlign: "center" }}>
                    {flaggedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid #2A2F38" }}>
          <div style={{ ...body, fontSize: 12, color: "#fff", fontWeight: 700, marginBottom: 2 }}>{currentUser.name || currentUser.email}</div>
          <div style={{ ...body, fontSize: 10.5, color: "#9AA1AC", marginBottom: 10 }}>{currentUser.email}</div>
          <button onClick={onLogout} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px",
            borderRadius: 6, border: "1px solid #3A3F48", background: "transparent", color: "#B8BEC9", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
          }}>
            <Users size={12} /> Log out
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {content}
      </div>
    </div>
    </CurrentUserContext.Provider>
  );
}

/**
 * Auth gate — checks for a saved session on load (verifying the token is
 * still valid via GET /auth/me, not just trusting whatever's in
 * localStorage), shows LoginPage if not authenticated or not an admin
 * role, otherwise renders the real dashboard.
 */
export default function LeapAdminApp() {
  const [authState, setAuthState] = useState({ status: "checking", user: null });

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthState({ status: "loggedOut", user: null });
      return;
    }
    getCurrentUser(token)
      .then((user) => setAuthState({ status: "loggedIn", user }))
      .catch(() => {
        // Saved token is expired/invalid — don't leave the app stuck
        // thinking it's logged in when every real request would 401.
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

  if (authState.status === "checking") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 700, fontFamily: "'Inter', sans-serif", color: "#6B7280", fontSize: 13 }}>
        Checking session…
      </div>
    );
  }
  if (authState.status === "loggedOut") {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }
  return <AdminDashboardShell currentUser={authState.user} onLogout={handleLogout} />;
}
