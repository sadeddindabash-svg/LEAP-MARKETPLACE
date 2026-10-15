"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localizePath } from "@/lib/i18n";
import { useLang } from "./LangProvider";

type Props = ComponentProps<typeof NextLink>;

/**
 * next/link that keeps the visitor's language: in Arabic every internal address gets the /ar prefix. Used as `Link` everywhere in the storefront, so no page has to
 * think about it. Anything that is not an internal absolute path (a full URL, an anchor, mailto) is left exactly as it is.
 */
export default function LocLink({ href, ...rest }: Props) {
  const lang = useLang();
  let target = href;
  if (typeof href === "string") target = localizePath(lang, href);
  else if (href && typeof href === "object" && typeof href.pathname === "string") target = { ...href, pathname: localizePath(lang, href.pathname) };
  return <NextLink href={target} {...rest} />;
}
