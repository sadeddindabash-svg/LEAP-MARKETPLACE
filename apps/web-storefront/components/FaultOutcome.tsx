"use client";

import Link from "@/components/LocLink";
import { useLang } from "@/components/LangProvider";
import type { FaultOutcome } from "@/lib/api";

// What happened to a part the inspection hub found a problem with (patch-buyer-fault-tracking): shown on the order page and the tracking page,
// so the buyer is not left with a part that seems stuck at "Received at hub".
const TEXT = {
  en: {
    checking: "Our inspection team is checking this part. We will tell you as soon as we know more.",
    problem: "Our inspection found a problem with this part. We are arranging a replacement or a refund.",
    replaced: "Replaced: we are sending you a new part at no charge.",
    replacedLink: "Follow order",
    refunding: (a: string) => `Your refund of $${a} is being processed.`,
    refunded: (a: string) => `Refunded $${a}. It can take a few days to appear with your bank.`,
    closed: "This case is closed.",
  },
  ar: {
    checking: "يقوم فريق الفحص لدينا بفحص هذه القطعة، وسنبلغك فور معرفة المزيد.",
    problem: "وجد الفحص مشكلة في هذه القطعة. نعمل على ترتيب استبدالها أو إعادة المبلغ.",
    replaced: "تم الاستبدال: سنرسل لك قطعة جديدة مجانًا.",
    replacedLink: "تابع الطلب",
    refunding: (a: string) => `جارٍ معالجة استرداد ${a}$.`,
    refunded: (a: string) => `تم استرداد ${a}$. قد يستغرق ظهوره لدى البنك بضعة أيام.`,
    closed: "تم إغلاق هذه الحالة.",
  },
};

export default function FaultOutcomeBox({ outcome, query = "" }: { outcome?: FaultOutcome | null; query?: string }) {
  const lang = useLang();
  if (!outcome) return null;
  const x = TEXT[lang === "ar" ? "ar" : "en"];
  const done = outcome.state === "replaced" || outcome.state === "refunded" || outcome.state === "closed";
  const amount = Number(outcome.refundAmount || 0).toFixed(2);
  const text = outcome.state === "checking" ? x.checking
    : outcome.state === "problem" ? x.problem
    : outcome.state === "replaced" ? x.replaced
    : outcome.state === "refunding" ? x.refunding(amount)
    : outcome.state === "refunded" ? x.refunded(amount)
    : x.closed;
  return (
    <div data-testid="fault-outcome" role="status" className={`mt-4 rounded-[12px] border p-3.5 text-sm font-semibold ${done ? "border-[#b9e4cc] bg-[#e8f7ef] text-[#0f6b49]" : "border-[#f3d27a] bg-[#fdf3d8] text-[#7a4e00]"}`}>
      <p>{text}</p>
      {outcome.state === "replaced" && outcome.replacementOrderId && (
        <p className="mt-2">
          <Link href={`/orders/${encodeURIComponent(outcome.replacementOrderId)}${query}`} className="font-bold text-navy underline underline-offset-4">
            {x.replacedLink} <span className="font-plate" dir="ltr">{outcome.replacementOrderId}</span>
          </Link>
        </p>
      )}
    </div>
  );
}
