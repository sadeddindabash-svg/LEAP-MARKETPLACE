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
          <h1 className="text-2xl font-bold tracking-tight text-navy">{rc.reason}</h1>
          <p className="text-sm text-muted">{t("for_order")} <Link href={orderHref} className="font-plate font-semibold underline underline-offset-4" dir="ltr">{rc.orderId}</Link></p>
        </div>
        <StatusPill label={statusLabel(lang, rc.status)} done={rc.status === "completed"} />
      </div>
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
