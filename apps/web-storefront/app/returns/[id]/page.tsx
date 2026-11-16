"use client";

import { Suspense, useCallback } from "react";
import SafeImage from "@/components/SafeImage";
import { useParams, useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import { EmailGate, MessageThread, ReplyForm, StatusPill } from "@/components/MessageThread";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { usePolled } from "@/components/usePolled";
import { fetchReturnCase, resolveImageUrl, sendReturnCaseMessage } from "@/lib/api";
import { formatUsd } from "@/lib/returnText";      // patch-returns-flow
import { statusLabel } from "@/lib/orders";
import { CONVERSATION_POLL_MS } from "@/lib/support";

function ReturnCase({ caseId }: { caseId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const guestEmail = useSearchParams().get("guestEmail");
  const token = user ? getAuthToken() : null;
  const canSee = !!token || !!guestEmail;
  const auth = { token: token ?? undefined, guestEmail: token ? undefined : guestEmail ?? undefined };
  const load = useCallback(() => fetchReturnCase(caseId, { token: token ?? undefined, guestEmail: token ? undefined : guestEmail ?? undefined }), [caseId, token, guestEmail]);
  const { data: rc, error, loading, reload } = usePolled(load, CONVERSATION_POLL_MS, !authLoading && canSee);

  if (authLoading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!canSee) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <h1 className="mb-4 text-2xl font-bold">{t("my_returns_title")} {caseId}</h1>
        <EmailGate prompt={t("return_email_prompt")} onSubmit={(email) => router.push(`/returns/${encodeURIComponent(caseId)}?guestEmail=${encodeURIComponent(email)}`)} />
      </div>
    );
  }
  if (loading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 text-muted" aria-busy="true">{t("search_loading")}</div>;
  if (!rc) {
    const notFound = /not found|غير موجود/i.test(error?.message ?? "");
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        {notFound ? <h1 className="text-2xl font-bold">{t("order_not_found")}</h1> : <p role="alert" className="font-semibold text-[#a12a21]">{t("return_load_error")} {error?.message}</p>}
        <p className="mt-3"><Link href="/returns" className="font-bold text-navy underline underline-offset-4">{t("back_to_returns")}</Link></p>
      </div>
    );
  }
  const orderHref = `/orders/${encodeURIComponent(rc.orderId)}${!token && guestEmail ? `?guestEmail=${encodeURIComponent(guestEmail)}` : ""}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <p className="mb-2"><Link href="/returns" className="text-sm font-semibold text-navy underline underline-offset-4">{t("back_to_returns")}</Link></p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">{rc.reasonCode && rc.reasonCode !== "other" ? t(`return_reason_${rc.reasonCode}`) : rc.reason}</h1>
          <p className="text-sm text-muted">{t("for_order")} <Link href={orderHref} className="font-plate font-semibold underline underline-offset-4" dir="ltr">{rc.orderId}</Link></p>
        </div>
        <StatusPill label={statusLabel(lang, rc.status)} done={rc.status === "completed"} />
      </div>
      {(rc.status === "approved" || rc.status === "completed") && rc.sendBack != null && (
        <section className="mb-6 rounded-xl border border-[#f3d27a] bg-[#fdf3d8] p-4 text-sm text-ink" aria-label={t("return_send_title")}>
          {rc.sendBack && rc.returnHub ? (
            rc.receivedAt ? <p className="font-semibold">{t("return_part_received")}</p> : (
              <>
                <h2 className="mb-2 text-base font-bold text-navy">{t("return_send_title")}</h2>
                <p>{t("return_send_to")}</p>
                <p className="mt-1 font-bold" dir="auto">{rc.returnHub.name}</p>
                <p dir="auto">{rc.returnHub.address}</p>
                <p className="mt-3">{t("return_send_code")} <span className="ms-1 inline-block rounded-md border-[1.5px] border-navy bg-white px-2 py-0.5 font-plate font-bold text-navy" dir="ltr">{rc.id}</span></p>
                <p className="mt-2 text-muted">{t("return_send_receipt")}</p>
              </>
            )
          ) : <p className="font-semibold">{t("return_keep_part")}</p>}
          {rc.refundAmount ? (
            <p className="mt-3 border-t border-[#f3d27a] pt-3 font-semibold">
              {rc.refundedAt ? t("return_refund_done", { amount: formatUsd(rc.refundAmount) })
                : rc.refundStatus === "waiting_part" ? t("return_refund_waiting_part", { amount: formatUsd(rc.refundAmount) })
                : t("return_refund_pending", { amount: formatUsd(rc.refundAmount) })}
            </p>
          ) : null}
        </section>
      )}
      {rc.photos.length > 0 && (
        <section className="mb-6" aria-label={t("return_photos")}>
          <ul className="flex flex-wrap gap-2">
            {rc.photos.map((url) => <li key={url}><a href={resolveImageUrl(url)} target="_blank" rel="noreferrer" className="relative block size-24 overflow-hidden rounded-lg bg-[#e6edf2]"><SafeImage src={resolveImageUrl(url)} alt={t("return_photos")} fill sizes="96px" className="object-cover" unoptimized /></a></li>)}
          </ul>
        </section>
      )}
      <MessageThread messages={rc.messages} />
      <ReplyForm onSend={async (text) => { await sendReturnCaseMessage(rc.id, text, auth); reload(); }} />
    </div>
  );
}

export default function ReturnCasePage() {
  const { id } = useParams<{ id: string }>();
  return <Suspense fallback={null}><ReturnCase caseId={id} /></Suspense>;
}
