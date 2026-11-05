"use client";

import { useState } from "react";
import { useT } from "./LangProvider";

/**
 * "Your delivery code" in ONE box that changes in place (confirmed with the person via mockup). The buyer taps through it:
 *   "Is the driver at your door?" → Yes → (the same box) "Did you check the parcel?" → Yes → "Show the code" → the code.
 * "Hide the code" starts again. Three small dots show how far the buyer is. Same on computer, tablet and phone; English and Arabic.
 */
const QUESTIONS = [
  { icon: "🚚", q: "delivery_box_q1", sub: "delivery_box_q1_sub" },
  { icon: "📦", q: "delivery_box_q2", sub: "delivery_box_q2_sub" },
] as const;

const CSS = `@keyframes leap-dcb-in { from { opacity: 0; transform: translateX(24px); } }
@keyframes leap-dcb-in-rtl { from { opacity: 0; transform: translateX(-24px); } }
@keyframes leap-dcb-tap { 50% { transform: scale(1.04); box-shadow: 0 0 0 6px rgba(249,179,23,0.25); } }
.leap-dcb-pg { animation: leap-dcb-in .4s cubic-bezier(.2,.8,.2,1); }
[dir="rtl"] .leap-dcb-pg { animation-name: leap-dcb-in-rtl; }
.leap-dcb-tap { animation: leap-dcb-tap 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .leap-dcb-pg, .leap-dcb-tap { animation: none !important; } }`;

function Pips({ at }: { at: number }) {
  return (
    <span aria-hidden="true" className="mt-1 flex gap-[5px]">
      {[0, 1, 2].map((i) => (
        <i key={i} className={`h-[7px] rounded-[4px] transition-all ${i < at ? "w-[7px] bg-[#0f6b49]" : i === at ? "w-[18px] bg-signal" : "w-[7px] bg-[#e6d7ad]"}`} />
      ))}
    </span>
  );
}

function Icon({ children }: { children: string }) {
  return <span aria-hidden="true" className="grid size-[52px] place-items-center rounded-full bg-navy text-2xl shadow-[0_0_0_4px_#fff,0_0_0_6px_#f9b317]">{children}</span>;
}

export default function DeliveryCodeBox({ code }: { code: string }) {
  const t = useT();
  const [stage, setStage] = useState(0); // 0: driver at the door? · 1: parcel checked? · 2: show the code · 3: the code
  const yes = "leap-dcb-tap min-h-11 min-w-[140px] rounded-[12px] px-5 text-[14.5px] font-extrabold";

  return (
    <div data-testid="delivery-code-box" className="mt-4 rounded-[12px] border-[1.5px] border-navy bg-white p-4">
      <style>{CSS}</style>
      <p className="font-bold">{t("delivery_code_title")}</p>
      <div
        data-stage={stage}
        aria-live="polite"
        className={`mt-2.5 flex min-h-[172px] flex-col items-center justify-center overflow-hidden rounded-[14px] border-signal p-3.5 text-center ${stage === 3 ? "border-2 bg-white" : "border-[1.5px] bg-[#fffaeb]"}`}
      >
        <div key={stage} className="leap-dcb-pg flex w-full flex-col items-center gap-2">
          {stage < 2 && (
            <>
              <Icon>{QUESTIONS[stage].icon}</Icon>
              <p className="text-base font-extrabold text-navy">{t(QUESTIONS[stage].q)}</p>
              <p className="-mt-1 text-[12.5px] text-muted">{t(QUESTIONS[stage].sub)}</p>
              <button type="button" data-testid="delivery-box-yes" onClick={() => setStage(stage + 1)} className={`${yes} bg-navy text-white`}>{t("delivery_box_yes")}</button>
              <Pips at={stage} />
            </>
          )}
          {stage === 2 && (
            <>
              <Icon>🔒</Icon>
              <p className="text-base font-extrabold text-navy">{t("delivery_box_tell")}</p>
              <button type="button" data-testid="delivery-box-show" onClick={() => setStage(3)} className={`${yes} bg-signal text-navy`}>🔓 {t("delivery_box_show")}</button>
              <Pips at={2} />
            </>
          )}
          {stage === 3 && (
            <>
              <p className="text-base font-extrabold text-navy">🗣️ {t("delivery_box_tell")}</p>
              <p dir="ltr" data-testid="delivery-box-digits" className="flex justify-center gap-2">
                {code.split("").map((d, i) => <span key={i} className="flex h-14 w-12 items-center justify-center rounded-[10px] bg-chalk font-plate text-3xl font-extrabold text-navy">{d}</span>)}
              </p>
              <button type="button" onClick={() => setStage(0)} className="text-xs font-semibold text-muted underline underline-offset-2">{t("delivery_box_hide")}</button>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted">{t("delivery_box_never")}</p>
    </div>
  );
}
