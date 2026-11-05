"use client";

import { useEffect, useRef, useState } from "react";
import SafeImage from "@/components/SafeImage";
import Link from "@/components/LocLink";
import LoyaltyCard from "@/components/LoyaltyCard";
import { CountUp } from "@/components/CountUp";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { deleteAccount, fetchMyGarage, fetchMyOrders, fetchUnreadNotificationCount, fetchWishlist, resolveImageUrl, updateAvatar, uploadReviewPhoto } from "@/lib/api";

const outline = "inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk disabled:opacity-50";

function Stat({ value, label }: { value: number | null; label: string }) {
  return <li className="rounded-[14px] border border-line bg-white p-4 text-center max-md:rounded-[12px] max-md:px-1 max-md:py-2"><p className="text-3xl font-extrabold tabular-nums text-navy max-md:text-xl max-md:leading-tight">{value === null ? "–" : <CountUp value={value} />}</p><p className="text-sm font-semibold text-muted max-md:text-[11.5px]">{label}</p></li>;
}

// The account hub, like the app's account screen: the buyer, their photo, their numbers (vehicles, orders, wishlist), their loyalty card, the way to sign out, and deleting
// the account (asked twice: whether, then the password).
export default function AccountPage() {
  const { user, isLoading, logout, refreshUser } = useAuth();
  const t = useT();
  const router = useLocRouter();
  const photoInput = useRef<HTMLInputElement>(null);
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
      {/* the profile (design B): the photo with its camera badge (click either to change it), "Welcome back", the name and email, and a bell with the
          unread count. The name is not an <h1> tag: the menu's title box hides the pages' own h1 titles, and this one must stay. */}
      <section className="flex flex-wrap items-center gap-5 rounded-[14px] border border-line bg-white p-5 max-md:flex-nowrap max-md:gap-3 max-md:p-3 sm:p-6" aria-labelledby="acc-h">
        <label className={`relative block size-[84px] flex-none max-md:size-14 ${photoBusy ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
          <span className="relative grid size-[84px] place-items-center overflow-hidden rounded-full bg-navy text-[34px] font-extrabold text-white max-md:size-14 max-md:text-[22px]">
            {user.avatarUrl ? <SafeImage src={resolveImageUrl(user.avatarUrl)} alt="" fill sizes="84px" className="object-cover" unoptimized /> : <span aria-hidden="true">{(user.name || user.email).charAt(0).toUpperCase()}</span>}
          </span>
          <span aria-hidden="true" className="absolute -bottom-0.5 -end-0.5 grid size-8 place-items-center rounded-full border-[3px] border-white bg-signal text-navy max-md:size-6 max-md:border-2 [&>svg]:max-md:size-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>
          <input ref={photoInput} type="file" accept="image/*" className="sr-only" aria-label={t("change_photo")} disabled={photoBusy} onChange={(e) => { changePhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted max-md:text-[12px] max-md:leading-tight">{t("welcome_back")}</p>
          <p id="acc-h" role="heading" aria-level={1} className="text-[17px] font-extrabold leading-tight text-navy [overflow-wrap:anywhere] sm:truncate sm:text-2xl"><bdi>{user.name || user.email}</bdi></p>
          {user.name && <p className="truncate text-muted max-md:text-[13px] max-md:leading-tight"><bdi dir="ltr">{user.email}</bdi></p>}
          <button type="button" disabled={photoBusy} onClick={() => photoInput.current?.click()} className="mt-1 text-sm font-bold text-navy underline underline-offset-4 disabled:opacity-50 max-md:mt-0.5 max-md:text-[12.5px]">{photoBusy ? t("saving") : t("change_photo")}</button>
        </div>
        <Link href="/notifications" aria-label={`${t("notifications")}${counts && counts.unread > 0 ? ` (${counts.unread})` : ""}`} className="relative grid size-12 flex-none place-items-center rounded-xl border-[1.5px] border-line text-navy transition-colors hover:border-navy max-md:size-10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          {counts && counts.unread > 0 && <span aria-hidden="true" className="absolute -top-2 -end-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d93025] px-1.5 text-[11px] font-extrabold text-white">{counts.unread > 99 ? "99+" : counts.unread}</span>}
        </Link>
      </section>

      <ul className="grid grid-cols-3 gap-4 max-md:!gap-2" aria-label={t("account_settings_header")}>
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
