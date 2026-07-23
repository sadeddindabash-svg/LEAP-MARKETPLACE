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

  if (!user) {
    return (
      <Link href="/login" className="text-muted hover:text-ink">
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/orders" className="text-muted hover:text-ink">
        Orders
      </Link>
      <Link href="/wishlist" className="text-muted hover:text-ink">
        Wishlist
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
