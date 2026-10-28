"use client";

import LocLink from "@/components/LocLink";
import { useT } from "@/components/LangProvider";
import { useOptionalWishlist } from "@/components/WishlistProvider";

// A whole, symmetric heart (the Lucide heart): it spans x 2 to 22 and y 3 to 21 of the 24 x 24 box, centred on x = 12, so the line (2 wide) stays inside the box. (The first drawing, made by hand, stopped short on the right.)
const HEART = "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

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
