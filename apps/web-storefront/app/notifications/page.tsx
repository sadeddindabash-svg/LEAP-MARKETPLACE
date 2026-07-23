"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { Notification, fetchNotifications, markNotificationRead, markAllNotificationsRead, resolveNotificationLink } from "@/lib/api";

// Real notifications page (new) -- the read side of the same real
// notification system the mobile app already has (migration 019),
// triggered by real order/return/ticket/price-drop/saved-search
// events. Login-gated, same pattern as orders/wishlist/referrals.
export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => setLoadState("ready"));
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    fetchNotifications(token)
      .then((data) => { setNotifications(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  const handleMarkRead = async (id: number) => {
    const token = getAuthToken();
    if (!token) return;
    await markNotificationRead(token, id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = async () => {
    const token = getAuthToken();
    if (!token) return;
    await markAllNotificationsRead(token);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Notifications</h1>
        <p className="mt-3 text-muted">Log in to see your notifications.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-3xl">Notifications</h1>
        {hasUnread && (
          <button onClick={handleMarkAllRead} className="text-xs font-semibold text-muted hover:text-ink">
            Mark all read
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loadState === "ready" && notifications.length === 0 ? (
        <p className="mt-8 text-muted">No notifications yet.</p>
      ) : (
        <div className="mt-8 space-y-2">
          {notifications.map((n) => {
            const link = resolveNotificationLink(n);
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm ${n.isRead ? "font-medium" : "font-bold"}`}>{n.title}</p>
                  {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-signal flex-shrink-0" />}
                </div>
                <p className="mt-1 text-xs text-muted">{n.body}</p>
                <p className="mt-2 text-[11px] text-muted">{new Date(n.createdAt).toLocaleDateString()}</p>
              </>
            );

            const cardClass = `block rounded-lg border p-4 transition-colors ${
              n.isRead ? "border-line bg-white" : "border-signal bg-white"
            } ${link ? "hover:border-signal" : ""}`;

            return link ? (
              <Link key={n.id} href={link} onClick={() => !n.isRead && handleMarkRead(n.id)} className={cardClass}>
                {content}
              </Link>
            ) : (
              <div
                key={n.id}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                className={`${cardClass} ${!n.isRead ? "cursor-pointer" : ""}`}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
