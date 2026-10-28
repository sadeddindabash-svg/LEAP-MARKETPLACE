"use client";

import LocLink from "@/components/LocLink";
import { useT } from "@/components/LangProvider";
import { useOptionalWishlist } from "@/components/WishlistProvider";

const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6.1 5c2 0 3.3 1 3.9 2.2C10.6 6 11.9 5 13.9 5c3.4 0 5.2 3.4 3.7 6.8C19.5 16.4 12 21 12 21z";

function Heart({ saved }: { saved: boolean }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={saved ? "#d92d20" : "none"} stroke={saved ? "#d92d20" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={HEART} />
    </svg>
  );
}

/**
 * The heart that saves a part to the wishlist: outline when it is not saved, red when it is. "card" sits on the photo's bottom corner at the END side (it flips in Arabic) and is a button of its own beside the card's link
 * (a press never opens the part); "page" sits beside Share in the product page's title row. Signed out, it leads to the login page like the wide "Log in to save" button does.
 */
export default function WishlistHeart({ productId, name, variant }: { productId: string; name?: string; variant: "card" | "page" }) {
  const wishlist = useOptionalWishlist();
  const t = useT();
  if (!wishlist) return null;
  const saved = wishlist.isSaved(productId);
  const label = (name ? `${saved ? t("wishlist_remove_aria") : t("wishlist_add_aria")}: ${name}` : saved ? t("wishlist_remove_aria") : t("wishlist_add_aria"));
  const look = `grid place-items-center rounded-full border border-line bg-white shadow-sm transition-colors hover:border-[#d92d20] hover:text-[#d92d20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${variant === "card" ? "size-[38px]" : "size-[42px]"}`;
  const place = variant === "card" ? "pointer-events-auto absolute bottom-2.5 end-2.5 z-10" : "";
  const control = !wishlist.signedIn ? (
    <LocLink href="/login" data-testid="wishlist-heart" data-saved="false" aria-label={t("log_in_to_save")} title={t("log_in_to_save")} className={`${look} ${place} text-ink`}>
      <Heart saved={false} />
    </LocLink>
  ) : (
    <button
      type="button"
      data-testid="wishlist-heart"
      data-saved={saved ? "true" : "false"}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={!wishlist.ready}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void wishlist.toggle(productId); }}
      className={`${look} ${place} ${saved ? "text-[#d92d20]" : "text-ink"} disabled:opacity-60`}
    >
      <Heart saved={saved} />
    </button>
  );
  // On a card the control is laid over the square photo (its own box, not clickable itself) so the heart can sit on the photo's corner without being inside the card's link.
  return variant === "card" ? <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">{control}</div> : control;
}
