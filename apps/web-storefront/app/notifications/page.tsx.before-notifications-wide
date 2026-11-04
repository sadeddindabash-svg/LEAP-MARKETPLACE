"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/useAutoRefresh";
import SignInPrompt from "@/components/SignInPrompt";
import { getAuthToken, useAuth } from "@/components/AuthProvider";
import { useLang, useT } from "@/components/LangProvider";
import { useLocRouter } from "@/components/useLocRouter";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, resolveNotificationLink, type Notification } from "@/lib/api";
import { timeAgo } from "@/lib/time";

// Notifications: newest first, the unread ones marked; opening one marks it read and goes to what it is about (an order, a ticket, a product, a saved search). Their words come
// from the server already in the page's language.
export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const lang = useLang();
  const t = useT();
  const router = useLocRouter();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;
    let current = true;
    fetchNotifications(token, lang).then((n) => { if (current) setItems(n); }).catch(() => { if (current) { setFailed(true); setItems([]); } });
    return () => { current = false; };
  }, [user, lang]);
  useAutoRefresh(async () => { const token = getAuthToken(); if (!token) return; setItems(await fetchNotifications(token, lang)); }, { enabled: !!user });

  const open = useCallback(async (n: Notification) => {
    const token = getAuthToken();
    if (token && !n.isRead) {
      setItems((cur) => cur && cur.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      markNotificationRead(token, n.id).catch(() => {});
    }
    const href = resolveNotificationLink(n);
    if (href) router.push(href);
  }, [router]);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8" aria-busy="true">{t("search_loading")}</div>;
  if (!user) return <SignInPrompt messageKey="login_for_notifications" next="/notifications" />;
  const unread = items?.filter((n) => !n.isRead).length ?? 0;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t("notifications")}</h1>
        {unread > 0 && (
          <button type="button" className="inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-navy px-4 text-sm font-bold text-navy hover:bg-chalk"
            onClick={() => { const token = getAuthToken(); if (!token) return; setItems((cur) => cur && cur.map((x) => ({ ...x, isRead: true }))); markAllNotificationsRead(token).catch(() => {}); }}>{t("mark_all_read")}</button>
        )}
      </div>
      {failed && <p role="alert" className="mb-4 font-semibold text-[#a12a21]">{t("load_error_generic")}</p>}
      {items === null ? <p className="text-muted" aria-busy="true">{t("search_loading")}</p> : items.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-white p-6 text-muted">{t("no_notifications_yet")}</p>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} className={`flex w-full items-start gap-3 rounded-[14px] border p-4 text-start transition-colors hover:border-navy ${n.isRead ? "border-line bg-white" : "border-[#f0d9a0] bg-[#fff8e5]"}`}>
                <span aria-hidden="true" className={`mt-1.5 size-2.5 flex-none rounded-full ${n.isRead ? "bg-transparent" : "bg-signal"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.isRead ? "font-semibold" : "font-extrabold"}`}>{n.title}</span>
                  <span className="block text-sm text-muted">{n.body}</span>
                  <span className="mt-1 block text-xs text-muted">{timeAgo(lang, n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="sr-only">{t("notifications")}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
