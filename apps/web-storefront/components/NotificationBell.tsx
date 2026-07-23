"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
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
const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell() {
  const { user, isLoading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    const token = getAuthToken();
    if (!token) return;
    const load = () => fetchUnreadNotificationCount(token).then(setUnreadCount);
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  return (
    <Link href="/notifications" className="relative text-muted hover:text-ink">
      Alerts
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-4 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
