import { STAGES, buyerFacingStatus, statusLabel } from "@/lib/orders";
import type { Lang } from "@/lib/i18n";

/** pending, preparing, shipped, delivered as four steps on a line: each reached step a navy circle with a gold tick, joined by gold; the steps still to
 *  come grey. A status outside those four (cancelled, returns) is shown as a label alone. */
export default function StatusTimeline({ status, lang }: { status: string; lang: Lang }) {
  const shown = buyerFacingStatus(status);
  const current = (STAGES as readonly string[]).indexOf(shown);
  if (current === -1) {
    return <span className="inline-flex rounded-full bg-[#eef2f5] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#33424d]">{statusLabel(lang, shown)}</span>;
  }
  return (
    <ol className="flex items-start" aria-label={statusLabel(lang, shown)}>
      {STAGES.map((stage, i) => {
        const reached = i <= current;
        return (
          <li key={stage} aria-current={i === current ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
            {i > 0 && <span aria-hidden="true" className={`absolute end-1/2 top-[10px] h-[3px] w-full ${reached ? "bg-signal" : "bg-[#dce5eb]"}`} />}
            <span aria-hidden="true" className={`relative z-[1] grid size-[23px] place-items-center rounded-full text-[12px] font-black ${reached ? "bg-navy text-signal" : "border-2 border-[#dce5eb] bg-white text-transparent"} ${i === current && shown !== "delivered" ? "ring-4 ring-signal/30" : ""}`}>✓</span>
            <span className={`text-[11.5px] font-bold ${i === current ? "text-navy" : reached ? "text-ink" : "text-muted"}`}>{statusLabel(lang, stage)}</span>
          </li>
        );
      })}
    </ol>
  );
}
