"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { addToWishlist, checkWishlisted, removeFromWishlist } from "@/lib/api";
import { getAuthToken, useAuth } from "./AuthProvider";
import { useT } from "./LangProvider";

const button = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-navy px-5 font-bold text-navy hover:bg-chalk disabled:opacity-60";

/**
 * "Notify me when back in stock", shown on a part that is sold out. Like the mobile app, the notification IS the wishlist: saving the part is how the buyer asks to be told, and
 * saving it again takes it back. Signed out, it leads to sign-in.
 */
export default function NotifyWhenInStock({ productId }: { productId: string }) {
  const { user } = useAuth();
  const t = useT();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string; subscribed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    checkWishlisted(token, productId).then((subscribed) => { if (current) setState({ userId, subscribed }); }).catch(() => {});
    return () => { current = false; };
  }, [userId, productId]);

  if (!userId) return <Link href="/login" className={button}>{t("notify_back_in_stock")}</Link>;
  const subscribed = state?.userId === userId && state.subscribed;
  const toggle = async () => {
    const token = getAuthToken();
    if (!token) return;
    setBusy(true);
    try {
      if (subscribed) await removeFromWishlist(token, productId); else await addToWishlist(token, productId);
      setState({ userId, subscribed: !subscribed });
      setToast(!subscribed);
    } catch { /* leave it as it was */ } finally { setBusy(false); }
  };
  return (
    <div>
      <button type="button" className={button} onClick={toggle} disabled={busy} aria-pressed={subscribed}>
        {subscribed ? t("notify_subscribed") : t("notify_back_in_stock")}
      </button>
      <p role="status" className="mt-2 text-sm font-semibold text-[#0f6b49]">{toast ? t("notify_toast") : ""}</p>
    </div>
  );
}
