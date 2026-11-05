"use client";

import { useEffect, useState } from "react";
import { useT } from "./LangProvider";

/**
 * "Your delivery code" with three steps that light up one after another (design A, confirmed with the person via mockup): the driver is at your door →
 * check the parcel → tell him this code. Each step lights up in gold in turn and turns green when done; the code comes clear at step 3 the first time,
 * then stays clear while the steps keep playing (tap the code to show it at once). On a computer and a tablet the steps sit side by side, on a phone
 * one under the other. A buyer whose device asks for less motion sees the three steps done and the code, without movement. English and Arabic.
 */
const STEP_MS = 1600;
const HOLD_MS = 3500;
const STEPS = [
  { icon: "🚚", title: "delivery_step1_title", sub: "delivery_step1_sub" },
  { icon: "📦", title: "delivery_step2_title", sub: "delivery_step2_sub" },
  { icon: "🗣️", title: "delivery_step3_title", sub: "delivery_step3_sub" },
] as const;

export default function DeliveryCodeSteps({ code }: { code: string }) {
  const t = useT();
  const [step, setStep] = useState(-1);      // -1: not started; 0..2: that step is lit; 3: all three done
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(3); setShown(true); return;
    }
    let i = -1;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      i = i >= 3 ? 0 : i + 1;
      setStep(i);
      if (i === 3) setShown(true);
      timer = setTimeout(next, i === 3 ? HOLD_MS : STEP_MS);
    };
    timer = setTimeout(next, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div data-testid="delivery-code-steps" className="mt-4 rounded-[12px] border-[1.5px] border-navy bg-white p-4">
      <style>{`@keyframes leap-dc-bob { 50% { transform: translateY(-3px); } } @media (prefers-reduced-motion: reduce) { .leap-dc * { animation: none !important; transition: none !important; } }`}</style>
      <p className="font-bold">{t("delivery_code_title")}</p>
      <ol className="leap-dc mt-3 grid gap-2 md:grid-cols-3">
        {STEPS.map((s, j) => {
          const state = step === 3 || j < step ? "done" : j === step ? "on" : "wait";
          return (
            <li key={s.title} data-state={state} className={`flex items-center gap-2.5 rounded-[11px] border-[1.5px] p-2.5 transition-all duration-300 md:flex-col md:text-center ${state === "on" ? "border-signal bg-[#fffaeb] shadow-[0_4px_14px_rgba(249,179,23,0.25)]" : state === "done" ? "border-[#bfe3d2] bg-[#f1faf5]" : "scale-[0.98] border-line opacity-45"}`}>
              <span aria-hidden="true" className={`grid size-8 flex-none place-items-center rounded-full text-[15px] ${state === "done" ? "bg-[#0f6b49]" : "bg-navy"}`} style={state === "on" ? { animation: "leap-dc-bob 1s ease-in-out infinite" } : undefined}>{s.icon}</span>
              <span className="min-w-0"><span className="block text-[13.5px] font-bold leading-tight">{j + 1} · {t(s.title)}</span><span className="block text-xs text-muted">{t(s.sub)}</span></span>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={() => setShown(true)} aria-label={shown ? t("delivery_code_title") : t("delivery_code_tap")} className={`mx-auto mt-3 flex justify-center gap-2 transition-all duration-500 ${shown ? "" : "opacity-30 blur-[3px]"}`} dir="ltr">
        {code.split("").map((d, i) => <span key={i} className="flex h-14 w-12 items-center justify-center rounded-[10px] bg-chalk font-plate text-3xl font-extrabold text-navy">{d}</span>)}
      </button>
      <p className="mt-2 text-center text-xs text-muted">{t("delivery_code_never")}</p>
    </div>
  );
}
