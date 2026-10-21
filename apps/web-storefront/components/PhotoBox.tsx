import SafeImage from "@/components/SafeImage";
import { resolveImageUrl } from "@/lib/api";

/**
 * A SQUARE photo, for a section, a part, a brand: the photo when there is one, otherwise a plain tile with a small picture icon (so a list never has holes, and a photo added later
 * simply takes the tile's place). `className` sets the size (`size-14`), `sizes` tells the browser how wide it will really be.
 */
export default function PhotoBox({ src, className = "size-12", sizes = "56px" }: { src?: string | null; className?: string; sizes?: string }) {
  return (
    <span className={`relative grid flex-none place-items-center overflow-hidden rounded-xl bg-[#e6edf2] text-[#8696a2] ${className}`}>
      {src ? (
        <SafeImage src={resolveImageUrl(src)} alt="" fill sizes={sizes} className="object-cover" unoptimized />
      ) : (
        <svg aria-hidden="true" width="40%" height="40%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></svg>
      )}
    </span>
  );
}
