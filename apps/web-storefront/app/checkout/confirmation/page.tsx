"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/LocLink";
import { useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";

function Confirmation() {
  const params = useSearchParams();
  const { user } = useAuth();
  const t = useT();
  const orderId = params.get("orderId");
  const guestEmail = params.get("guestEmail");
  const [later, setLater] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-8">
      <h1 className="text-[clamp(30px,4vw,42px)] font-bold tracking-tight text-navy">{t("order_placed_title")}</h1>
      {orderId && <p className="mt-3 text-lg">{t("order_placed_with_id", { id: orderId })}</p>}
      <p className="mt-3 text-muted">{t("order_confirmed_note")}</p>

      {/* The app asks a guest, right after the order, whether to keep their order history in an account. */}
      {guestEmail && !later && (
        <section className="mx-auto mt-8 max-w-md rounded-[14px] border border-line border-t-[6px] border-t-signal bg-white p-6 text-start" aria-labelledby="guest-account">
          <h2 id="guest-account" className="text-xl font-bold">{t("guest_account_title")}</h2>
          <p className="mb-5 mt-2 text-muted">{t("guest_account_body")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/signup?email=${encodeURIComponent(guestEmail)}`} className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("create_account")}</Link>
            <button type="button" onClick={() => setLater(true)} className="inline-flex min-h-12 items-center rounded-[10px] border-[1.5px] border-navy px-5 font-bold text-navy hover:bg-chalk">{t("maybe_later")}</button>
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {user && orderId && <Link href={`/orders/${encodeURIComponent(orderId)}`} className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("view_order")}</Link>}
        <Link href="/search" className="inline-flex min-h-12 items-center rounded-[10px] border-[1.5px] border-navy px-6 font-bold text-navy hover:bg-chalk">{t("continue_shopping")}</Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <Confirmation />
    </Suspense>
  );
}
