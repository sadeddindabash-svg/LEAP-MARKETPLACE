"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

// Real, minimal account link in the header -- shows "Log in" when
// signed out, or the buyer's own name/email plus a real log-out action
// when signed in. Client Component since it needs to react to a real
// sign-in/out without a full page reload, same reasoning as CartIcon.
export default function AccountLink() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return null;

  // Real, always-visible Returns/Support links (new) -- unlike Orders/
  // Wishlist/Referrals below, which are genuinely account-only
  // concepts, a guest can track a return or a support ticket too (via
  // a matching email lookup -- see app/returns/page.tsx and
  // app/support/page.tsx), so neither is gated behind login.
  const returnsLink = (
    <Link href="/returns" className="text-muted hover:text-ink">
      Returns
    </Link>
  );
  const supportLink = (
    <Link href="/support" className="text-muted hover:text-ink">
      Support
    </Link>
  );

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        {returnsLink}
        {supportLink}
        <Link href="/login" className="text-muted hover:text-ink">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/orders" className="text-muted hover:text-ink">
        Orders
      </Link>
      {returnsLink}
      {supportLink}
      <Link href="/wishlist" className="text-muted hover:text-ink">
        Wishlist
      </Link>
      <Link href="/referrals" className="text-muted hover:text-ink">
        Referrals
      </Link>
      <Link href="/saved-searches" className="text-muted hover:text-ink">
        {user.name || user.email}
      </Link>
      <button onClick={logout} className="text-muted hover:text-ink">
        Log out
      </button>
    </div>
  );
}
