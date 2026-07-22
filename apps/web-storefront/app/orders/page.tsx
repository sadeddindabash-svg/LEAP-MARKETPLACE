"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { OrderSummary, fetchMyOrders } from "@/lib/api";

// Real order history page (new) -- closes the single biggest gap this
// storefront had: a buyer who checked out here previously had no way
// to ever see a past order again (checkout only shows a one-time
// confirmation page). Client Component, same reasoning as
// saved-searches: real logged-in account, no SEO value.
export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
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
    fetchMyOrders(token)
      .then((data) => { setOrders(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">My orders</h1>
        <p className="mt-3 text-muted">
          Log in to see your order history.
          <br />
          Guest checkout orders are confirmed by email, but aren&apos;t listed here unless you have an account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display font-bold text-3xl">My orders</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {loadState === "ready" && orders.length === 0 ? (
        <p className="mt-8 text-muted">
          No orders yet.{" "}
          <Link href="/" className="text-signal font-medium">
            Start shopping
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-signal transition-colors"
            >
              <div>
                <p className="font-semibold text-sm">{o.id}</p>
                <p className="text-xs text-muted mt-1">
                  {new Date(o.placedAt).toLocaleDateString()} · {o.currencyCode} {o.total.toFixed(2)}
                </p>
              </div>
              <span className="text-xs font-semibold uppercase text-signal">
                {o.displayStatus.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
