"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, getAuthToken } from "@/components/AuthProvider";
import { ReferralInfo, fetchMyReferral } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

// Real referrals page (new) -- a buyer's own real referral code, real
// stats, and a real shareable link. Same login-gated pattern as
// orders/wishlist/saved-searches. Reuses GET /referrals/me, the same
// endpoint the mobile app already uses -- a code is created on first
// request if the buyer doesn't have one yet, so there's no separate
// "generate a code" action needed here.
export default function ReferralsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => setLoadState("ready"));
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    fetchMyReferral(token)
      .then((data) => { setReferral(data); setLoadState("ready"); })
      .catch((err) => { setError(err.message); setLoadState("error"); });
  }, [authLoading, user]);

  const referralLink = referral ? `${SITE_URL}/signup?ref=${referral.code}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || loadState === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display font-bold text-3xl">Refer a friend</h1>
        <p className="mt-3 text-muted">Log in to get your own referral link.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-md bg-signal px-6 py-3 text-white font-semibold hover:bg-signal-dark transition-colors"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !referral) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display font-bold text-3xl">Refer a friend</h1>
        <p className="mt-4 text-sm text-red-600">{error || "Could not load your referral info."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display font-bold text-3xl">Refer a friend</h1>
      <p className="mt-2 text-muted">
        Share your link. When a friend signs up with it, you both benefit.
      </p>

      <div className="mt-8 rounded-lg border border-line bg-white p-4">
        <p className="text-xs font-semibold text-muted uppercase">Your code</p>
        <p className="mt-1 font-plate font-bold text-2xl tracking-wide">{referral.code}</p>

        <p className="mt-4 text-xs font-semibold text-muted uppercase">Your link</p>
        <div className="mt-1 flex gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted"
          />
          <button
            onClick={handleCopy}
            className="rounded-md bg-signal px-4 py-2 text-sm text-white font-semibold hover:bg-signal-dark transition-colors flex-shrink-0"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-line bg-white p-4 text-center">
          <p className="text-2xl font-bold">{referral.totalReferred}</p>
          <p className="text-xs text-muted mt-1">Friends referred</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 text-center">
          <p className="text-2xl font-bold">{referral.rewardsEarned} / {referral.maxRewards}</p>
          <p className="text-xs text-muted mt-1">Rewards earned</p>
        </div>
      </div>

      {referral.capReached && (
        <p className="mt-4 text-sm text-muted">
          You&apos;ve reached the maximum number of referral rewards. Thanks for spreading the word!
        </p>
      )}
    </div>
  );
}
