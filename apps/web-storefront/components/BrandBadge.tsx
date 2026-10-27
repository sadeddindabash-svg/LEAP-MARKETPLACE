"use client";

import { useState } from "react";
import Image from "next/image";

/** The vehicle brand's logo in the corner of a product's photo (the brand of the car the part fits): a small white circle. A logo that cannot be loaded is not drawn at all (no empty circle). */
export default function BrandBadge({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span data-testid="brand-badge" className="absolute start-2.5 top-2.5 grid size-10 place-items-center overflow-hidden rounded-full border border-line bg-white p-1 shadow-sm">
      <Image src={src} alt={name} width={32} height={32} unoptimized className="size-full object-contain" onError={() => setFailed(true)} />
    </span>
  );
}
