import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown } from "lucide-react";
import { C, disp, body } from "./theme";

import { Card } from "./components/ui";
import { getStoredToken, SessionExpiredError } from "./auth";
import { exportToExcel } from "./exportToExcel";
import { fetchProfits, shiftDate, money, moneyShort } from "./profitsApi";

// Financial -> Profits: what Leap keeps after paying the suppliers, for a day, a week (Saturday to Friday), a month, a quarter or a year, in Riyadh time.
// An order's part counts once its return window ends, when the money is final; the parts still inside it are shown apart ("Not final yet").
const PERIODS = [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["quarter", "Quarterly"], ["year", "Yearly"]];
const NOUN = { day: "day", week: "week", month: "month", quarter: "quarter", year: "year" };
const ROWS_TITLE = { day: "Every day", week: "Every week", month: "Every month", quarter: "Every quarter", year: "Every year" };
const CHART_TITLE = { day: "Profit by day · this week", week: "Profit by day", month: "Profit by day", quarter: "Profit by month", year: "Profit by month" };
const num = { ...body, fontVariantNumeric: "tabular-nums" };
const small = { ...body, fontSize: 12.5, color: C.muted };
const button = { ...body, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: "pointer" };

function Change({ value, unit = "%", invert = false, children }) {
  if (value === null || value === undefined) return <span style={{ ...small, opacity: 0.8 }}>{children || "no figures before"}</span>;
  const up = value > 0; const good = invert ? !up : up;
  const color = value === 0 ? C.muted : good ? C.gauge : C.red;
  const Icon = up ? TrendingUp : TrendingDown;
  return <span style={{ ...body, fontSize: 12.5, fontWeight: 700, color, display: "inline-flex", alignItems: "center", gap: 4 }}>{value !== 0 && <Icon size={13} />}{value > 0 ? "+" : value < 0 ? "−" : ""}{Math.abs(value)}{unit}{children ? <span style={{ fontWeight: 500, color: C.muted }}>&nbsp;{children}</span> : null}</span>;
}

function Kpi({ label, value, dark, children }) {
  return (
    <div data-testid={`profit-kpi-${label}`} style={{ flex: dark ? 1.3 : 1, minWidth: 0, background: dark ? C.ink : C.card, border: `1px solid ${dark ? C.ink : C.line}`, borderRadius: 12, padding: 16 }}>
      <div style={{ ...body, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: dark ? C.signal : C.muted }}>{label}</div>
      <div style={{ ...disp, fontSize: 28, fontWeight: 800, color: dark ? "#fff" : C.ink, margin: "6px 0 4px" }}>{value}</div>
      {children}
    </div>
  );
}

// The fifth box (design A): the money still inside its return window, beside the final figures, dashed gold so it reads as "not final".
function InProgress({ notFinal, today }) {
  const next = notFinal.next[0];
  const when = !next ? null : next.finalAt === today ? "today" : next.finalAt;
  return (
    <div data-testid="profit-kpi-in-progress" style={{ flex: 1.15, minWidth: 0, background: "#FFF8E8", border: `1.5px dashed ${C.signal}`, borderRadius: 12, padding: 16 }}>
      <div style={{ ...body, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#7A5300" }}>
        In progress <span style={{ fontSize: 10, fontWeight: 800, background: C.amberBg, borderRadius: 20, padding: "2px 7px", marginInlineStart: 4 }}>NOT FINAL</span>
      </div>
      <div style={{ ...disp, fontSize: 28, fontWeight: 800, color: C.ink, margin: "6px 0 4px" }}>{notFinal.orders > 0 ? `≈ ${money(notFinal.expectedProfit)}` : money(0)}</div>
      <div style={small}>
        <b style={{ color: C.ink }}>{notFinal.orders} {notFinal.orders === 1 ? "order" : "orders"}</b> · {money(notFinal.sales)} in sales
        {next && <><br />next final: {when} ({next.orderId})</>}
        {!next && <><br />nothing inside a return window</>}
      </div>
    </div>
  );
}

// Planned shipping - what the hubs really paid (Financial -> Shipping costs): saved parcels are extra profit, approved dearer ones extra cost.
function ShippingResult({ t }) {
  const r = t.shippingResult || 0;
  const tone = r > 0 ? { bg: C.gaugeBg, fg: C.gauge } : r < 0 ? { bg: C.redBg, fg: C.red } : { bg: "#F3F4F6", fg: C.ink };
  const sign = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`;
  return (
    <div data-testid="shipping-result">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 10px", background: tone.bg, borderRadius: 8, margin: "4px 0" }}>
        <span style={{ ...body, fontSize: 13.5, fontWeight: 800, color: C.ink }}>± Shipping result (planned − paid)</span>
        <span style={{ ...num, fontSize: 13.5, fontWeight: 800, color: tone.fg, whiteSpace: "nowrap" }}>{sign(r)}</span>
      </div>
      <Line sub label={`saved on ${t.shippingSaved.parcels} ${t.shippingSaved.parcels === 1 ? "parcel" : "parcels"}`} value={sign(t.shippingSaved.usd)} />
      <Line sub label={`over on ${t.shippingOver.parcels} ${t.shippingOver.parcels === 1 ? "parcel" : "parcels"} (approved)`} value={sign(-t.shippingOver.usd)} />
      {t.parcelsWithoutCost > 0 && <div style={{ ...small, fontSize: 11.5, padding: "2px 16px 6px" }}>{t.parcelsWithoutCost} {t.parcelsWithoutCost === 1 ? "parcel was" : "parcels were"} shipped before costs were entered: counted as paid exactly what was planned.</div>}
    </div>
  );
}

function Line({ label, value, strong, sub, highlight, total }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: total ? "12px 0 2px" : "9px 0", paddingInlineStart: sub ? 16 : highlight ? 10 : 0, paddingInlineEnd: highlight ? 10 : 0,
      borderTop: total ? `2px solid ${C.ink}` : `1px solid #F0F1F3`, background: highlight ? "#FFF8E8" : "transparent", borderRadius: highlight ? 8 : 0, marginTop: total ? 6 : 0 }}>
      <span style={{ ...body, fontSize: total ? 15 : sub ? 12.5 : 13.5, fontWeight: total || highlight ? 800 : 500, color: sub ? C.muted : C.ink }}>{label}</span>
      <span style={{ ...num, fontSize: total ? 15 : sub ? 12.5 : 13.5, fontWeight: strong || total || highlight ? 700 : 500, color: sub ? C.muted : C.ink, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Bars({ chart }) {
  const max = Math.max(1, ...chart.map((b) => Math.abs(b.netProfit)));
  const anyNegative = chart.some((b) => b.netProfit < 0);
  const height = 220; const zero = anyNegative ? height * 0.78 : height;
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: chart.length > 20 ? 3 : 8, height: height + 44, padding: "8px 4px 0" }}>
      {chart.map((b) => {
        const h = (Math.abs(b.netProfit) / max) * (anyNegative ? zero - 8 : height - 22);
        const fill = b.future ? "transparent" : b.netProfit < 0 ? C.red : b.current ? C.signal : "#3A3F47";
        return (
          <div key={b.start} title={`${b.label}: ${money(b.netProfit)} profit · ${money(b.sales)} sales · ${b.orders} orders`} style={{ flex: 1, minWidth: 0, position: "relative", height: height + 44 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: b.netProfit >= 0 ? zero - h : zero, height: Math.max(h, b.netProfit === 0 && !b.future ? 2 : 0), background: fill, borderRadius: 4, border: b.future ? `1px dashed ${C.line}` : "none" }} />
            {chart.length <= 14 && b.netProfit !== 0 && <div style={{ ...body, position: "absolute", left: -6, right: -6, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: C.muted, top: b.netProfit >= 0 ? zero - h - 16 : zero + h + 3 }}>{moneyShort(b.netProfit)}</div>}
            <div style={{ ...body, position: "absolute", left: -8, right: -8, bottom: 0, textAlign: "center", fontSize: 10.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden" }}>{chart.length > 16 ? b.label.replace(/^\D+\s/, "") : b.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProfitsPanel({ onSessionExpired }) {
  const [period, setPeriod] = useState("month");
  const [date, setDate] = useState(null);                 // null: the period containing today (the server decides "today", in Riyadh time)
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    fetchProfits(getStoredToken(), period, date)
      .then((r) => { if (live) { setReport(r); setLoading(false); } })
      .catch((err) => { if (!live) return; if (err instanceof SessionExpiredError) return onSessionExpired?.(); setError(err.message); setLoading(false); });
    return () => { live = false; };
  }, [period, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const here = report?.start;
  const go = (steps) => here && setDate(shiftDate(here, period, steps));
  const t = report?.totals; const ch = report?.change;
  const versus = report ? (report.previous.partial ? `vs the same days of ${report.previous.label}` : `vs ${report.previous.label}`) : "";
  const exportRows = () => exportToExcel({
    filename: `profits-${period}-${report.start}`, sheetName: "Profits",
    columns: [{ header: "Period", key: "label", width: 30 }, { header: "Orders", key: "orders", width: 10 }, { header: "Sales (USD)", key: "sales", width: 14 }, { header: "Supplier pay (USD)", key: "supplierPay", width: 18 },
      { header: "Shipping planned", key: "shippingPlanned", width: 16 }, { header: "Shipping result", key: "shippingResult", width: 16 }, { header: "Shipping charged", key: "shipping", width: 16 }, { header: "Discounts", key: "discounts", width: 12 }, { header: "Refunds", key: "refunds", width: 12 }, { header: "Fault costs", key: "faultCosts", width: 12 },
      { header: "Net profit (USD)", key: "netProfit", width: 16 }, { header: "Margin %", key: "margin", width: 10 }],
    rows: report.rows.map((r) => ({ ...r, label: r.running ? `${r.label} (so far)` : r.label })),
  });

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div role="group" aria-label="Period" style={{ display: "inline-flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, padding: 3 }}>
          {PERIODS.map(([id, name]) => (
            <button key={id} type="button" aria-pressed={period === id} onClick={() => { setPeriod(id); setDate(report?.running ? null : here || null); }}      // from the running period: the one containing today; else: the one containing its first day
              style={{ ...body, border: "none", cursor: "pointer", padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: period === id ? C.ink : "transparent", color: period === id ? "#fff" : C.muted }}>{name}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" aria-label={`Previous ${NOUN[period]}`} onClick={() => go(-1)} style={{ ...button, padding: 7 }}><ChevronLeft size={16} /></button>
          <span data-testid="profit-period" style={{ ...button, cursor: "default", minWidth: 200, justifyContent: "center", fontWeight: 700 }}>{report ? report.label : "…"}{report?.running ? " · so far" : ""}</span>
          <button type="button" aria-label={`Next ${NOUN[period]}`} onClick={() => go(1)} disabled={!report || report.running} style={{ ...button, padding: 7, opacity: !report || report.running ? 0.4 : 1, cursor: !report || report.running ? "default" : "pointer" }}><ChevronRight size={16} /></button>
          {date && !report?.running && <button type="button" onClick={() => setDate(null)} style={button}>Today</button>}
          {report && <button type="button" onClick={exportRows} style={button}><Download size={14} /> Export</button>}
        </div>
      </div>

      {error && <div role="alert" style={{ ...body, fontSize: 13, color: C.red, background: C.redBg, borderRadius: 8, padding: 12 }}>Couldn't load the profits: {error}</div>}
      {!report && loading && <Card><div style={{ padding: 32, textAlign: "center", ...small }}>Loading…</div></Card>}

      {report && (
        <div style={{ display: "grid", gap: 16, opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Kpi label="Net profit" value={money(t.netProfit)} dark><Change value={ch.netProfit}><span style={{ color: "#9AA3AE" }}>{versus}</span></Change></Kpi>
            <Kpi label="Sales" value={money(t.sales)}><Change value={ch.sales} /></Kpi>
            <Kpi label="Margin" value={t.margin === null ? "—" : `${t.margin}%`}><Change value={ch.margin} unit=" pts" /></Kpi>
            <Kpi label="Orders counted" value={t.orders}><Change value={ch.orders} unit="" /></Kpi>
            <InProgress notFinal={report.notFinal} today={String(report.now).slice(0, 10)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 1fr)", gap: 16 }}>
            <Card title={CHART_TITLE[period]}>
              <div style={{ padding: "10px 18px 16px" }}>
                <div style={small}>Gold: {period === "day" ? "the day you are looking at" : "today"}. Red: a loss. Point at a bar for its figures.</div>
                <Bars chart={report.chart} />
              </div>
            </Card>
            <Card title="How it adds up">
              <div style={{ padding: "6px 18px 16px" }}>
                <div style={{ ...small, margin: "6px 0 8px" }}>{report.label}{report.running ? " so far" : ""} · {t.orders} {t.orders === 1 ? "order" : "orders"}</div>
                <Line label="Sales (what buyers paid for the parts)" value={money(t.sales)} strong />
                <Line label="− Supplier pay (their price, at the order's exchange rate)" value={money(-t.supplierPay)} strong />
                <Line label="− Shipping planned inside the prices" value={money(-t.shippingPlanned)} strong />
                <Line label="= Profit on parts (the markup)" value={money(t.partsProfit)} highlight />
                <ShippingResult t={t} />
                <Line label="+ Shipping charged to buyers" value={money(t.shipping)} strong />
                <Line label="− Discounts (promo codes, tier discounts)" value={money(-t.discounts)} strong />
                <Line label="− Refunds (returned parts)" value={money(-t.refunds)} strong />
                <Line label="− Fault-case payments to suppliers" value={money(-t.faultCosts)} strong />
                <Line label="Net profit" value={money(t.netProfit)} total />
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 1fr)", gap: 16 }}>
            <Card title={ROWS_TITLE[period]}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Period", "Orders", "Sales", "Net profit", "Margin", `vs the ${NOUN[period]} before`].map((h) => <th key={h} style={{ ...body, textAlign: "start", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, padding: "10px 14px", borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.start} onClick={() => setDate(r.start)} style={{ cursor: "pointer", background: r.start === report.start ? "#FFF8E8" : "transparent" }}>
                      <td style={{ ...body, fontSize: 13, fontWeight: 700, padding: "10px 14px", borderBottom: "1px solid #F0F1F3" }}>{r.label}{r.running ? " (so far)" : ""}</td>
                      <td style={{ ...body, fontSize: 13, padding: "10px 14px", borderBottom: "1px solid #F0F1F3" }}>{r.orders}</td>
                      <td style={{ ...num, fontSize: 12.5, padding: "10px 14px", borderBottom: "1px solid #F0F1F3" }}>{money(r.sales)}</td>
                      <td style={{ ...num, fontSize: 12.5, fontWeight: 700, color: r.netProfit < 0 ? C.red : C.ink, padding: "10px 14px", borderBottom: "1px solid #F0F1F3" }}>{money(r.netProfit)}</td>
                      <td style={{ ...body, fontSize: 13, padding: "10px 14px", borderBottom: "1px solid #F0F1F3" }}>{r.margin === null ? "—" : `${r.margin}%`}</td>
                      <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0F1F3" }}>{r.running ? <span style={small}>running</span> : <Change value={r.changeNetProfit}>{" "}</Change>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title={<span>Not final yet <span style={{ ...body, fontSize: 10.5, fontWeight: 800, color: "#7A5300", background: C.amberBg, borderRadius: 20, padding: "2px 8px", marginInlineStart: 6 }}>IN THE RETURN WINDOW</span></span>}>
              <div style={{ padding: "12px 18px 16px" }}>
                <div style={small}>Delivered, but the days for a return are not over. Each counts on the day its window ends.</div>
                <div style={{ display: "flex", gap: 28, margin: "14px 0" }}>
                  <div><div data-testid="not-final-orders" style={{ ...disp, fontSize: 22, fontWeight: 800 }}>{report.notFinal.orders} {report.notFinal.orders === 1 ? "order" : "orders"}</div><div style={small}>{money(report.notFinal.sales)} in sales</div></div>
                  <div><div style={{ ...disp, fontSize: 22, fontWeight: 800 }}>≈ {money(report.notFinal.expectedProfit)}</div><div style={small}>expected profit</div></div>
                </div>
                {report.notFinal.next.length > 0 && <div style={{ ...small, fontWeight: 700, marginBottom: 4 }}>Next to become final</div>}
                {report.notFinal.next.map((n) => (
                  <div key={`${n.orderId}-${n.finalAt}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #F0F1F3", ...body, fontSize: 13 }}>
                    <span><span style={{ ...num, fontWeight: 700 }}>{n.orderId}</span> · delivered {n.deliveredAt}</span><span style={{ color: C.muted }}>final on {n.finalAt}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ ...body, fontSize: 12.5, color: "#5C4306", background: "#FFF8E8", border: "1px solid #F7D68A", borderRadius: 12, padding: "12px 16px" }}>
            <b style={{ color: C.onSignal }}>Not included yet:</b> what carriers charge Leap for shipping and what the payment providers keep per payment are not recorded anywhere, so the real profit is a little lower than shown.
            {report.missingRate ? " Some orders here are from before the exchange rate was kept with each order: today's rate is used for them." : " Each order uses the exchange rate of the day it was placed (older orders: today's rate)."}
            {" "}All times are Riyadh time; a week runs Saturday to Friday.
          </div>
        </div>
      )}
    </div>
  );
}
