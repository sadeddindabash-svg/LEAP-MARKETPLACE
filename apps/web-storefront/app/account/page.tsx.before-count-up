"use client";

import { useEffect, useState } from "react";
import SafeImage from "@/components/SafeImage";
import Link from "@/components/LocLink";
import LoyaltyCard from "@/components/LoyaltyCard";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { deleteAccount, fetchMyGarage, fetchMyOrders, fetchUnreadNotificationCount, fetchWishlist, resolveImageUrl, updateAvatar, uploadReviewPhoto } from "@/lib/api";

const outline = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

function Stat({ value, label }: { value: number | null; label: string }) {
  return <li className="rounded-[14px] border border-line bg-white p-4 text-center"><p className="text-3xl font-extrabold text-navy">{value ?? "–"}</p><p className="text-sm font-semibold text-muted">{label}</p></li>;
}

// The account hub, like the app's account screen: the buyer, their photo, their numbers (vehicles, orders, wishlist), their loyalty card, the way to sign out, and deleting
// the account (asked twice: whether, then the password).
export default function AccountPage() {
  const { user, isLoading, logout, refreshUser } = useAuth();
  const t = useT();
  const router = useLocRouter();
  const [counts, setCounts] = useState<{ vehicles: number; orders: number; wishlist: number; unread: number } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState<"closed" | "ask" | "password">("closed");
  const [password, setPassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    Promise.all([fetchMyGarage(token).catch(() => []), fetchMyOrders(token).catch(() => []), fetchWishlist(token).catch(() => []), fetchUnreadNotificationCount(token).catch(() => 0)])
      .then(([vehicles, orders, wishlist, unread]) => { if (current) setCounts({ vehicles: vehicles.length, orders: orders.length, wishlist: wishlist.length, unread }); });
    return () => { current = false; };
  }, [user]);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">{t("loading_account")}</div>;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("guest_browsing")}</h1>
        <p className="mb-5 mt-2 text-lg text-muted">{t("guest_prompt")}</p>
        <div className="flex flex-wrap gap-3"><Link href="/login?next=%2Faccount" className="inline-flex min-h-12 items-center rounded-[10px] bg-signal px-6 font-bold text-on-signal hover:bg-signal-dark">{t("log_in")}</Link><Link href="/signup?next=%2Faccount" className={outline}>{t("sign_up")}</Link></div>
      </div>
    );
  }

  const changePhoto = async (file: File | undefined) => {
    const token = getAuthToken();
    if (!file || !token) return;
    setPhotoBusy(true); setMessage(null);
    try { await updateAvatar(token, await uploadReviewPhoto(token, file)); await refreshUser(); }
    catch { setMessage({ kind: "error", text: t("could_not_update_photo") }); }
    finally { setPhotoBusy(false); }
  };

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token || !password) return;
    setDeleteBusy(true); setMessage(null);
    try { await deleteAccount(token, password); logout(); router.push("/"); }
    catch (err) { setMessage({ kind: "error", text: err instanceof Error && err.message ? err.message : t("incorrect_password_error") }); setDeleteBusy(false); }
  };

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center gap-5 rounded-[14px] border border-line bg-white p-5" aria-labelledby="acc-h">
        <span className="relative grid size-20 flex-none place-items-center overflow-hidden rounded-full bg-navy text-3xl font-bold text-white">
          {user.avatarUrl ? <SafeImage src={resolveImageUrl(user.avatarUrl)} alt="" fill sizes="80px" className="object-cover" unoptimized /> : <span aria-hidden="true">{(user.name || user.email).charAt(0).toUpperCase()}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="acc-h" className="truncate text-2xl font-bold text-navy">{user.name || user.email}</h1>
          {user.name && <p className="truncate text-muted" dir="ltr">{user.email}</p>}
          <label className={`${outline} mt-2 cursor-pointer`}>
            {photoBusy ? t("saving") : t("change_photo")}
            <input type="file" accept="image/*" className="sr-only" aria-label={t("change_photo")} disabled={photoBusy} onChange={(e) => { changePhoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
        <Link href="/notifications" className={outline}>{t("notifications")}{counts && counts.unread > 0 ? ` (${counts.unread})` : ""}</Link>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3" aria-label={t("account_settings_header")}>
        <Stat value={counts?.vehicles ?? null} label={t("vehicles_stat")} /><Stat value={counts?.orders ?? null} label={t("orders_stat")} /><Stat value={counts?.wishlist ?? null} label={t("wishlist_stat")} />
      </ul>

      <LoyaltyCard />

      {message && <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm font-semibold ${message.kind === "error" ? "text-[#a12a21]" : "text-[#0f6b49]"}`}>{message.text}</p>}

      <section className="flex flex-wrap gap-3" aria-label={t("account_settings_header")}>
        <button type="button" className={outline} onClick={() => { logout(); router.push("/"); }}>{t("sign_out")}</button>
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#a12a21] px-4 text-sm font-bold text-[#a12a21] hover:bg-[#fdf2f1]" onClick={() => { setDeleting("ask"); setPassword(""); setMessage(null); }}>{t("delete_account_label")}</button>
      </section>

      {deleting === "ask" && (
        <div role="alertdialog" aria-label={t("delete_account_confirm_title")} className="rounded-[14px] border border-[#e6b8b3] bg-[#fdf2f1] p-5">
          <p className="font-bold">{t("delete_account_confirm_title")}</p>
          <p className="mb-4 mt-1 text-sm text-muted">{t("delete_account_confirm_body")}</p>
          <div className="flex flex-wrap gap-3"><button type="button" className={outline} onClick={() => setDeleting("closed")}>{t("cancel")}</button><button type="button" className="inline-flex min-h-11 items-center rounded-[10px] bg-[#a12a21] px-5 text-sm font-bold text-white" onClick={() => setDeleting("password")}>{t("continue_label")}</button></div>
        </div>
      )}
      {deleting === "password" && (
        <form onSubmit={confirmDelete} noValidate role="alertdialog" aria-label={t("delete_account_confirm_title")} className="rounded-[14px] border border-[#e6b8b3] bg-[#fdf2f1] p-5">
          <label htmlFor="del-pw" className="mb-2 block font-bold">{t("confirm_password_title")}</label>
          <input id="del-pw" type="password" autoComplete="current-password" className="mb-4 min-h-12 w-full max-w-sm rounded-[10px] border-[1.5px] border-[#c5d0d8] bg-white px-3" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex flex-wrap gap-3"><button type="button" className={outline} onClick={() => setDeleting("closed")} disabled={deleteBusy}>{t("cancel")}</button><button type="submit" disabled={deleteBusy || !password} className="inline-flex min-h-11 items-center rounded-[10px] bg-[#a12a21] px-5 text-sm font-bold text-white disabled:opacity-50">{t("delete")}</button></div>
        </form>
      )}
    </div>
  );
}
