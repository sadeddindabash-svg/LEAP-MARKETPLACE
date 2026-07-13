import React, { useState, useEffect } from "react";
import LoginPage from "./LoginPage";
import { getStoredToken, saveToken, clearToken, getCurrentUser, fetchOrders, fetchOrderById, fetchSuppliers, verifySupplier, fetchModerationQueue, moderateProduct, fetchTickets, fetchTicketById, replyToTicket, updateTicketStatus, SessionExpiredError } from "./auth";
import {
  LayoutGrid, ShoppingBag, Store, PackageSearch, Wallet, LifeBuoy, Settings,
  Search, Bell, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Truck,
  CheckCircle2, XCircle, Clock, AlertTriangle, MoreHorizontal, ArrowUpRight,
  Filter as FilterIcon, Download, Check, X, MessageSquare, Star, Globe, Users,
  CreditCard, ExternalLink, ChevronLeft
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

const GMV_TREND = [
  { d: "Mon", v: 18400 }, { d: "Tue", v: 21200 }, { d: "Wed", v: 19800 }, { d: "Thu", v: 24600 },
  { d: "Fri", v: 27300 }, { d: "Sat", v: 31200 }, { d: "Sun", v: 28950 },
];
const CATEGORY_SPLIT = [
  { name: "Brake System", value: 32, color: C.signal },
  { name: "Filters", value: 21, color: C.torque },
  { name: "Electrical", value: 18, color: C.gauge },
  { name: "Engine", value: 15, color: C.amber },
  { name: "Other", value: 14, color: "#9AA1AC" },
];

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

function OverviewPage() {
  const maxV = Math.max(...GMV_TREND.map(x => x.v));
  return (
    <div>
      <TopBar title="Overview" subtitle="Global performance across all launch markets · Last updated 4 min ago" />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <KpiCard label="GMV (7 days)" value="$171,450" delta="+12.4%" positive icon={Wallet} />
          <KpiCard label="Orders" value="2,384" delta="+8.1%" positive icon={ShoppingBag} />
          <KpiCard label="Active suppliers" value="47" delta="+3" positive icon={Store} />
          <KpiCard label="Open disputes" value="6" delta="+2" icon={AlertTriangle} />
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <Card title="GMV trend" style={{ flex: 2 }}>
            <div style={{ padding: "16px 18px 8px", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={GMV_TREND} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.signal} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={C.signal} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 11, fill: C.muted, fontFamily: "Inter" }} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `$${v / 1000}k`} />
                  <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "GMV"]} contentStyle={{ fontFamily: "Inter", fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
                  <Area type="monotone" dataKey="v" stroke={C.signal} strokeWidth={2.5} fill="url(#gmvFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Sales by category" style={{ flex: 1 }}>
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={CATEGORY_SPLIT} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={2}>
                      {CATEGORY_SPLIT.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {CATEGORY_SPLIT.map(c => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                    <span style={{ ...body, fontSize: 11.5, color: C.ink }}>{c.name}</span>
                    <span style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: "auto", paddingLeft: 10 }}>{c.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <Card title="Needs attention" style={{ flex: 1 }}>
            <div style={{ padding: 6 }}>
              <AttentionRow icon={AlertTriangle} color={C.red} text="6 orders flagged as disputes" sub="Oldest unresolved: 3 days" />
              <AttentionRow icon={PackageSearch} color={C.amber} text="4 listings pending moderation" sub="2 from newly onboarded suppliers" />
              <AttentionRow icon={Store} color={C.torque} text="2 suppliers awaiting verification" sub="Submitted within 48 hours" />
              <AttentionRow icon={Wallet} color={C.gauge} text="$19.8k in payouts scheduled" sub="Next payout run: Jul 15" last />
            </div>
          </Card>
          <Card title="Top markets (7 days)" style={{ flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Country</Th><Th align="right">Orders</Th><Th align="right">GMV</Th></tr></thead>
              <tbody>
                {[["United States", 612, "$41.2k"], ["Saudi Arabia", 388, "$26.9k"], ["United Arab Emirates", 301, "$22.1k"], ["Italy", 245, "$17.4k"], ["Mexico", 198, "$14.0k"]].map(r => (
                  <tr key={r[0]}>
                    <Td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Globe size={13} color={C.muted} />{r[0]}</span></Td>
                    <Td align="right">{r[1]}</Td>
                    <Td align="right" style={{ fontWeight: 700 }}>{r[2]}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
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

  const handleModerate = async (productId, action) => {
    setActioningId(productId);
    try {
      await moderateProduct(getStoredToken(), productId, action);
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
        {loadState === "ready" && queue.map(m => (
          <Card key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 9, background: C.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PackageSearch size={19} color={C.ink} />
                </div>
                <div>
                  <div style={{ ...body, fontWeight: 700, fontSize: 13.5, color: C.ink }}>{m.name}</div>
                  <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }}>{m.supplierName} · {m.category} · submitted {new Date(m.submittedAt).toLocaleDateString()}</div>
                  {m.flags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {m.flags.map(f => <Badge key={f} label={f} color={C.amber} bg={C.amberBg} />)}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={actioningId === m.id}
                  onClick={() => handleModerate(m.id, "approve")}
                  style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: C.gaugeBg, color: C.gauge, fontSize: 12.5, fontWeight: 700, cursor: actioningId === m.id ? "default" : "pointer", opacity: actioningId === m.id ? 0.5 : 1 }}
                ><Check size={13} />Approve</button>
                <button
                  disabled={actioningId === m.id}
                  onClick={() => handleModerate(m.id, "reject")}
                  style={{ ...body, display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, border: "none", background: C.redBg, color: C.red, fontSize: 12.5, fontWeight: 700, cursor: actioningId === m.id ? "default" : "pointer", opacity: actioningId === m.id ? 0.5 : 1 }}
                ><X size={13} />Reject</button>
              </div>
            </div>
          </Card>
        ))}
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
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "tickets", label: "Support", icon: LifeBuoy },
  { id: "settings", label: "Settings", icon: Settings },
];

function AdminDashboardShell({ currentUser, onLogout }) {
  const [page, setPage] = useState("overview");
  const [openOrder, setOpenOrder] = useState(null);
  const [openTicket, setOpenTicket] = useState(null);

  let content;
  if (openOrder) content = <OrderDetailPage orderId={openOrder} onBack={() => setOpenOrder(null)} onSessionExpired={onLogout} />;
  else if (openTicket) content = <TicketDetailPage ticketId={openTicket} onBack={() => setOpenTicket(null)} onSessionExpired={onLogout} />;
  else if (page === "overview") content = <OverviewPage />;
  else if (page === "orders") content = <OrdersPage onOpenOrder={setOpenOrder} onSessionExpired={onLogout} />;
  else if (page === "suppliers") content = <SuppliersPage onSessionExpired={onLogout} />;
  else if (page === "moderation") content = <ModerationPage onSessionExpired={onLogout} />;
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
            const active = page === n.id && !openOrder && !openTicket;
            return (
              <button key={n.id} onClick={() => { setPage(n.id); setOpenOrder(null); setOpenTicket(null); }} style={{
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
