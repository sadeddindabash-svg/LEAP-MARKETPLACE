import { STAGES, buyerFacingStatus, statusLabel } from "@/lib/orders";
import type { Lang } from "@/lib/i18n";

/** pending, preparing, shipped, delivered as four steps with the current one marked. A status outside those four (cancelled, returns) is shown as a label alone. */
export default function StatusTimeline({ status, lang }: { status: string; lang: Lang }) {
  const shown = buyerFacingStatus(status);
  const current = (STAGES as readonly string[]).indexOf(shown);
  if (current === -1) {
    return <span className="inline-flex rounded-full bg-[#eef2f5] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#33424d]">{statusLabel(lang, shown)}</span>;
  }
  return (
    <ol className="flex items-center gap-1.5" aria-label={statusLabel(lang, shown)}>
      {STAGES.map((stage, i) => (
        <li key={stage} aria-current={i === current ? "step" : undefined} className="flex flex-1 flex-col gap-1">
          <span className={`h-1.5 rounded-full ${i <= current ? (shown === "delivered" ? "bg-[#0f6b49]" : "bg-signal") : "bg-[#dce5eb]"}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wide ${i === current ? "text-navy" : "text-muted"}`}>{statusLabel(lang, stage)}</span>
        </li>
      ))}
    </ol>
  );
}
