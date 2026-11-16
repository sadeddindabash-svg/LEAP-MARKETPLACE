import React, { useEffect, useState } from "react";
import { BadgeCheck, Check, FileText, Camera, MapPin, Phone, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { C, body, disp, mono } from "./theme";
import { EnlargeablePhoto } from "./components/ui";
import { API_BASE_URL, SessionExpiredError, getStoredToken, fetchSupplierVerification, setSupplierVerificationCheck, saveSupplierVerificationNotes } from "./auth";

// patch-supplier-verification: Suppliers > a supplier > "Verification & trust". What the supplier sent (license, credit code, premises photos,
// location, contact, business details), a "Checked" switch per item for Leap, Leap's private notes, and the trust level that follows from the
// checklist: every item checked = Verified shop / warehouse. Approve does not depend on it (confirmed with the person).
const src = (url) => (url.startsWith("http") ? url : `${API_BASE_URL}${url}`);
const PREMISES = { shop: "Shop", warehouse: "Warehouse", both: "Shop and warehouse" };
const MISSING = { license: "license photo", creditCode: "credit code", outsidePhotos: "outside photo", insidePhotos: "inside photo", location: "location" };
const when = (at) => (at ? new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function TrustBadge({ trust, small = false }) {
  if (!trust) return null;
  const tone = trust.level === "verified" ? [C.gaugeInk, C.gaugeBg] : trust.level === "partial" ? [C.amberInk, C.amberBg] : [C.muted, "#EEEFF1"];
  return (
    <span style={{ ...body, display: "inline-flex", alignItems: "center", gap: 5, fontSize: small ? 11 : 12, fontWeight: 800, color: tone[0], background: tone[1], borderRadius: 999, padding: small ? "2px 8px" : "4px 11px", whiteSpace: "nowrap" }}>
      {trust.level === "verified" ? <ShieldCheck size={small ? 12 : 13} /> : null}{trust.label}
    </span>
  );
}

export default function SupplierVerificationCard({ supplierId, onSessionExpired }) {
  const [v, setV] = useState(null);
  const [error, setError] = useState(null);
  const [busyItem, setBusyItem] = useState(null);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const fail = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired(); return; } setError(err.message); };
  const take = (d) => { setV(d); setNotes(d.adminNotes || ""); };
  useEffect(() => { fetchSupplierVerification(getStoredToken(), supplierId).then(take).catch(fail); }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (item) => {
    setBusyItem(item); setError(null);
    try { take(await setSupplierVerificationCheck(getStoredToken(), supplierId, item, !v.checks[item])); } catch (err) { fail(err); } finally { setBusyItem(null); }
  };
  const saveNotes = async () => {
    setSavingNotes(true); setError(null);
    try { take(await saveSupplierVerificationNotes(getStoredToken(), supplierId, notes)); setNotesSaved(true); } catch (err) { fail(err); } finally { setSavingNotes(false); }
  };

  const panel = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(11,49,70,0.05)" };
  if (!v) return <div style={{ ...panel, padding: 18, ...body, fontSize: 13, color: error ? C.redInk : C.muted }}>{error || "Loading the verification…"}</div>;

  const checkButton = (item) => {
    const c = v.checks[item];
    return (
      <button type="button" onClick={() => toggle(item)} disabled={busyItem === item} aria-pressed={Boolean(c)} title={c ? `Checked${c.checkedBy ? ` by ${c.checkedBy}` : ""} · ${when(c.checkedAt)}` : "Mark as checked"}
        style={{ ...body, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 800,
          border: `1px solid ${c ? C.gauge : C.lineStrong}`, background: c ? C.gauge : "#fff", color: c ? "#fff" : C.ink, opacity: busyItem === item ? 0.6 : 1 }}>
        <Check size={13} /> {c ? "Checked" : "Mark checked"}
      </button>
    );
  };
  const section = (Icon, title, items, children, sentOk) => (
    <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={15} color={C.signal} /></span>
        <span style={{ ...disp, fontSize: 14, fontWeight: 800, color: C.ink }}>{title}</span>
        {sentOk === false && <span style={{ ...body, fontSize: 11, fontWeight: 800, color: C.amberInk, background: C.amberBg, borderRadius: 999, padding: "2px 9px" }}>Not sent yet</span>}
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, flexWrap: "wrap" }}>{items.map(([item, label]) => <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{label && <span style={{ ...body, fontSize: 11.5, color: C.muted }}>{label}</span>}{checkButton(item)}</span>)}</span>
      </div>
      {children}
    </div>
  );
  const row = (label, value, extra = null) => (
    <div style={{ display: "grid", gridTemplateColumns: "170px minmax(0, 1fr)", gap: 10, padding: "4px 0", alignItems: "baseline" }}>
      <span style={{ ...body, fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</span>
      <span style={{ ...body, fontSize: 13, color: value ? C.ink : C.muted }}>{value || "—"}{extra}</span>
    </div>
  );
  const thumb = (url, w = 120, h = 90) => <EnlargeablePhoto key={url} src={src(url)} style={{ width: w, height: h, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />;
  const codeNote = v.creditCodeCheck === "valid" ? <span style={{ ...body, fontSize: 11.5, fontWeight: 800, color: C.gaugeInk, marginLeft: 8 }}>✓ China credit code: format and check character correct</span>
    : v.creditCodeCheck === "check_digit_wrong" ? <span style={{ ...body, fontSize: 11.5, fontWeight: 800, color: C.redInk, marginLeft: 8 }}>⚠ the check character does not match (typo, or not a real code)</span>
    : v.creditCodeCheck === "not_uscc" ? <span style={{ ...body, fontSize: 11.5, color: C.muted, marginLeft: 8 }}>not a China 18-character code (another country's number?)</span> : null;
  const hasPin = v.latitude !== null && v.longitude !== null;
  const lat = v.latitude, lng = v.longitude;

  return (
    <div data-testid="supplier-verification" style={{ ...panel, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexWrap: "wrap" }}>
        <BadgeCheck size={20} color={C.navy} />
        <span style={{ ...disp, fontSize: 16, fontWeight: 800, color: C.ink }}>Verification &amp; trust</span>
        <TrustBadge trust={v.trust} />
        <span style={{ ...body, fontSize: 12, color: C.muted }}>
          {v.sent} of {v.required} required items sent{v.missing.length ? ` · missing: ${v.missing.map((m) => MISSING[m]).join(", ")}` : ""}{v.submittedAt ? ` · complete since ${when(v.submittedAt)}` : ""}
        </span>
        {v.premisesType && <span style={{ ...body, marginLeft: "auto", fontSize: 12, fontWeight: 800, color: C.torqueInk, background: C.torqueBg, borderRadius: 999, padding: "4px 11px" }}>{PREMISES[v.premisesType]}</span>}
      </div>
      <div style={{ height: 6, background: "#E8EBEF" }}>
        <div style={{ height: "100%", width: `${(v.trust.checked / v.trust.total) * 100}%`, background: v.trust.level === "verified" ? C.gauge : C.signal, transition: "width 0.2s" }} />
      </div>
      {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.redInk, background: C.redBg, padding: "9px 16px" }}>{error}</div>}

      {section(FileText, "Business license", [["license", "Photo"], ["creditCode", "Code"]], (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {v.licensePhotoUrl ? thumb(v.licensePhotoUrl, 200, 140) : <div style={{ width: 200, height: 140, borderRadius: 10, border: `2px dashed ${C.lineStrong}`, display: "flex", alignItems: "center", justifyContent: "center", ...body, fontSize: 12, color: C.muted }}>No license photo</div>}
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            {row("Credit / registration code", v.creditCode ? <span style={{ ...mono, fontWeight: 800, letterSpacing: "0.04em" }}>{v.creditCode}</span> : null, codeNote)}
            {row("Legal representative", v.legalRepName)}
            {v.creditCode && v.creditCodeCheck !== "not_uscc" && (
              <a href="https://www.gsxt.gov.cn" target="_blank" rel="noreferrer" style={{ ...body, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.torque, marginTop: 6 }}>
                Look the code up on gsxt.gov.cn (China's company register) <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      ), Boolean(v.licensePhotoUrl && v.creditCode))}

      {section(Camera, "Premises photos", [["outsidePhotos", "Outside"], ["insidePhotos", "Inside"]], (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {[["outside", "Outside, with the sign"], ["inside", "Inside, shelves and stock"]].map(([kind, label]) => (
            <div key={kind}>
              <div style={{ ...body, fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 6 }}>{label} ({v.photos[kind].length})</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {v.photos[kind].length === 0 ? <span style={{ ...body, fontSize: 12.5, color: C.muted }}>None yet</span> : v.photos[kind].map((u) => thumb(u))}
              </div>
            </div>
          ))}
        </div>
      ), v.photos.outside.length > 0 && v.photos.inside.length > 0)}

      {section(MapPin, "Location", [["location", ""]], (
        <div style={{ display: "grid", gridTemplateColumns: hasPin ? "minmax(0, 1fr) minmax(0, 1.2fr)" : "1fr", gap: 14, alignItems: "start" }}>
          <div>
            {row("Address", v.addressText)}
            {row("Map position", hasPin ? <span style={mono}>{lat.toFixed(6)}, {lng.toFixed(6)}</span> : null)}
            {hasPin && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                {[["OpenStreetMap", `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`], ["Google Maps", `https://www.google.com/maps?q=${lat},${lng}`], ["Amap 高德", `https://uri.amap.com/marker?position=${lng},${lat}`]].map(([name, href]) => (
                  <a key={name} href={href} target="_blank" rel="noreferrer" style={{ ...body, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: C.torque }}>{name} <ExternalLink size={11} /></a>
                ))}
              </div>
            )}
            {hasPin && <div style={{ ...body, fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>Compare the street view or satellite picture with the outside photos. In China, Amap's map is shifted a little from GPS: a pin a few hundred metres off there is normal.</div>}
          </div>
          {hasPin && <iframe title="Supplier location" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.006},${lat - 0.004},${lng + 0.006},${lat + 0.004}&layer=mapnik&marker=${lat},${lng}`} style={{ width: "100%", height: 200, border: `1px solid ${C.line}`, borderRadius: 12 }} />}
        </div>
      ), Boolean(hasPin || v.addressText))}

      {section(Phone, "Contact person", [["contact", "Phone answered"]], (
        <div>
          {row("Name", v.contactName)}
          {row("Role", v.contactRole)}
          {row("Mobile", v.contactPhone ? <a href={`tel:${v.contactPhone.replace(/[^0-9+]/g, "")}`} style={{ ...mono, color: C.torque, fontWeight: 700 }}>{v.contactPhone}</a> : null)}
        </div>
      ))}

      {section(Building2, "Business details", [["business", ""]], (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0 20px" }}>
          <div>
            {row("Year founded", v.yearFounded ? `${v.yearFounded} (${new Date().getFullYear() - v.yearFounded} years)` : null)}
            {row("Staff", v.staffCount ? v.staffCount.toLocaleString() : null)}
            {row("Size of the premises", v.warehouseSizeM2 ? `${v.warehouseSizeM2.toLocaleString()} m²` : null)}
          </div>
          <div>
            {row("Main brands", v.mainBrands)}
            {row("Main categories", v.mainCategories)}
          </div>
        </div>
      ))}

      <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.line}`, background: C.surfaceHigh }}>
        <div style={{ ...body, fontSize: 12, fontWeight: 800, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Leap's notes <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>· private, the supplier never sees them</span></div>
        <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }} rows={3} aria-label="Leap's notes" placeholder="e.g. Video call with Mr Li on 9 Nov: showed the warehouse and the license original."
          style={{ ...body, width: "100%", boxSizing: "border-box", border: `1px solid ${C.lineStrong}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, resize: "vertical", background: "#fff" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ ...body, fontSize: 11.5, color: notesSaved ? C.gaugeInk : C.muted, fontWeight: notesSaved ? 800 : 500 }}>{notesSaved ? "✓ Notes saved" : v.adminNotesUpdatedAt ? `Last saved ${when(v.adminNotesUpdatedAt)}` : ""}</span>
          <button type="button" onClick={saveNotes} disabled={savingNotes || notes === (v.adminNotes || "")} style={{ ...body, marginLeft: "auto", height: 34, padding: "0 16px", borderRadius: 9, border: "none", background: savingNotes || notes === (v.adminNotes || "") ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
