"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { OrderDetail, fetchOrderById } from "@/lib/api";

// Real order detail page (new) -- the second half of order history.
// Shows the real per-supplier split (an order can be fulfilled by
// multiple suppliers, each with its own status/tracking) and the
// real hub inspection timeline where one exists -- same structure the
// mobile app, admin dashboard, and supplier/hub portals already show,
// now visible here too. Client Component, same reasoning as the
// orders list: real logged-in account, no SEO value.
export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
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
    fetchOrderById(token, orderId)
      .then((data) => { setOrder(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user, orderId]);

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Order</h1>
        <p className="mt-3 text-muted">Log in to see this order.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !order) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display font-bold text-3xl">Order</h1>
        <p className="mt-4 text-sm text-red-600">{error || "Order not found."}</p>
        <Link href="/orders" className="mt-6 inline-block text-signal font-medium">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/orders" className="text-sm text-muted hover:text-ink">
        ← Back to orders
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl">{order.id}</h1>
        <span className="text-xs font-semibold uppercase text-signal">
          {order.displayStatus.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Placed {new Date(order.placedAt).toLocaleDateString()} · {order.currencyCode} {order.total.toFixed(2)}
        {order.discountAmount > 0 && ` (${order.currencyCode} ${order.discountAmount.toFixed(2)} discount${order.promoCode ? ` — ${order.promoCode}` : ""})`}
      </p>

      {order.address ? (
        <div className="mt-6 rounded-lg border border-line bg-white p-4">
          <p className="text-xs font-semibold text-muted uppercase">Shipping to</p>
          <p className="mt-1 text-sm">
            {order.address.recipientName}
            <br />
            {order.address.streetAddress}, {order.address.city}, {order.address.country}
            <br />
            {order.address.phone}
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-line bg-white p-4 text-sm text-muted">
          Shipping address pending.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {order.supplierSubOrders.map((so) => (
          <div key={so.subOrderId} className="rounded-lg border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{so.supplierName || "Supplier"}</p>
              <span className="text-xs font-semibold uppercase text-muted">{so.status.replace(/_/g, " ")}</span>
            </div>
            {so.trackingNumber && (
              <p className="mt-1 text-xs text-muted">Tracking: {so.trackingNumber}</p>
            )}
            <ul className="mt-3 space-y-1">
              {so.items.map((item) => (
                <li key={item.productId} className="flex justify-between text-sm">
                  <span>{item.name} × {item.quantity}</span>
                  <span className="text-muted">{order.currencyCode} {(item.unitPrice * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            {so.hubShipment && so.hubShipment.events.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-semibold text-muted uppercase mb-2">
                  {so.hubName ? `${so.hubName} — ` : ""}Inspection hub timeline
                </p>
                <ol className="space-y-1.5">
                  {so.hubShipment.events.map((e, i) => (
                    <li key={i} className="text-xs text-muted flex justify-between">
                      <span className="text-ink font-medium">{e.step.replace(/_/g, " ")}</span>
                      <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
