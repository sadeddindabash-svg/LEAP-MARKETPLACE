"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

/**
 * A photo that fails to load (a missing file, a bad address) disappears, leaving whatever sits behind it (the grey box of its frame), instead of the browser's broken-image icon.
 * The frame that holds the photo is the caller's: this only draws the photo, so the layout never changes whether it loads or not.
 */
export default function SafeImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line jsx-a11y/alt-text -- alt comes through props
  return <Image {...props} onError={(event) => { setFailed(true); props.onError?.(event); }} />;
}
