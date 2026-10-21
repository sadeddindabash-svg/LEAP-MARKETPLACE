import Image from "next/image";
import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";
import type { SocialLink } from "@/lib/footerContent";

/**
 * The social media icons under the footer's tagline: only the ones that have a link, each opening its page in a new tab. An icon with no picture of its own shows the Leap logo (until the admin chooses one).
 * The name is what a screen reader says and what shows when the mouse rests on the icon.
 */
export default function FooterSocial({ items, label }: { items: SocialLink[]; label: string }) {
  const shown = items.filter((i) => i.url);
  if (shown.length === 0) return null;
  return (
    <ul aria-label={label} className="mt-4 flex flex-wrap gap-3">
      {shown.map((i) => (
        <li key={i.id}>
          <a href={i.url as string} target="_blank" rel="noopener noreferrer" aria-label={i.name} title={i.name} className="relative block size-9 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20 hover:ring-signal">
            {i.icon ? <SafeImage src={resolveImageUrl(i.icon)} alt="" fill sizes="36px" className="object-cover" unoptimized /> : <Image src="/leap-logo.png" alt="" fill sizes="36px" className="object-cover" />}
          </a>
        </li>
      ))}
    </ul>
  );
}
