import React, { useEffect, useState } from "react";
import { BadgeCheck, Building2, Camera, MapPin, Phone, Store, Warehouse, X, Plus, LocateFixed, FileText, Check } from "lucide-react";
import { C, disp, mono, SHADOW, useBodyFont } from "./theme";
import { useLang } from "./langContext";
import { API_BASE_URL, getStoredToken, uploadProductImage, fetchMyVerification, saveMyVerification } from "./auth";

// patch-supplier-verification: Settings > Verification documents. What the supplier sends so Leap can trust it is a real shop or warehouse:
// the business license (photo, credit code, legal representative), photos of the premises (outside with the sign, inside with the stock),
// the location (address + map position), a contact person, and business details. Saved together with one button. Nothing here is shown to buyers.
const T = {
  zh: {
    intro: "请提交以下资料，以便 Leap 确认您是真实的店铺或仓库。资料仅供 Leap 审核，不会展示给买家。",
    progress: (n, m) => `已提交必填项 ${n} / ${m}`, complete: "必填资料已齐全，Leap 正在审核。", missingHead: "尚缺：",
    items: { license: "营业执照照片", creditCode: "统一社会信用代码", outsidePhotos: "门头照片", insidePhotos: "内部照片", location: "地址或定位" },
    premises: "经营场所类型", shop: "店铺", warehouse: "仓库", both: "店铺和仓库",
    licenseTitle: "营业执照", licensePhoto: "营业执照照片", licenseHint: "拍摄完整清晰的营业执照（至少 800 像素）。", upload: "上传照片", replace: "更换", uploading: "上传中…",
    creditCode: "统一社会信用代码（18 位）", creditCodeHint: "中国企业请填写 18 位代码；其他国家请填写营业登记号。", codeOk: "代码格式和校验位正确", codeBad: "校验位不匹配，请核对", legalRep: "法定代表人",
    photosTitle: "经营场所照片", outside: "门头照片（带招牌）", outsideHint: "从外面拍摄，能看到店名或公司招牌。", inside: "内部照片（货架 / 库存）", insideHint: "拍摄货架、库存或仓库内部。", max: (n) => `最多 ${n} 张`,
    locationTitle: "地址和定位", address: "详细地址", addressPh: "省、市、区、街道、门牌号", useMine: "使用我当前的位置", locating: "定位中…", locFail: "无法获取位置，请手动填写或粘贴地图链接。",
    lat: "纬度", lng: "经度", mapLink: "或粘贴地图链接（高德、百度、谷歌）", mapLinkPh: "粘贴链接后自动读取坐标", linkBad: "链接中没有找到坐标", pinSet: "已设定地图位置",
    contactTitle: "联系人", contactName: "姓名", contactRole: "职位", contactPhone: "手机号码", phoneHint: "Leap 可能会打电话核实。",
    businessTitle: "企业信息", yearFounded: "成立年份", staffCount: "员工人数", size: "场所面积（平方米）", brands: "主营品牌", categories: "主营类目", brandsPh: "例如：丰田、日产、现代", catsPh: "例如：刹车系统、滤清器",
    save: "保存", saving: "保存中…", saved: "已保存", optional: "选填", required: "必填",
  },
  en: {
    intro: "Please send the following so Leap can confirm you are a real shop or warehouse. Only Leap sees these; they are never shown to buyers.",
    progress: (n, m) => `${n} of ${m} required items sent`, complete: "Every required item is here. Leap is reviewing them.", missingHead: "Still missing: ",
    items: { license: "license photo", creditCode: "credit code", outsidePhotos: "outside photo", insidePhotos: "inside photo", location: "address or map position" },
    premises: "Your premises", shop: "Shop", warehouse: "Warehouse", both: "Shop and warehouse",
    licenseTitle: "Business license", licensePhoto: "License photo", licenseHint: "The whole license, sharp and readable (at least 800 px).", upload: "Upload photo", replace: "Replace", uploading: "Uploading…",
    creditCode: "Unified Social Credit Code (18 characters)", creditCodeHint: "Companies in China: the 18-character code. Other countries: your business registration number.", codeOk: "Format and check character correct", codeBad: "The check character does not match: please check the code", legalRep: "Legal representative",
    photosTitle: "Photos of your premises", outside: "Outside (with your sign)", outsideHint: "From the street, with the shop or company name visible.", inside: "Inside (shelves / stock)", insideHint: "The shelves, the stock or the inside of the warehouse.", max: (n) => `up to ${n}`,
    locationTitle: "Address and location", address: "Full address", addressPh: "Province, city, district, street, number", useMine: "Use my current location", locating: "Finding you…", locFail: "Could not get your location: type it in, or paste a map link.",
    lat: "Latitude", lng: "Longitude", mapLink: "Or paste a map link (Amap, Baidu, Google)", mapLinkPh: "Paste a link and the position is read from it", linkBad: "No position found in this link", pinSet: "Map position set",
    contactTitle: "Contact person", contactName: "Name", contactRole: "Role", contactPhone: "Mobile number", phoneHint: "Leap may call to confirm.",
    businessTitle: "Business details", yearFounded: "Year founded", staffCount: "Number of staff", size: "Size of the premises (m²)", brands: "Main brands", categories: "Main categories", brandsPh: "e.g. Toyota, Nissan, Hyundai", catsPh: "e.g. Brakes, Filters",
    save: "Save", saving: "Saving…", saved: "Saved", optional: "optional", required: "required",
  },
};
const MAX_PHOTOS = 6;
const EMPTY = { premisesType: "", licensePhotoUrl: null, creditCode: "", legalRepName: "", addressText: "", latitude: "", longitude: "", contactName: "", contactRole: "", contactPhone: "",
  yearFounded: "", staffCount: "", warehouseSizeM2: "", mainBrands: "", mainCategories: "", photos: { outside: [], inside: [] } };
const src = (url) => (url && url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

// China's credit code check character (the server checks the same; this is only for a quick hint while typing)
const USCC = "0123456789ABCDEFGHJKLMNPQRTUWXY"; const W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
function codeCheck(raw) {
  const c = String(raw || "").toUpperCase().replace(/\s+/g, "");
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(c)) return null;
  let s = 0; for (let i = 0; i < 17; i++) s += USCC.indexOf(c[i]) * W[i];
  return c[17] === USCC[(31 - (s % 31)) % 31];
}
// a position from a map link: "lat,lng" (Google ...@lat,lng / q=lat,lng), or Amap's "position=lng,lat" / "lnglat=lng,lat"
export function positionFromLink(link) {
  const s = String(link || "");
  let m = s.match(/(?:position|lnglat|location)=(-?\d{1,3}\.\d+),(-?\d{1,2}\.\d+)/i);
  if (m) return { latitude: Number(m[2]), longitude: Number(m[1]) };
  m = s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) || s.match(/[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) || s.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (m) return { latitude: Number(m[1]), longitude: Number(m[2]) };
  return null;
}

export default function VerificationPage() {
  const { lang } = useLang();
  const t = T[lang === "zh" ? "zh" : "en"];
  const font = useBodyFont();
  const [form, setForm] = useState(EMPTY);
  const [server, setServer] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [uploading, setUploading] = useState(null);      // "license" | "outside" | "inside"
  const [locating, setLocating] = useState(false);
  const [linkNote, setLinkNote] = useState(null);

  const fill = (d) => {
    setServer(d);
    setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(d).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v === null ? (k === "licensePhotoUrl" ? null : "") : (typeof v === "number" ? String(v) : v)])), photos: d.photos || { outside: [], inside: [] } });
  };
  useEffect(() => { fetchMyVerification(getStoredToken()).then(fill).catch((e) => setLoadError(e.message)); }, []);
  const set = (k) => (e) => { setSavedAt(null); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const upload = async (where, file) => {
    if (!file) return;
    setUploading(where); setError(null); setSavedAt(null);
    try {
      const { url } = await uploadProductImage(getStoredToken(), file);
      setForm((f) => (where === "license" ? { ...f, licensePhotoUrl: url } : { ...f, photos: { ...f.photos, [where]: [...f.photos[where], url].slice(0, MAX_PHOTOS) } }));
    } catch (e) { setError(e.message); } finally { setUploading(null); }
  };
  const removePhoto = (kind, i) => { setSavedAt(null); setForm((f) => ({ ...f, photos: { ...f.photos, [kind]: f.photos[kind].filter((_, j) => j !== i) } })); };
  const useMyLocation = () => {
    if (!navigator.geolocation) { setLinkNote(t.locFail); return; }
    setLocating(true); setLinkNote(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); setSavedAt(null); setForm((f) => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })); },
      () => { setLocating(false); setLinkNote(t.locFail); }, { enableHighAccuracy: true, timeout: 15000 });
  };
  const fromLink = (e) => {
    const pos = positionFromLink(e.target.value);
    if (!e.target.value.trim()) { setLinkNote(null); return; }
    if (!pos) { setLinkNote(t.linkBad); return; }
    setLinkNote(t.pinSet); setSavedAt(null);
    setForm((f) => ({ ...f, latitude: pos.latitude.toFixed(6), longitude: pos.longitude.toFixed(6) }));
  };
  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { ...form, premisesType: form.premisesType || null };
      fill(await saveMyVerification(getStoredToken(), payload));
      setSavedAt(Date.now());
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  // what is there, from the form as it is now (the server says the same after Save)
  const has = { license: Boolean(form.licensePhotoUrl), creditCode: Boolean(String(form.creditCode).trim()), outsidePhotos: form.photos.outside.length > 0, insidePhotos: form.photos.inside.length > 0, location: Boolean((form.latitude !== "" && form.longitude !== "") || String(form.addressText).trim()) };
  const keys = Object.keys(has);
  const sentN = keys.filter((k) => has[k]).length;
  const check = codeCheck(form.creditCode);
  const lat = Number(form.latitude), lng = Number(form.longitude);
  const hasPin = form.latitude !== "" && form.longitude !== "" && Number.isFinite(lat) && Number.isFinite(lng);

  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: SHADOW.card, padding: 18 };
  const label = { ...font, display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 5 };
  const input = { ...font, width: "100%", boxSizing: "border-box", height: 40, border: `1px solid ${C.lineStrong}`, borderRadius: 10, padding: "0 12px", fontSize: 13.5, color: C.ink, background: "#fff" };
  const head = (Icon, title, req) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={17} color={C.signal} /></span>
      <span style={{ ...disp, fontSize: 15.5, fontWeight: 800, color: C.ink }}>{title}</span>
      <span style={{ ...font, fontSize: 11, fontWeight: 800, color: req ? C.amberInk : C.muted, background: req ? C.amberBg : "#EEF0F3", borderRadius: 999, padding: "2px 9px" }}>{req ? t.required : t.optional}</span>
    </div>
  );
  const field = (k, lab, ph, extra = {}) => (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={label}>{lab}</span>
      <input value={form[k]} onChange={set(k)} placeholder={ph} aria-label={lab} style={input} {...extra} />
    </label>
  );
  const photoTile = (url, onRemove, big = false) => (
    <div key={url} style={{ position: "relative", width: big ? 200 : 110, height: big ? 140 : 110, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, background: C.canvas, flexShrink: 0 }}>
      <img src={src(url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {onRemove && <button type="button" onClick={onRemove} aria-label="Remove" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(7,32,47,0.75)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><X size={13} /></button>}
    </div>
  );
  const addTile = (where, text, big = false) => (
    <label style={{ ...font, width: big ? 200 : 110, height: big ? 140 : 110, borderRadius: 12, border: `2px dashed ${C.lineStrong}`, background: C.surfaceHigh, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: uploading ? "default" : "pointer", color: C.muted, fontSize: 12, fontWeight: 700, flexShrink: 0, textAlign: "center", padding: 6, boxSizing: "border-box" }}>
      {uploading === where ? t.uploading : <><Plus size={18} color={C.navy} />{text}</>}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(e) => { upload(where, e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
    </label>
  );

  if (loadError) return <div role="alert" style={{ ...font, ...card, color: C.redInk, background: C.redBg }}>{loadError}</div>;
  if (!server) return <div style={{ ...font, fontSize: 13, color: C.muted, padding: 12 }}>…</div>;

  return (
    <div data-testid="verification-page" style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 0, maxWidth: 900 }}>
      {/* where it stands */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: `linear-gradient(120deg, ${C.navyDeep}, ${C.navy} 60%, ${C.navySoft} 140%)` }}>
          <BadgeCheck size={26} color={C.signal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...disp, fontSize: 16, fontWeight: 800, color: "#fff" }}>{sentN === keys.length ? t.complete : t.progress(sentN, keys.length)}</div>
            <div style={{ ...font, fontSize: 12.5, color: C.onNavyMuted, marginTop: 2 }}>{t.intro}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 18px" }}>
          {keys.map((k) => (
            <span key={k} style={{ ...font, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: has[k] ? C.gaugeInk : C.amberInk, background: has[k] ? C.gaugeBg : C.amberBg, borderRadius: 999, padding: "4px 11px" }}>
              {has[k] ? <Check size={12} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber }} />}{t.items[k]}
            </span>
          ))}
        </div>
      </div>

      {/* the premises type */}
      <div style={card}>
        <span style={label}>{t.premises}</span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[["shop", t.shop, Store], ["warehouse", t.warehouse, Warehouse], ["both", t.both, Building2]].map(([v, text, Icon]) => (
            <button key={v} type="button" aria-pressed={form.premisesType === v} onClick={() => { setSavedAt(null); setForm((f) => ({ ...f, premisesType: v })); }}
              style={{ ...font, display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 16px", borderRadius: 12, border: `1.5px solid ${form.premisesType === v ? C.signal : C.line}`, background: form.premisesType === v ? C.goldTint : "#fff", color: C.ink, fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
              <Icon size={16} color={C.navy} /> {text}
            </button>
          ))}
        </div>
      </div>

      {/* the license */}
      <div style={card}>
        {head(FileText, t.licenseTitle, true)}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <span style={label}>{t.licensePhoto}</span>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              {form.licensePhotoUrl ? photoTile(form.licensePhotoUrl, () => { setSavedAt(null); setForm((f) => ({ ...f, licensePhotoUrl: null })); }, true) : addTile("license", t.upload, true)}
              {form.licensePhotoUrl && (
                <label style={{ ...font, fontSize: 12.5, fontWeight: 700, color: C.torque, cursor: "pointer" }}>
                  {uploading === "license" ? t.uploading : t.replace}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { upload("license", e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 6, maxWidth: 260 }}>{t.licenseHint}</div>
          </div>
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span style={label}>{t.creditCode}</span>
              <input value={form.creditCode} onChange={set("creditCode")} placeholder="91440101MA5XXXXXXX" aria-label={t.creditCode} style={{ ...input, ...mono, textTransform: "uppercase", letterSpacing: "0.04em", borderColor: check === false ? C.red : undefined }} />
              <span style={{ ...font, display: "block", fontSize: 11.5, marginTop: 5, color: check === true ? C.gaugeInk : check === false ? C.redInk : C.muted, fontWeight: check === null ? 500 : 700 }}>
                {check === true ? `✓ ${t.codeOk}` : check === false ? `⚠ ${t.codeBad}` : t.creditCodeHint}
              </span>
            </label>
            {field("legalRepName", `${t.legalRep} (${t.optional})`, "")}
          </div>
        </div>
      </div>

      {/* the premises photos */}
      <div style={card}>
        {head(Camera, t.photosTitle, true)}
        {[["outside", t.outside, t.outsideHint], ["inside", t.inside, t.insideHint]].map(([kind, title, hint]) => (
          <div key={kind} style={{ marginBottom: kind === "outside" ? 16 : 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...font, fontSize: 13.5, fontWeight: 800, color: C.ink }}>{title}</span>
              <span style={{ ...font, fontSize: 11.5, color: C.muted }}>{hint} · {t.max(MAX_PHOTOS)}</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {form.photos[kind].map((url, i) => photoTile(url, () => removePhoto(kind, i)))}
              {form.photos[kind].length < MAX_PHOTOS && addTile(kind, t.upload)}
            </div>
          </div>
        ))}
      </div>

      {/* the location */}
      <div style={card}>
        {head(MapPin, t.locationTitle, true)}
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={label}>{t.address}</span>
          <textarea value={form.addressText} onChange={set("addressText")} placeholder={t.addressPh} aria-label={t.address} rows={2} style={{ ...input, height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.5 }} />
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <button type="button" onClick={useMyLocation} disabled={locating} style={{ ...font, display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.navy}`, background: C.navy, color: "#fff", fontSize: 13, fontWeight: 800, cursor: locating ? "default" : "pointer" }}>
            <LocateFixed size={15} color={C.signal} /> {locating ? t.locating : t.useMine}
          </button>
          <div style={{ width: 130 }}>{field("latitude", t.lat, "23.129110", { inputMode: "decimal", style: { ...input, ...mono } })}</div>
          <div style={{ width: 130 }}>{field("longitude", t.lng, "113.264385", { inputMode: "decimal", style: { ...input, ...mono } })}</div>
          <label style={{ display: "block", flex: "1 1 240px", minWidth: 0 }}>
            <span style={label}>{t.mapLink}</span>
            <input onChange={fromLink} placeholder={t.mapLinkPh} aria-label={t.mapLink} style={input} />
          </label>
        </div>
        {linkNote && <div style={{ ...font, fontSize: 12, fontWeight: 700, color: linkNote === t.pinSet ? C.gaugeInk : C.amberInk, marginTop: 8 }}>{linkNote}</div>}
        {hasPin && (
          <iframe title="map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.006},${lat - 0.004},${lng + 0.006},${lat + 0.004}&layer=mapnik&marker=${lat},${lng}`}
            style={{ width: "100%", height: 220, border: `1px solid ${C.line}`, borderRadius: 12, marginTop: 12 }} />
        )}
      </div>

      {/* the contact person */}
      <div style={card}>
        {head(Phone, t.contactTitle, false)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {field("contactName", t.contactName, "")}
          {field("contactRole", t.contactRole, "")}
          {field("contactPhone", t.contactPhone, "+86 138 0000 0000", { inputMode: "tel" })}
        </div>
        <div style={{ ...font, fontSize: 11.5, color: C.muted, marginTop: 6 }}>{t.phoneHint}</div>
      </div>

      {/* the business details */}
      <div style={card}>
        {head(Building2, t.businessTitle, false)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {field("yearFounded", t.yearFounded, "2012", { inputMode: "numeric" })}
          {field("staffCount", t.staffCount, "25", { inputMode: "numeric" })}
          {field("warehouseSizeM2", t.size, "800", { inputMode: "numeric" })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
          {field("mainBrands", t.brands, t.brandsPh)}
          {field("mainCategories", t.categories, t.catsPh)}
        </div>
      </div>

      {/* save */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 5, paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.navy, borderRadius: 14, padding: "12px 14px 12px 18px", boxShadow: "0 10px 30px rgba(7,32,47,0.3)" }}>
          <span style={{ ...font, flex: 1, fontSize: 13, fontWeight: 700, color: error ? "#FFB4AC" : savedAt ? "#8FE0BE" : "#fff" }}>{error || (savedAt ? `✓ ${t.saved}` : t.progress(sentN, keys.length))}</span>
          <button type="button" onClick={save} disabled={saving || Boolean(uploading)} style={{ ...font, height: 42, padding: "0 26px", borderRadius: 10, border: `1px solid ${C.signalDark}`, background: saving ? "#D1D5DB" : C.signal, color: C.onSignal, fontSize: 14, fontWeight: 800, cursor: saving ? "default" : "pointer", boxShadow: SHADOW.goldRaised }}>
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
