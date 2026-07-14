import React, { useState, useEffect } from "react";
import {
  PackageCheck, LogOut, ChevronLeft, Camera, X, AlertTriangle,
  PackageOpen, Search as SearchIcon, ClipboardCheck, PackagePlus, Truck, Inbox,
} from "lucide-react";
import {
  getStoredToken, saveToken, clearToken, getCurrentUser, SessionExpiredError,
  fetchMyShipments, fetchMyShipmentById, recordShipmentEvent, uploadEvidencePhoto,
} from "./auth";
import LoginPage from "./LoginPage";
import { HubContext, useHub } from "./hubContext";

const C = {
  ink: "#14171C", canvas: "#F5F6F8", card: "#FFFFFF", line: "#E4E6EA",
  signal: "#E8622C", torque: "#2A5FD9", gauge: "#1E9D6B", amber: "#B9791F", red: "#C0362C",
  muted: "#6B7280", gaugeBg: "#E4F5EC", amberBg: "#FCEFD8", torqueBg: "#E9EFFC", redBg: "#FBE7E5",
};
const disp = { fontFamily: "'Barlow Condensed', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

// The real step sequence, plus the copy/icon for each — matches the
// backend's STATUS_ORDER exactly (services/api/src/modules/hub/routes.js).
const STEP_INFO = {
  awaiting_receipt: { next: "received", label: "Awaiting receipt", actionLabel: "Confirm Received", icon: Inbox, promptTitle: "Receiving this shipment", promptHint: "Photograph the package as it arrives, before opening it." },
  received: { next: "opened", label: "Received", actionLabel: "Confirm Opened", icon: PackageOpen, promptTitle: "Opening the package", promptHint: "Photograph the contents once opened." },
  opened: { next: "inspected", label: "Opened", actionLabel: "Confirm Inspected", icon: SearchIcon, promptTitle: "Inspecting the item", promptHint: "Photograph the part clearly — orientation, side, and any OEM markings." },
  inspected: { next: "packed", label: "Inspected", actionLabel: "Confirm Packed", icon: PackagePlus, promptTitle: "Packing for the buyer", promptHint: "Photograph the item repackaged and ready to ship." },
  packed: { next: "shipped_to_buyer", label: "Packed", actionLabel: "Confirm Shipped", icon: Truck, promptTitle: "Shipping to the buyer", promptHint: "Photograph the final package label, and enter the tracking number." },
  shipped_to_buyer: { next: null, label: "Shipped to buyer", actionLabel: null, icon: ClipboardCheck, promptTitle: null, promptHint: null },
  flagged: { next: null, label: "Flagged", actionLabel: null, icon: AlertTriangle, promptTitle: null, promptHint: null },
};
const STATUS_COLOR = {
  awaiting_receipt: [C.amber, C.amberBg], received: [C.torque, C.torqueBg], opened: [C.torque, C.torqueBg],
  inspected: [C.torque, C.torqueBg], packed: [C.torque, C.torqueBg], shipped_to_buyer: [C.gauge, C.gaugeBg],
  flagged: [C.red, C.redBg],
};

function Badge({ status }) {
  const [color, bg] = STATUS_COLOR[status] || [C.muted, "#EEEFF1"];
  const label = STEP_INFO[status]?.label || status;
  return (
    <span style={{ ...body, fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 6, padding: "4px 9px", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function TopBar() {
  const { currentUser, onLogout } = useHub();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${C.line}`, background: C.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.signal, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PackageCheck size={16} color="#fff" />
        </div>
        <div style={{ ...disp, fontSize: 18, fontWeight: 700, color: C.ink }}>LEAP HUB</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ ...body, fontSize: 12.5, color: C.muted }}>{currentUser?.email}</div>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
          <LogOut size={13} /> Log out
        </button>
      </div>
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "awaiting_receipt", label: "Awaiting receipt" },
  { id: "in_progress", label: "In progress" },
  { id: "shipped_to_buyer", label: "Shipped" },
  { id: "flagged", label: "Flagged" },
];
const IN_PROGRESS_STATUSES = ["received", "opened", "inspected", "packed"];

function QueueScreen({ onOpenShipment }) {
  const { onSessionExpired } = useHub();
  const [shipments, setShipments] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [filter, setFilter] = useState("all");

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
    if (filter === "all") return true;
    if (filter === "in_progress") return IN_PROGRESS_STATUSES.includes(s.status);
    return s.status === filter;
  });

  return (
    <div>
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ ...disp, fontSize: 22, fontWeight: 700, color: C.ink }}>Inbound shipments</div>
        <div style={{ ...body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>
          {loadState === "ready" ? `${filtered.length} of ${shipments.length} shown` : "Loading…"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "14px 20px 0", overflowX: "auto" }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              ...body, padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              border: `1px solid ${filter === f.id ? C.ink : C.line}`, background: filter === f.id ? C.ink : "#fff", color: filter === f.id ? "#fff" : C.ink,
            }}
          >{f.label}</button>
        ))}
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {loadState === "loading" && <div style={{ ...body, textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>Loading…</div>}
        {loadState === "error" && <div style={{ ...body, textAlign: "center", padding: 32, color: C.red, fontSize: 13 }}>{errorMessage}</div>}
        {loadState === "ready" && filtered.length === 0 && (
          <div style={{ ...body, textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>Nothing here right now.</div>
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
        <span style={{ fontSize: 10, ...body }}>Add photo</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" style={{ display: "none" }} onChange={handleSelect} disabled={isUploading} />
      </label>
    </div>
  );
}

function ShipmentDetailScreen({ shipmentId, onBack }) {
  const { onSessionExpired } = useHub();
  const [shipment, setShipment] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState(null);
  const [notes, setNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [photos, setPhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);

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
      setErrorMessage("At least 1 evidence photo is required for this step.");
      return;
    }
    if (step === "shipped_to_buyer" && !trackingNumber.trim()) {
      setErrorMessage("A tracking number is required for the final shipping step.");
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

  if (loadState === "loading") {
    return <div style={{ padding: 40, textAlign: "center", ...body, color: C.muted, fontSize: 13 }}>Loading…</div>;
  }
  if (loadState === "error" && !shipment) {
    return <div style={{ padding: 40, textAlign: "center", ...body, color: C.red, fontSize: 13 }}>{errorMessage}</div>;
  }

  const info = STEP_INFO[shipment.status];
  const isTerminal = shipment.status === "shipped_to_buyer" || shipment.status === "flagged";

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
          <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>ITEMS</div>
          {shipment.items.map((item, i) => (
            <div key={i} style={{ ...body, fontSize: 13, color: C.ink, padding: "4px 0" }}>{item.name} × {item.quantity}</div>
          ))}
        </div>

        {errorMessage && (
          <div style={{ ...body, fontSize: 12.5, color: C.red, background: C.redBg, borderRadius: 8, padding: 10 }}>{errorMessage}</div>
        )}

        {!isTerminal && !showFlagForm && (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
            <div style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{info.promptTitle}</div>
            <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 16 }}>{info.promptHint}</div>

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>EVIDENCE PHOTOS (at least 1)</div>
            <EvidencePhotoPicker photos={photos} onAdd={handleAddPhoto} onRemove={removePhoto} isUploading={isUploadingPhoto} />

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "16px 0 8px" }}>NOTES (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...body, width: "100%", boxSizing: "border-box", height: 64, borderRadius: 8, border: `1px solid ${C.line}`, padding: 10, fontSize: 13, resize: "none" }}
            />

            {info.next === "shipped_to_buyer" && (
              <>
                <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "16px 0 8px" }}>TRACKING NUMBER TO BUYER</div>
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
              {isSubmitting ? "Saving…" : info.actionLabel}
            </button>
            <button
              onClick={() => { setShowFlagForm(true); setPhotos([]); setNotes(""); setErrorMessage(null); }}
              style={{ ...body, width: "100%", marginTop: 8, padding: "11px 16px", borderRadius: 9, border: `1px solid ${C.red}`, background: "#fff", color: C.red, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Flag a quality issue instead
            </button>
          </div>
        )}

        {!isTerminal && showFlagForm && (
          <div style={{ background: C.redBg, border: `1px solid ${C.red}44`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={17} color={C.red} />
              <div style={{ ...disp, fontSize: 17, fontWeight: 700, color: C.ink }}>Flag a quality issue</div>
            </div>
            <div style={{ ...body, fontSize: 12.5, color: C.muted, marginBottom: 16 }}>
              Wrong item, damage, mismatched fitment — describe what's wrong and photograph it. This goes straight to the Leap platform team.
            </div>

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 8 }}>EVIDENCE PHOTOS (at least 1)</div>
            <EvidencePhotoPicker photos={photos} onAdd={handleAddPhoto} onRemove={removePhoto} isUploading={isUploadingPhoto} />

            <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, margin: "16px 0 8px" }}>WHAT'S WRONG</div>
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
              {isSubmitting ? "Saving…" : "Submit flag"}
            </button>
            <button onClick={() => setShowFlagForm(false)} style={{ ...body, width: "100%", marginTop: 8, padding: "11px 16px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}

        {isTerminal && (
          <div style={{ background: shipment.status === "flagged" ? C.redBg : C.gaugeBg, borderRadius: 10, padding: 14, ...body, fontSize: 13, color: shipment.status === "flagged" ? C.red : C.gauge, fontWeight: 700 }}>
            {shipment.status === "flagged" ? "This shipment is flagged and awaiting platform review." : "This shipment has completed its journey to the buyer."}
          </div>
        )}

        <div>
          <div style={{ ...body, fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>HISTORY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shipment.events.length === 0 && <div style={{ ...body, fontSize: 12.5, color: C.muted }}>No steps recorded yet.</div>}
            {shipment.events.map((e) => {
              const stepInfo = STEP_INFO[e.step];
              const Icon = stepInfo?.icon || ClipboardCheck;
              return (
                <div key={e.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon size={14} color={e.step === "flagged" ? C.red : C.ink} />
                    <span style={{ ...body, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{stepInfo?.label || e.step}</span>
                    <span style={{ ...body, fontSize: 11, color: C.muted, marginLeft: "auto" }}>{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.notes && <div style={{ ...body, fontSize: 12.5, color: C.ink, marginBottom: 8 }}>{e.notes}</div>}
                  {e.trackingNumber && <div style={{ ...body, fontSize: 12, color: C.muted, marginBottom: 8 }}>Tracking: {e.trackingNumber}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {e.photos.map((url, i) => (
                      <img key={i} src={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}${url}`} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
                    ))}
                  </div>
                  <div style={{ ...body, fontSize: 10.5, color: C.muted, marginTop: 6 }}>by {e.performedBy}</div>
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

  if (authState.status === "checking") {
    return <div style={{ ...body, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: C.muted, fontSize: 13 }}>Checking session…</div>;
  }
  if (authState.status === "loggedOut") {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }
  return (
    <HubContext.Provider value={{ currentUser: authState.user, onLogout: handleLogout, onSessionExpired: handleLogout }}>
      <HubShell />
    </HubContext.Provider>
  );
}
