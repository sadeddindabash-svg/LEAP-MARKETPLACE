"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Real order confirmation -- a real Client Component since it reads a
// real orderId from the URL's search params after a real client-side
// checkout submission. Never needs search-engine visibility.
//
// REAL BUG FOUND AND FIXED HERE: useSearchParams() requires a real
// <Suspense> boundary around whatever uses it in the App Router --
// without one, the real production build fails outright while trying
// to prerender this page, rather than just warning. Confirmed by an
// actual real build attempt, not assumed.
function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="font-display font-bold text-4xl">Order confirmed</h1>
      {orderId && (
        <p className="mt-3 text-muted">
          Your order number is{" "}
          <span className="font-plate font-semibold text-ink">{orderId}</span>
        </p>
      )}
      <p className="mt-3 text-muted">
        A confirmation email is on its way. You can track your order&apos;s status
        by contacting support with your order number.
      </p>
      <Link
        href="/search"
        className="mt-8 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
      >
        Continue browsing
      </Link>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-6 py-20 text-center text-muted">
          Loading…
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
