import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { C, body } from "./theme";
import { SessionExpiredError, getStoredToken, fetchUnusedPictures, removeUnusedPictures } from "./auth";

// "Pictures nothing uses": the pictures left behind on the server by earlier imports that replaced a picture. CHECK lists how many (nothing is removed), REMOVE deletes them after one more question. The server only ever removes a
// picture that no table mentions and that is more than a day old, and it looks again at the moment of removing, so an old list can never delete something that has become used.
const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const button = (primary) => ({ ...body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: primary ? C.ink : C.line, background: primary ? C.ink : "#fff", color: primary ? "#fff" : C.ink });

export default function UnusedPicturesCard({ onSessionExpired }) {
  const [phase, setPhase] = useState("idle");       // idle | checking | found | asking | removing | done
  const [info, setInfo] = useState(null); const [done, setDone] = useState(null); const [error, setError] = useState(null);
  const fail = (err) => { if (err instanceof SessionExpiredError) { onSessionExpired?.(); return; } setError(err.message); };
  const check = async () => { setPhase("checking"); setError(null); setDone(null); try { setInfo(await fetchUnusedPictures(getStoredToken())); setPhase("found"); } catch (err) { setPhase("idle"); fail(err); } };
  const remove = async () => { setPhase("removing"); setError(null); try { setDone(await removeUnusedPictures(getStoredToken())); setPhase("done"); } catch (err) { setPhase("asking"); fail(err); } };
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.card, marginTop: 14 }}>
      <div style={{ ...body, fontSize: 14, fontWeight: 700, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={15} /> Pictures nothing uses</div>
      <p style={{ ...body, fontSize: 12.5, color: C.muted, margin: "6px 0 10px", lineHeight: 1.5 }}>When an import replaces a picture, the old picture used to stay on the server. This finds those old pictures (pictures that no vehicle, product, category or setting uses, and that are more than a day old) so you can remove them. Nothing is removed until you confirm.</p>
      {error && <div role="alert" style={{ ...body, fontSize: 12.5, color: C.red, marginBottom: 8 }}>{error}</div>}
      {(phase === "idle" || phase === "checking" || phase === "done") && <button type="button" style={button(false)} disabled={phase === "checking"} onClick={check}>{phase === "checking" ? "Checking…" : phase === "done" ? "Check again" : "Check for unused pictures"}</button>}
      {phase === "done" && done && <div role="status" style={{ ...body, fontSize: 13, color: "#16794F", marginBottom: 8 }}>{done.removed === 0 ? "Nothing was removed." : `Removed ${plural(done.removed, "picture", "pictures")} (${sizeText(done.bytes)}).`}{done.failed > 0 ? ` ${plural(done.failed, "picture could", "pictures could")} not be removed.` : ""}</div>}
      {(phase === "found" || phase === "asking" || phase === "removing") && info && (
        <div>
          <div style={{ ...body, fontSize: 13, color: C.ink, marginBottom: 8 }}>
            {info.count === 0 ? "No unused pictures. Nothing to remove." : <><b>{plural(info.count, "unused picture", "unused pictures")}</b> ({sizeText(info.bytes)}) of {info.scanned} pictures on the server.</>}
            {info.tooNew > 0 && <span style={{ color: C.muted }}> {plural(info.tooNew, "more is", "more are")} less than a day old and left alone.</span>}
          </div>
          {info.count > 0 && phase === "found" && <div style={{ display: "flex", gap: 8 }}><button type="button" style={button(true)} onClick={() => setPhase("asking")}>Remove them</button><button type="button" style={button(false)} onClick={check}>Check again</button></div>}
          {phase !== "found" && info.count > 0 && <div style={{ ...body, fontSize: 13, color: C.ink, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>Remove {plural(info.count, "picture", "pictures")} for ever? This cannot be undone.<button type="button" style={button(true)} disabled={phase === "removing"} onClick={remove}>{phase === "removing" ? "Removing…" : "Yes, remove them"}</button><button type="button" style={button(false)} disabled={phase === "removing"} onClick={() => setPhase("found")}>No</button></div>}
        </div>
      )}
    </div>
  );
}
