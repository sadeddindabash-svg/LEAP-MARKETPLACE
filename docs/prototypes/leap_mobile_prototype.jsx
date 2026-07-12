import React, { useState } from "react";
import {
  Home, Grid3x3, ShoppingCart, Package, User, ChevronLeft, ChevronRight,
  Search, Star, Plus, Minus, MapPin, MessageCircle, Car, Disc, BatteryMedium,
  Filter as FilterIcon, Wrench, Lightbulb, Fan, Gauge, ShieldCheck, Fuel,
  Check, Truck, Clock, X, Send, ChevronDown, CreditCard, Wallet, SlidersHorizontal,
  BadgeCheck, PackageCheck, RotateCcw, Plug, Cog
} from "lucide-react";

/* ============================================================
   LEAP — token system
   Color:  Asphalt #14171C (ink/headers) · Chalk #F5F6F8 (app bg)
           Signal #E8622C (primary action) · Torque #2A5FD9 (info/links)
           Gauge  #1E9D6B (success/in-stock) · Amber #F2A93B (pending)
   Type:   Barlow Condensed (display/numerals) · Inter (body/UI) · JetBrains Mono (codes/plates)
   Signature: "plate chip" — a license-plate-style tag used for the active
   vehicle filter, order/tracking codes, and status badges.
   ============================================================ */

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";

const C = {
  ink: "#14171C",
  ink2: "#20242B",
  chalk: "#F5F6F8",
  line: "#E4E6EA",
  signal: "#E8622C",
  signalDark: "#C94F1E",
  torque: "#2A5FD9",
  gauge: "#1E9D6B",
  amber: "#B9791F",
  amberBg: "#FCEFD8",
  gaugeBg: "#E4F5EC",
  torqueBg: "#E9EFFC",
  muted: "#6B7280",
};

const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

/* ---------------- Mock data ---------------- */

const VEHICLES = [
  { id: "v1", label: "BMW 1 Hatchback (F20)", sub: "118d 2.0 · 110kW/150PS", years: "2015–2019" },
  { id: "v2", label: "Toyota Camry (XV70)", sub: "2.5L SE", years: "2018–2023" },
  { id: "v3", label: "Honda Civic (FC)", sub: "1.5L Turbo Sport", years: "2016–2021" },
];

const CATEGORIES = [
  { id: "brake", name: "Brake System", icon: Disc },
  { id: "engine", name: "Engine", icon: Cog },
  { id: "electrical", name: "Electrical", icon: Plug },
  { id: "filters", name: "Filters", icon: FilterIcon },
  { id: "suspension", name: "Suspension", icon: Wrench },
  { id: "lighting", name: "Lighting", icon: Lightbulb },
  { id: "cooling", name: "Cooling", icon: Fan },
  { id: "battery", name: "Battery", icon: BatteryMedium },
];

const PRODUCTS = [
  { id: "p1", name: "RIDEX Front Brake Disc, Vented 300mm", cat: "brake", price: 34.9, mrp: 58, supplier: "Guangzhou AutoParts Co.", rating: 4.6, reviews: 812, stock: "In stock", days: 6, icon: Disc, fits: ["v1"] },
  { id: "p2", name: "RIDEX Rear Brake Disc, Solid 290mm", cat: "brake", price: 22.49, mrp: 48, supplier: "Guangzhou AutoParts Co.", rating: 4.5, reviews: 501, stock: "Low stock", days: 6, icon: Disc, fits: ["v1"] },
  { id: "p3", name: "Bosch Ceramic Brake Pad Set, Front", cat: "brake", price: 41.2, mrp: 64, supplier: "Foshan Brake Systems", rating: 4.8, reviews: 1290, stock: "In stock", days: 5, icon: Disc, fits: ["v1", "v2"] },
  { id: "p4", name: "MAHLE Oil Filter Element", cat: "filters", price: 6.9, mrp: 11, supplier: "Ningbo Filtration Ltd.", rating: 4.7, reviews: 2210, stock: "In stock", days: 4, icon: FilterIcon, fits: ["v1", "v2", "v3"] },
  { id: "p5", name: "MANN Cabin Air Filter, Activated Carbon", cat: "filters", price: 9.4, mrp: 15, supplier: "Ningbo Filtration Ltd.", rating: 4.6, reviews: 985, stock: "In stock", days: 4, icon: FilterIcon, fits: ["v1", "v3"] },
  { id: "p6", name: "VARTA Silver Dynamic Battery 70Ah", cat: "battery", price: 118, mrp: 165, supplier: "Shenzhen Power Cells", rating: 4.9, reviews: 640, stock: "In stock", days: 7, icon: BatteryMedium, fits: ["v1", "v2"] },
  { id: "p7", name: "OSRAM Night Breaker LED Headlight Bulb Set", cat: "lighting", price: 27.5, mrp: 39, supplier: "Dongguan Lighting Co.", rating: 4.4, reviews: 355, stock: "In stock", days: 5, icon: Lightbulb, fits: ["v1", "v2", "v3"] },
  { id: "p8", name: "SACHS Front Shock Absorber (each)", cat: "suspension", price: 52.3, mrp: 79, supplier: "Foshan Brake Systems", rating: 4.5, reviews: 210, stock: "In stock", days: 8, icon: Wrench, fits: ["v1"] },
  { id: "p9", name: "Denso Radiator Cooling Fan Assembly", cat: "cooling", price: 64.0, mrp: 95, supplier: "Ningbo Filtration Ltd.", rating: 4.3, reviews: 128, stock: "Low stock", days: 9, icon: Fan, fits: ["v2"] },
  { id: "p10", name: "Bosch Ignition Coil Pack", cat: "engine", price: 29.9, mrp: 44, supplier: "Guangzhou AutoParts Co.", rating: 4.7, reviews: 675, stock: "In stock", days: 5, icon: Cog, fits: ["v1", "v3"] },
];

const ORDERS = [
  {
    id: "LP-208841", placed: "Jul 4, 2026", status: "shipped", total: 63.29,
    items: [{ name: "RIDEX Front Brake Disc, Vented 300mm", qty: 1, supplier: "Guangzhou AutoParts Co." }, { name: "MAHLE Oil Filter Element", qty: 2, supplier: "Ningbo Filtration Ltd." }],
    tracking: "CN-GLB-77213840",
  },
  {
    id: "LP-208690", placed: "Jun 27, 2026", status: "delivered", total: 118.0,
    items: [{ name: "VARTA Silver Dynamic Battery 70Ah", qty: 1, supplier: "Shenzhen Power Cells" }],
    tracking: "CN-GLB-77198210",
  },
  {
    id: "LP-208412", placed: "Jun 15, 2026", status: "to_review", total: 27.5,
    items: [{ name: "OSRAM Night Breaker LED Headlight Bulb Set", qty: 1, supplier: "Dongguan Lighting Co." }],
    tracking: "CN-GLB-77150022",
  },
];

const STATUS_META = {
  to_pay: { label: "To pay", color: C.amber, bg: C.amberBg },
  to_ship: { label: "To ship", color: C.torque, bg: C.torqueBg },
  shipped: { label: "Shipped", color: C.torque, bg: C.torqueBg },
  to_review: { label: "To review", color: C.amber, bg: C.amberBg },
  delivered: { label: "Delivered", color: C.gauge, bg: C.gaugeBg },
  returns: { label: "Returns", color: C.signal, bg: "#FBE7DE" },
};

/* ---------------- Small building blocks ---------------- */

function PlateChip({ children, tone = "ink", small, full }) {
  const toneStyles = {
    ink: { border: `1.5px solid ${C.ink}`, color: C.ink },
    signal: { border: `1.5px solid ${C.signal}`, color: C.signalDark },
    ghost: { border: `1.5px solid #FFFFFF55`, color: "#fff" },
  }[tone];
  return (
    <span
      style={{
        ...mono, ...toneStyles,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: small ? "3px 8px" : "6px 12px",
        borderRadius: 6, fontSize: small ? 10 : 12, fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        width: full ? "100%" : "auto", justifyContent: full ? "space-between" : "flex-start",
        background: tone === "ghost" ? "transparent" : "#fff",
      }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.to_pay;
  return (
    <span style={{ ...body, background: m.bg, color: m.color, fontWeight: 700, fontSize: 11, padding: "4px 9px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.03em" }}>
      {m.label}
    </span>
  );
}

function Stars({ rating }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} fill={i <= Math.round(rating) ? C.amber : "none"} color={i <= Math.round(rating) ? C.amber : "#D1D5DB"} />
      ))}
    </span>
  );
}

function ScreenHeader({ title, onBack, right }) {
  return (
    <div style={{ ...body, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#fff", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 32 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: C.ink }}>
            <ChevronLeft size={22} />
          </button>
        )}
      </div>
      <div style={{ ...disp, fontSize: 19, fontWeight: 600, color: C.ink, letterSpacing: "0.01em" }}>{title}</div>
      <div style={{ minWidth: 32, display: "flex", justifyContent: "flex-end" }}>{right}</div>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "categories", label: "Shop", icon: Grid3x3 },
    { id: "cart", label: "Cart", icon: ShoppingCart },
    { id: "orders", label: "Orders", icon: Package },
    { id: "account", label: "Account", icon: User },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, background: "#fff", padding: "8px 4px 10px" }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", padding: "4px 0" }}>
            <Icon size={20} color={isActive ? C.signal : C.muted} strokeWidth={isActive ? 2.4 : 1.8} />
            <span style={{ ...body, fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? C.signal : C.muted }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PrimaryButton({ children, onClick, style, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...body, background: disabled ? "#D1D5DB" : C.signal, color: "#fff", border: "none",
      borderRadius: 10, padding: "13px 16px", fontWeight: 700, fontSize: 14.5,
      cursor: disabled ? "default" : "pointer", width: "100%", letterSpacing: "0.01em", ...style,
    }}>
      {children}
    </button>
  );
}

/* ---------------- Screens ---------------- */

function HomeScreen({ vehicle, onOpenGarage, onOpenCategory, onOpenProduct, onOpenSearch }) {
  const recommended = PRODUCTS.filter(p => !vehicle || p.fits.includes(vehicle.id)).slice(0, 4);
  return (
    <div>
      <div style={{ background: C.ink, padding: "16px 16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ ...disp, color: "#fff", fontSize: 26, fontWeight: 700, letterSpacing: "0.02em" }}>LEAP</div>
          <MessageCircle size={20} color="#fff" />
        </div>
        <button onClick={onOpenSearch} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#2A2F38", border: "none", borderRadius: 10, padding: "11px 12px", cursor: "pointer" }}>
          <Search size={16} color="#9AA1AC" />
          <span style={{ ...body, color: "#9AA1AC", fontSize: 13.5 }}>Search part, brand, or number</span>
        </button>
      </div>

      <div style={{ padding: "14px 16px" }}>
        <button onClick={onOpenGarage} style={{ width: "100%", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: "0 1px 3px rgba(20,23,28,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car size={18} color={C.ink} />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ ...body, fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Shopping for</div>
              {vehicle ? (
                <PlateChip small>{vehicle.label} · {vehicle.sub.split(" · ")[0]}</PlateChip>
              ) : (
                <div style={{ ...body, fontSize: 13, color: C.ink, fontWeight: 600 }}>Add your vehicle</div>
              )}
            </div>
          </div>
          <ChevronRight size={18} color={C.muted} />
        </button>
      </div>

      <div style={{ padding: "4px 16px 8px" }}>
        <div style={{ ...disp, fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 10 }}>Shop by category</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.id} onClick={() => onOpenCategory(c)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.line}` }}>
                  <Icon size={20} color={C.ink} strokeWidth={1.7} />
                </div>
                <span style={{ ...body, fontSize: 10, color: C.ink, fontWeight: 500, textAlign: "center", lineHeight: 1.2 }}>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "12px 16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ ...disp, fontSize: 16, fontWeight: 600, color: C.ink }}>
            {vehicle ? `Fits your ${vehicle.label.split(" ")[0]}` : "Popular parts"}
          </div>
          <BadgeCheck size={14} color={C.gauge} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {recommended.map(p => <ProductCard key={p.id} p={p} onClick={() => onOpenProduct(p)} compact />)}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p, onClick, compact }) {
  const Icon = p.icon;
  return (
    <button onClick={onClick} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, cursor: "pointer", display: "flex", flexDirection: compact ? "column" : "row", gap: 10 }}>
      <div style={{ width: compact ? "100%" : 64, height: compact ? 74 : 64, borderRadius: 8, background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={compact ? 26 : 24} color={C.ink} strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...body, fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
          <Stars rating={p.rating} /><span style={{ ...body, fontSize: 10, color: C.muted }}>({p.reviews})</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink }}>${p.price.toFixed(2)}</span>
          <span style={{ ...body, fontSize: 11, color: C.muted, textDecoration: "line-through" }}>${p.mrp.toFixed(2)}</span>
        </div>
      </div>
    </button>
  );
}

function GarageScreen({ onBack, vehicles, activeId, onSelect }) {
  return (
    <div>
      <ScreenHeader title="My Garage" onBack={onBack} />
      <div style={{ padding: 16 }}>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Your active vehicle filters every search so you only see parts confirmed to fit.
        </div>
        {vehicles.map(v => (
          <button key={v.id} onClick={() => onSelect(v)} style={{
            width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: 14, borderRadius: 12, marginBottom: 10, cursor: "pointer",
            border: activeId === v.id ? `2px solid ${C.signal}` : `1px solid ${C.line}`,
            background: activeId === v.id ? "#FDF1EB" : "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Car size={18} color="#fff" />
              </div>
              <div>
                <div style={{ ...body, fontWeight: 700, fontSize: 13.5, color: C.ink }}>{v.label}</div>
                <div style={{ ...body, fontSize: 11.5, color: C.muted }}>{v.sub} · {v.years}</div>
              </div>
            </div>
            {activeId === v.id && <Check size={18} color={C.signal} />}
          </button>
        ))}
        <button style={{ width: "100%", border: `1.5px dashed ${C.line}`, background: "none", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: C.ink, marginTop: 4 }}>
          <Plus size={16} /><span style={{ ...body, fontWeight: 600, fontSize: 13 }}>Add a vehicle</span>
        </button>
      </div>
    </div>
  );
}

function CategoryScreen({ category, vehicle, onBack, onOpenProduct }) {
  const [showFitOnly, setShowFitOnly] = useState(true);
  let items = PRODUCTS.filter(p => p.cat === category.id);
  if (showFitOnly && vehicle) items = items.filter(p => p.fits.includes(vehicle.id));
  return (
    <div>
      <ScreenHeader title={category.name} onBack={onBack} right={<SlidersHorizontal size={18} color={C.ink} />} />
      <div style={{ padding: "10px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
        <button onClick={() => setShowFitOnly(s => !s)} style={{
          ...body, display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
          border: `1px solid ${showFitOnly ? C.gauge : C.line}`, background: showFitOnly ? C.gaugeBg : "#fff", color: showFitOnly ? C.gauge : C.ink,
        }}>
          <BadgeCheck size={13} /> Fits my {vehicle ? vehicle.label.split(" ")[0] : "vehicle"}
        </button>
        <span style={{ ...body, padding: "7px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: `1px solid ${C.line}`, color: C.ink, whiteSpace: "nowrap" }}>Price ↕</span>
        <span style={{ ...body, padding: "7px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: `1px solid ${C.line}`, color: C.ink, whiteSpace: "nowrap" }}>Rating 4+</span>
      </div>
      <div style={{ padding: "6px 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && (
          <div style={{ ...body, textAlign: "center", color: C.muted, fontSize: 13, padding: "40px 20px" }}>
            No parts confirmed to fit this vehicle in this category yet.
          </div>
        )}
        {items.map(p => <ProductCard key={p.id} p={p} onClick={() => onOpenProduct(p)} />)}
      </div>
    </div>
  );
}

function SearchScreen({ onBack, onOpenProduct }) {
  const [q, setQ] = useState("");
  const results = q.trim().length === 0 ? [] : PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer" }}><ChevronLeft size={22} color={C.ink} /></button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: C.chalk, borderRadius: 9, padding: "9px 11px" }}>
          <Search size={15} color={C.muted} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search part, brand, or part number"
            style={{ ...body, border: "none", outline: "none", background: "none", fontSize: 13.5, width: "100%", color: C.ink }} />
        </div>
      </div>
      <div style={{ padding: 16 }}>
        {q.trim().length === 0 ? (
          <>
            <div style={{ ...body, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Popular searches</div>
            {["Brake pads", "Oil filter", "LED headlight", "Car battery 70Ah", "Cabin filter"].map(s => (
              <button key={s} onClick={() => setQ(s)} style={{ ...body, display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13.5, color: C.ink, cursor: "pointer" }}>{s}</button>
            ))}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.length === 0 && <div style={{ ...body, color: C.muted, fontSize: 13 }}>No matches for "{q}".</div>}
            {results.map(p => <ProductCard key={p.id} p={p} onClick={() => onOpenProduct(p)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductScreen({ product, vehicle, onBack, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const Icon = product.icon;
  const fits = vehicle && product.fits.includes(vehicle.id);
  return (
    <div style={{ paddingBottom: 90 }}>
      <ScreenHeader title="Item details" onBack={onBack} />
      <div style={{ background: C.chalk, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={84} color={C.ink} strokeWidth={1.2} />
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ ...body, fontSize: 10.5, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Sold by {product.supplier}</div>
        <div style={{ ...disp, fontSize: 19, fontWeight: 600, color: C.ink, lineHeight: 1.25, marginBottom: 8 }}>{product.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Stars rating={product.rating} />
          <span style={{ ...body, fontSize: 12, color: C.muted }}>{product.rating} ({product.reviews} reviews)</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
          <span style={{ ...disp, fontSize: 30, fontWeight: 700, color: C.ink }}>${product.price.toFixed(2)}</span>
          <span style={{ ...body, fontSize: 14, color: C.muted, textDecoration: "line-through" }}>${product.mrp.toFixed(2)}</span>
          <span style={{ ...body, fontSize: 12, fontWeight: 700, color: C.signal }}>-{Math.round((1 - product.price / product.mrp) * 100)}%</span>
        </div>

        <div style={{ padding: 12, borderRadius: 10, background: fits ? C.gaugeBg : C.amberBg, display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {fits ? <BadgeCheck size={18} color={C.gauge} /> : <X size={18} color={C.amber} />}
          <div style={{ ...body, fontSize: 12.5, color: fits ? C.gauge : C.amber, fontWeight: 600 }}>
            {vehicle
              ? (fits ? `Confirmed fit for your ${vehicle.label}` : `Not confirmed to fit your ${vehicle.label}`)
              : "Add a vehicle to confirm fitment"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Truck size={15} color={C.muted} />
            <span style={{ ...body, fontSize: 12, color: C.muted }}>Est. delivery {product.days} days</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <PackageCheck size={15} color={C.muted} />
            <span style={{ ...body, fontSize: 12, color: C.muted }}>{product.stock}</span>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div style={{ ...disp, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Description</div>
          <div style={{ ...body, fontSize: 12.5, color: "#3A3F46", lineHeight: 1.6 }}>
            High-strength cast construction with anti-corrosion coating. Precision-balanced for smooth, vibration-free braking. Meets OE specifications for fit, form, and function.
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", maxWidth: 390, width: "100%", bottom: 0, left: "50%", transform: "translateX(-50%)", background: "#fff", borderTop: `1px solid ${C.line}`, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 9, overflow: "hidden" }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ border: "none", background: "none", padding: "9px 10px", cursor: "pointer" }}><Minus size={14} /></button>
          <span style={{ ...body, width: 24, textAlign: "center", fontWeight: 700, fontSize: 13 }}>{qty}</span>
          <button onClick={() => setQty(q => q + 1)} style={{ border: "none", background: "none", padding: "9px 10px", cursor: "pointer" }}><Plus size={14} /></button>
        </div>
        <PrimaryButton onClick={() => onAddToCart(product, qty)}>Add to cart · ${(product.price * qty).toFixed(2)}</PrimaryButton>
      </div>
    </div>
  );
}

function CartScreen({ cart, onQty, onRemove, onCheckout }) {
  const bySupplier = {};
  cart.forEach(c => { (bySupplier[c.product.supplier] ||= []).push(c); });
  const total = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  return (
    <div>
      <ScreenHeader title="Basket" />
      {cart.length === 0 ? (
        <div style={{ ...body, textAlign: "center", color: C.muted, padding: "60px 24px", fontSize: 13.5 }}>
          <ShoppingCart size={36} color={C.line} style={{ marginBottom: 12 }} />
          <div>Your basket is empty. Browse categories to add fitment-confirmed parts.</div>
        </div>
      ) : (
        <div style={{ padding: "12px 16px 140px" }}>
          {Object.entries(bySupplier).map(([supplier, rows]) => (
            <div key={supplier} style={{ marginBottom: 16, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: C.chalk, padding: "8px 12px", ...body, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Ships from {supplier}
              </div>
              {rows.map(r => {
                const Icon = r.product.icon;
                return (
                  <div key={r.product.id} style={{ display: "flex", gap: 10, padding: 12, borderTop: `1px solid ${C.line}` }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={22} color={C.ink} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...body, fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 6, lineHeight: 1.3 }}>{r.product.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 7, overflow: "hidden" }}>
                          <button onClick={() => onQty(r.product.id, -1)} style={{ border: "none", background: "none", padding: "5px 8px", cursor: "pointer" }}><Minus size={11} /></button>
                          <span style={{ ...body, width: 18, textAlign: "center", fontSize: 12, fontWeight: 700 }}>{r.qty}</span>
                          <button onClick={() => onQty(r.product.id, 1)} style={{ border: "none", background: "none", padding: "5px 8px", cursor: "pointer" }}><Plus size={11} /></button>
                        </div>
                        <span style={{ ...disp, fontSize: 15, fontWeight: 700, color: C.ink }}>${(r.product.price * r.qty).toFixed(2)}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(r.product.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, alignSelf: "flex-start" }}><X size={15} /></button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {cart.length > 0 && (
        <div style={{ position: "fixed", maxWidth: 390, width: "100%", bottom: 0, left: "50%", transform: "translateX(-50%)", background: "#fff", borderTop: `1px solid ${C.line}`, padding: "14px 16px calc(14px + 62px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ ...body, fontSize: 13, color: C.muted }}>Basket total</span>
            <span style={{ ...disp, fontSize: 20, fontWeight: 700, color: C.ink }}>${total.toFixed(2)}</span>
          </div>
          <PrimaryButton onClick={onCheckout}>Checkout</PrimaryButton>
        </div>
      )}
    </div>
  );
}

function CheckoutScreen({ cart, onBack, onPlace }) {
  const [payment, setPayment] = useState("card");
  const subtotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const shipping = 6.5;
  const tax = subtotal * 0.05;
  const total = subtotal + shipping + tax;
  const methods = [
    { id: "card", label: "Visa / Mastercard", icon: CreditCard },
    { id: "paypal", label: "PayPal", icon: Wallet },
    { id: "gpay", label: "Google Pay", icon: Wallet },
    { id: "stripe", label: "Stripe Checkout", icon: CreditCard },
  ];
  return (
    <div style={{ paddingBottom: 110 }}>
      <ScreenHeader title="Checkout" onBack={onBack} />
      <div style={{ padding: 16 }}>
        <SectionLabel icon={MapPin} text="Deliver to" />
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 18 }}>
          <div style={{ ...body, fontWeight: 700, fontSize: 13 }}>Sara H.</div>
          <div style={{ ...body, fontSize: 12, color: C.muted, marginTop: 2 }}>221 Riverside Ave, Apt 4B, Austin, TX 73301, United States</div>
        </div>

        <SectionLabel icon={CreditCard} text="Payment method" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {methods.map(m => {
            const Icon = m.icon;
            const sel = payment === m.id;
            return (
              <button key={m.id} onClick={() => setPayment(m.id)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10, cursor: "pointer",
                border: sel ? `2px solid ${C.signal}` : `1px solid ${C.line}`, background: sel ? "#FDF1EB" : "#fff",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={17} color={C.ink} />
                  <span style={{ ...body, fontSize: 13, fontWeight: 600, color: C.ink }}>{m.label}</span>
                </div>
                {sel && <Check size={16} color={C.signal} />}
              </button>
            );
          })}
        </div>

        <SectionLabel icon={Package} text="Order summary" />
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Row label={`Subtotal (${cart.reduce((s, c) => s + c.qty, 0)} items)`} value={`$${subtotal.toFixed(2)}`} />
          <Row label="Shipping" value={`$${shipping.toFixed(2)}`} />
          <Row label="Estimated tax" value={`$${tax.toFixed(2)}`} />
          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 2, paddingTop: 8 }}>
            <Row label="Total" value={`$${total.toFixed(2)}`} bold />
          </div>
        </div>
      </div>
      <div style={{ position: "fixed", maxWidth: 390, width: "100%", bottom: 0, left: "50%", transform: "translateX(-50%)", background: "#fff", borderTop: `1px solid ${C.line}`, padding: "14px 16px calc(14px + 62px)" }}>
        <PrimaryButton onClick={() => onPlace(total)}>Place order · ${total.toFixed(2)}</PrimaryButton>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <Icon size={13} color={C.muted} />
      <span style={{ ...body, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{text}</span>
    </div>
  );
}
function Row({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ ...body, fontSize: bold ? 13.5 : 12.5, color: bold ? C.ink : C.muted, fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ ...(bold ? disp : body), fontSize: bold ? 17 : 12.5, color: C.ink, fontWeight: bold ? 700 : 600 }}>{value}</span>
    </div>
  );
}

function ConfirmationScreen({ total, onDone }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.gaugeBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
        <Check size={30} color={C.gauge} />
      </div>
      <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Order placed</div>
      <div style={{ ...body, fontSize: 13, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>
        Your ${total.toFixed(2)} order has been sent to our suppliers for fulfillment. We'll notify you at each step.
      </div>
      <div style={{ marginBottom: 26 }}><PlateChip>LP-{Math.floor(200000 + Math.random() * 9000)}</PlateChip></div>
      <PrimaryButton onClick={onDone}>View my orders</PrimaryButton>
    </div>
  );
}

function OrdersScreen({ orders, onOpen }) {
  const [tab, setTab] = useState("all");
  const filtered = tab === "all" ? orders : orders.filter(o => o.status === tab);
  const tabs = [["all", "All"], ["to_ship", "To ship"], ["shipped", "Shipped"], ["to_review", "To review"], ["returns", "Returns"]];
  return (
    <div>
      <ScreenHeader title="My orders" />
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", borderBottom: `1px solid ${C.line}` }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...body, padding: "7px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
            border: `1px solid ${tab === id ? C.ink : C.line}`, background: tab === id ? C.ink : "#fff", color: tab === id ? "#fff" : C.ink,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && <div style={{ ...body, color: C.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>No orders here yet.</div>}
        {filtered.map(o => (
          <button key={o.id} onClick={() => onOpen(o)} style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, cursor: "pointer", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <PlateChip small>{o.id}</PlateChip>
              <StatusBadge status={o.status} />
            </div>
            <div style={{ ...body, fontSize: 12, color: C.ink, marginBottom: 2 }}>{o.items.length} item{o.items.length > 1 ? "s" : ""} · placed {o.placed}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ ...body, fontSize: 11.5, color: C.muted }}>{o.items[0].name}{o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}</span>
              <span style={{ ...disp, fontSize: 15, fontWeight: 700 }}>${o.total.toFixed(2)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function OrderDetailScreen({ order, onBack, onSupportChat }) {
  const steps = ["Confirmed", "Processing", "Shipped", "Out for delivery", "Delivered"];
  const stepIndex = { to_pay: 0, to_ship: 1, shipped: 2, to_review: 4, delivered: 4, returns: 2 }[order.status] ?? 1;
  return (
    <div>
      <ScreenHeader title="Order details" onBack={onBack} />
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <PlateChip>{order.id}</PlateChip>
          <StatusBadge status={order.status} />
        </div>

        <div style={{ marginBottom: 20 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: i <= stepIndex ? C.gauge : "#E4E6EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i <= stepIndex && <Check size={11} color="#fff" />}
                </div>
                {i < steps.length - 1 && <div style={{ width: 2, height: 26, background: i < stepIndex ? C.gauge : "#E4E6EA" }} />}
              </div>
              <div style={{ ...body, fontSize: 12.5, fontWeight: i <= stepIndex ? 700 : 500, color: i <= stepIndex ? C.ink : C.muted, paddingTop: 1 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ background: C.chalk, borderRadius: 10, padding: 12, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <Truck size={16} color={C.torque} />
          <div>
            <div style={{ ...body, fontSize: 11, color: C.muted }}>Tracking number</div>
            <PlateChip small tone="ink">{order.tracking}</PlateChip>
          </div>
        </div>

        <SectionLabel icon={Package} text="Items" />
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 18 }}>
          {order.items.map((it, i) => (
            <div key={i} style={{ padding: 12, borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <div style={{ ...body, fontSize: 12.5, fontWeight: 600, color: C.ink }}>{it.name}</div>
              <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 2 }}>Qty {it.qty} · Ships from {it.supplier}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onSupportChat} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", ...body, fontSize: 12.5, fontWeight: 600 }}>
            <MessageCircle size={14} /> Contact Leap Support
          </button>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", ...body, fontSize: 12.5, fontWeight: 600 }}>
            <RotateCcw size={14} /> Return / warranty
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountScreen({ vehicles, activeId, onOpenGarage, onOpenChat }) {
  const rows = [
    { icon: Car, label: "My Garage", sub: `${vehicles.length} saved vehicles`, onClick: onOpenGarage },
    { icon: MapPin, label: "Addresses", sub: "1 saved address" },
    { icon: Package, label: "Orders & returns", sub: "View history" },
    { icon: MessageCircle, label: "Leap Support", sub: "Chat with the platform team", onClick: onOpenChat },
    { icon: ShieldCheck, label: "Payment methods", sub: "Visa •••• 4432" },
  ];
  return (
    <div>
      <div style={{ background: C.ink, padding: "24px 16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#2A2F38", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <User size={22} color="#fff" />
        </div>
        <div>
          <div style={{ ...disp, color: "#fff", fontSize: 18, fontWeight: 600 }}>Sara Hasan</div>
          <div style={{ ...body, color: "#9AA1AC", fontSize: 12 }}>sara.hasan@email.com</div>
        </div>
      </div>
      <div style={{ padding: 12 }}>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <button key={i} onClick={r.onClick} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, background: "#fff", border: "none", borderBottom: `1px solid ${C.line}`, cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon size={18} color={C.ink} />
                <div>
                  <div style={{ ...body, fontSize: 13, fontWeight: 600, color: C.ink }}>{r.label}</div>
                  <div style={{ ...body, fontSize: 11, color: C.muted }}>{r.sub}</div>
                </div>
              </div>
              <ChevronRight size={16} color={C.muted} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatScreen({ onBack }) {
  const [messages, setMessages] = useState([
    { from: "support", text: "Hi Sara! This is Leap Support. How can we help with your order today?" },
  ]);
  const [input, setInput] = useState("");
  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { from: "me", text: input }]);
    setInput("");
    setTimeout(() => setMessages(m => [...m, { from: "support", text: "Thanks — I'll check with the supplier on our side and update you here shortly." }]), 700);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenHeader title="Leap Support" onBack={onBack} />
      <div style={{ background: C.torqueBg, padding: "10px 16px", ...body, fontSize: 11, color: C.torque, lineHeight: 1.5 }}>
        You're chatting with the Leap team, not the supplier directly — we'll coordinate fulfillment or returns on your behalf.
      </div>
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "78%" }}>
            <div style={{
              ...body, fontSize: 12.5, padding: "9px 12px", borderRadius: 12, lineHeight: 1.4,
              background: m.from === "me" ? C.signal : C.chalk, color: m.from === "me" ? "#fff" : C.ink,
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.line}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type a message…"
          style={{ ...body, flex: 1, border: `1px solid ${C.line}`, borderRadius: 20, padding: "9px 14px", fontSize: 13, outline: "none" }} />
        <button onClick={send} style={{ width: 38, height: 38, borderRadius: "50%", background: C.signal, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Send size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- App shell ---------------- */

export default function LeapMobilePrototype() {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]); // pushed sub-screens
  const [vehicles] = useState(VEHICLES);
  const [activeVehicleId, setActiveVehicleId] = useState("v1");
  const [cart, setCart] = useState([]);
  const [orders] = useState(ORDERS);
  const [lastTotal, setLastTotal] = useState(0);

  const activeVehicle = vehicles.find(v => v.id === activeVehicleId);
  const push = (screen, data) => setStack(s => [...s, { screen, data }]);
  const pop = () => setStack(s => s.slice(0, -1));
  const popTo = (n) => setStack(s => s.slice(0, n));

  const addToCart = (product, qty) => {
    setCart(c => {
      const existing = c.find(x => x.product.id === product.id);
      if (existing) return c.map(x => x.product.id === product.id ? { ...x, qty: x.qty + qty } : x);
      return [...c, { product, qty }];
    });
    pop();
    setTab("cart");
  };
  const changeQty = (id, delta) => setCart(c => c.map(x => x.product.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x).filter(x => x.qty > 0));
  const removeItem = (id) => setCart(c => c.filter(x => x.product.id !== id));

  const current = stack[stack.length - 1];

  const goTab = (t) => { setStack([]); setTab(t); };

  let content;
  if (current?.screen === "garage") {
    content = <GarageScreen onBack={pop} vehicles={vehicles} activeId={activeVehicleId} onSelect={(v) => { setActiveVehicleId(v.id); pop(); }} />;
  } else if (current?.screen === "category") {
    content = <CategoryScreen category={current.data} vehicle={activeVehicle} onBack={pop} onOpenProduct={(p) => push("product", p)} />;
  } else if (current?.screen === "search") {
    content = <SearchScreen onBack={pop} onOpenProduct={(p) => push("product", p)} />;
  } else if (current?.screen === "product") {
    content = <ProductScreen product={current.data} vehicle={activeVehicle} onBack={pop} onAddToCart={addToCart} />;
  } else if (current?.screen === "checkout") {
    content = <CheckoutScreen cart={cart} onBack={pop} onPlace={(total) => { setLastTotal(total); setCart([]); push("confirmation", total); }} />;
  } else if (current?.screen === "confirmation") {
    content = <ConfirmationScreen total={current.data} onDone={() => { setStack([]); setTab("orders"); }} />;
  } else if (current?.screen === "orderDetail") {
    content = <OrderDetailScreen order={current.data} onBack={pop} onSupportChat={() => push("chat")} />;
  } else if (current?.screen === "chat") {
    content = <ChatScreen onBack={pop} />;
  } else if (tab === "home") {
    content = <HomeScreen vehicle={activeVehicle} onOpenGarage={() => push("garage")} onOpenCategory={(c) => push("category", c)} onOpenProduct={(p) => push("product", p)} onOpenSearch={() => push("search")} />;
  } else if (tab === "categories") {
    content = (
      <div>
        <ScreenHeader title="Shop by category" />
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.id} onClick={() => push("category", c)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, border: `1px solid ${C.line}`, borderRadius: 12, background: "#fff", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: C.chalk, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={18} color={C.ink} /></div>
                <span style={{ ...body, fontSize: 12.5, fontWeight: 600, color: C.ink }}>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (tab === "cart") {
    content = <CartScreen cart={cart} onQty={changeQty} onRemove={removeItem} onCheckout={() => push("checkout")} />;
  } else if (tab === "orders") {
    content = <OrdersScreen orders={orders} onOpen={(o) => push("orderDetail", o)} />;
  } else if (tab === "account") {
    content = <AccountScreen vehicles={vehicles} activeId={activeVehicleId} onOpenGarage={() => push("garage")} onOpenChat={() => push("chat")} />;
  }

  const showBottomNav = stack.length === 0;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", background: "#EDEEF1", minHeight: "100%" }}>
      <style>{FONT_IMPORT}</style>
      <div style={{
        width: 390, maxWidth: "100%", height: 780, background: C.chalk, borderRadius: 36, overflow: "hidden",
        boxShadow: "0 30px 60px rgba(20,23,28,0.25)", border: "10px solid #0D0F12", position: "relative", display: "flex", flexDirection: "column",
      }}>
        {/* status bar */}
        <div style={{ ...body, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px 4px", fontSize: 12, fontWeight: 700, color: C.ink, background: current?.screen ? "#fff" : "transparent" }}>
          <span>9:41</span>
          <div style={{ width: 90, height: 22, background: "#0D0F12", borderRadius: 12, position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)" }} />
          <span>100%</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {content}
        </div>
        {showBottomNav && <BottomNav active={tab} onChange={goTab} />}
      </div>
    </div>
  );
}
