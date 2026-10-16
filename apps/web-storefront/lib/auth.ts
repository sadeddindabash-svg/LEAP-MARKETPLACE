export const PASSWORD_MIN = 8;                         // the server refuses anything shorter

/**
 * Where to send the buyer after they sign in (the page that asked them to: "/login?next=/checkout"). ONLY a path on this site is accepted. An address to another site
 * ("https://evil.example", "//evil.example", "/\evil.example") would let a link in a phishing email send a buyer somewhere else the moment they type their password.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  try {
    const url = new URL(next, "http://site.invalid");
    return url.origin === "http://site.invalid" ? next : null;
  } catch {
    return null;
  }
}

/** The sign-in address that comes back to [path] afterwards. */
export const loginHrefFor = (path: string): string => `/login?next=${encodeURIComponent(path)}`;

/** Six digits, as an authenticator app shows them (spaces are allowed when pasting "123 456"). */
export const normalizeCode = (raw: string): string => raw.replace(/\s+/g, "");
export const isSixDigitCode = (raw: string): boolean => /^\d{6}$/.test(normalizeCode(raw));
