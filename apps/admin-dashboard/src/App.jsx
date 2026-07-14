import React, { useState, useEffect } from "react";
import LoginPage from "./LoginPage";
import { getStoredToken, saveToken, clearToken, getCurrentUser, fetchOrders, fetchOrderById, fetchSuppliers, verifySupplier, fetchModerationQueue, moderateProduct, fetchTickets, fetchTicketById, replyToTicket, updateTicketStatus, fetchReturnCases, fetchReturnCaseById, replyToReturnCaseBuyer, replyToReturnCaseSupplier, updateReturnCaseStatus, fetchOverview, API_BASE_URL, SessionExpiredError,
  fetchBrands, fetchModelsForBrand, fetchGenerationsForModel, fetchEnginesForGeneration, fetchTransmissionsForGeneration,
  createBrand, deleteBrand, createModel, deleteModel, createGeneration, deleteGeneration, createEngine, deleteEngine, createTransmission, deleteTransmission,
} from "./auth";
import {
  LayoutGrid, ShoppingBag, Store, PackageSearch, Wallet, LifeBuoy, Settings,
  Search, Bell, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Truck,
  CheckCircle2, XCircle, Clock, AlertTriangle, MoreHorizontal, ArrowUpRight,
  Filter as FilterIcon, Download, Check, X, MessageSquare, Star, Globe, Users,
  CreditCard, ExternalLink, ChevronLeft, RotateCcw
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

const PAYOUTS = [
  { supplier: "Guangzhou AutoParts Co.", pending: 8420.50, lastPaid: 21980.00, date: "Jul 8, 2026", status: "scheduled" },
  { supplier: "Ningbo Filtration Ltd.", pending: 5310.20, lastPaid: 14650.75, date: "Jul 8, 2026", status: "scheduled" },
  { supplier: "Shenzhen Power Cells", pending: 3120.00, lastPaid: 9870.40, date: "Jul 8, 2026", status: "scheduled" },
  { supplier: "Foshan Brake Systems", pending: 1980.75, lastPaid: 6210.10, date: "Jul 1, 2026", status: "paid" },
  { supplier: "Dongguan Lighting Co.", pending: 940.30, lastPaid: 3105.60, date: "Jul 1, 2026", status: "held" },
];

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

function TopBar({ title, subtitle }) {
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
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...body, fontWeight: 700, fontSize: 12.5 }}>OM</div>
          <div>
            <div style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink }}>Omar M.</div>
            <div style={{ ...body, fontSize: 10.5, color: C.muted }}>Ops Admin</div>
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
        <button style={{ ...body, display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer" }}>
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

function OrderDetailPage({ orderId, onBack, onSessionExpired }) {
  const [order, setOrder] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrderById(getStoredToken(), orderId)
      .then((data) => {
        if (cancelled) return;
        setOrder(data);
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
  }, [orderId, onSessionExpired]);

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
  };
  const cancelReview = () => { setReviewingId(null); setNameEn(""); setDescriptionEn(""); };

  const confirmApproval = async (productId) => {
    if (!nameEn.trim()) {
      setErrorMessage("Enter the reviewed English name before approving.");
      return;
    }
    setActioningId(productId);
    try {
      await moderateProduct(getStoredToken(), productId, "approve", { nameEn: nameEn.trim(), descriptionEn: descriptionEn.trim() || undefined });
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

  return (
    <div>
      <TopBar title="Catalog moderation" subtitle={loadState === "ready" ? `${queue.length} listings awaiting review` : "Loading…"} />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {loadState === "loading" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Loading moderation queue…</div></Card>}
        {loadState === "error" && <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.red }}>Couldn't load the moderation queue: {errorMessage}</div></Card>}
        {loadState === "ready" && queue.length === 0 && (
          <Card><div style={{ padding: 32, textAlign: "center", ...body, fontSize: 13, color: C.muted }}>Nothing awaiting review right now.</div></Card>
        )}
        {loadState === "ready" && queue.map(m => {
          const isReviewing = reviewingId === m.id;
          return (
            <Card key={m.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
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

function PayoutsPage() {
  const totalPending = PAYOUTS.reduce((s, p) => s + p.pending, 0);
  return (
    <div>
      <TopBar title="Commission & payouts" subtitle="Next scheduled payout run: Jul 15, 2026" />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <KpiCard label="Pending payouts" value={`$${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} delta="+6.2%" positive icon={Wallet} />
          <KpiCard label="Commission revenue (MTD)" value="$28,140" delta="+9.7%" positive icon={TrendingUp} />
          <KpiCard label="Held for review" value="$940.30" delta="1 supplier" icon={AlertTriangle} />
        </div>
        <Card title="Supplier payout schedule">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><Th>Supplier</Th><Th align="right">Pending</Th><Th align="right">Last paid</Th><Th>Payout date</Th><Th>Status</Th><Th></Th></tr></thead>
            <tbody>
              {PAYOUTS.map(p => (
                <tr key={p.supplier}>
                  <Td style={{ fontWeight: 600 }}>{p.supplier}</Td>
                  <Td align="right">${p.pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Td>
                  <Td align="right" style={{ color: C.muted }}>${p.lastPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Td>
                  <Td>{p.date}</Td>
                  <Td>
                    {p.status === "scheduled" && <Badge label="Scheduled" color={C.torque} bg={C.torqueBg} />}
                    {p.status === "paid" && <Badge label="Paid" color={C.gauge} bg={C.gaugeBg} />}
                    {p.status === "held" && <Badge label="Held" color={C.red} bg={C.redBg} />}
                  </Td>
                  <Td align="right"><ExternalLink size={14} color={C.muted} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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

function SettingsPage() {
  return (
    <div>
      <TopBar title="Settings" subtitle="Roles, commission rules, and platform configuration" />
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <Card title="Roles & access" style={{ flex: 1 }}>
          <div style={{ padding: 6 }}>
            {[["Super Admin", "Full access", "2 users"], ["Catalog Moderator", "Listings & translations only", "4 users"], ["Support Agent", "Tickets & orders (read-only)", "9 users"], ["Finance Admin", "Payouts & commission", "3 users"]].map((r, i) => (
              <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
                <div>
                  <div style={{ ...body, fontWeight: 600, fontSize: 13 }}>{r[0]}</div>
                  <div style={{ ...body, fontSize: 11.5, color: C.muted }}>{r[1]}</div>
                </div>
                <span style={{ ...body, fontSize: 11.5, color: C.muted }}>{r[2]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Commission rules" style={{ flex: 1 }}>
          <div style={{ padding: 6 }}>
            {[["Brake System", "12%"], ["Filters", "10%"], ["Electrical", "13%"], ["Engine", "14%"], ["Default", "11%"]].map((r, i) => (
              <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderBottom: i < 4 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ ...body, fontSize: 13, fontWeight: 600 }}>{r[0]}</span>
                <PlateChip small>{r[1]}</PlateChip>
              </div>
            ))}
          </div>
        </Card>
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
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "tickets", label: "Support", icon: LifeBuoy },
  { id: "settings", label: "Settings", icon: Settings },
];

function AdminDashboardShell({ currentUser, onLogout }) {
  const [page, setPage] = useState("overview");
  const [openOrder, setOpenOrder] = useState(null);
  const [openTicket, setOpenTicket] = useState(null);
  const [openCase, setOpenCase] = useState(null);

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
  else if (page === "payouts") content = <PayoutsPage />;
  else if (page === "tickets") content = <TicketsPage onOpenTicket={setOpenTicket} onSessionExpired={onLogout} />;
  else if (page === "settings") content = <SettingsPage />;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 700, background: C.canvas, ...body }}>
      <style>{FONT_IMPORT}</style>
      <style>{`tbody tr:hover { background: ${C.canvas}; }`}</style>
      <div style={{ width: 224, background: C.ink, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 20px 18px" }}>
          <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>LEAP</div>
          <span style={{ ...mono, fontSize: 9, color: "#9AA1AC", border: "1px solid #3A3F48", borderRadius: 4, padding: "2px 5px" }}>OPS</span>
        </div>
        <div style={{ flex: 1, padding: "0 12px" }}>
          {NAV.map(n => {
            const Icon = n.icon;
            const active = page === n.id && !openOrder && !openTicket && !openCase;
            return (
              <button key={n.id} onClick={() => { setPage(n.id); setOpenOrder(null); setOpenTicket(null); setOpenCase(null); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 2, borderRadius: 8,
                border: "none", cursor: "pointer", textAlign: "left",
                background: active ? C.signal : "transparent", color: active ? "#fff" : "#B8BEC9",
              }}>
                <Icon size={16} />
                <span style={{ ...body, fontSize: 13, fontWeight: active ? 700 : 500 }}>{n.label}</span>
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
