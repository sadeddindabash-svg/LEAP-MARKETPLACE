"use client";

import { useEffect, useState } from "react";
import Link from "@/components/LocLink";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { useT } from "@/components/LangProvider";
import { fetchUnreadNotificationCount } from "@/lib/api";

// Real unread-notification badge in the header, mirroring CartIcon's
// exact style -- plain text link, no icon library used anywhere in
// this app.
//
// Deliberately polls (unlike CartIcon, which only reacts to real LOCAL
// state changes the user causes in this same browser session) --
// a notification arrives from a real SERVER-side event (an order
// status change, a support reply, etc.) the user isn't directly
// causing here, so a one-time fetch on page load would silently go
// stale. Same reasoning as apps/mobile/lib/features/orders/
// tracking_screen.dart's real auto-refresh fix earlier this session.
const POLL_INTERVAL_MS = 5_000;

export default function NotificationBell() {
  const { user, isLoading: authLoading } = useAuth();
  const t = useT();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    const token = getAuthToken();
    if (!token) return;
    // A check that cannot reach the server (it is stopped or restarting, or the connection dropped) must not throw: it is a background refresh of a small badge. The badge keeps
    // its last number and the next check, 30 seconds later, tries again.
    const load = () => fetchUnreadNotificationCount(token).then(setUnreadCount).catch(() => {});
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  return (
    <Link href="/notifications" className="relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" /></svg>
      <span>{t("notifications")}</span>
      {unreadCount > 0 && (
        <span className="absolute top-0 end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-signal px-1 text-xs font-bold text-on-signal">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
