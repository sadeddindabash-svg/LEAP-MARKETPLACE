import { describe, it, expect } from "vitest";
import { isSixDigitCode, loginHrefFor, normalizeCode, safeNext, PASSWORD_MIN } from "./auth";
import { memberLabel, progressFraction, tierColor, tierIcon, tierName } from "./loyalty";
import { totpAt } from "./testTotp";

describe("where to go after signing in", () => {
  it("CRITICAL: only a path on THIS site is accepted; an address to another site is refused (it would send a buyer to a phishing page the moment they typed their password)", () => {
    for (const ok of ["/", "/checkout", "/orders/ord_1?guestEmail=a%40b.co", "/account/two-factor", "/search?category=brake&page=2"]) expect(safeNext(ok), ok).toBe(ok);
    for (const bad of ["https://evil.example", "http://evil.example/x", "//evil.example", "///evil.example", "/\\evil.example", "\\\\evil.example", "javascript:alert(1)", "evil.example", "checkout", "", null, undefined, "/ok\\../evil"]) expect(safeNext(bad as string), String(bad)).toBeNull();
  });
  it("the sign-in address that comes back to a page", () => {
    expect(loginHrefFor("/checkout")).toBe("/login?next=%2Fcheckout");
    expect(safeNext(decodeURIComponent("%2Fcheckout"))).toBe("/checkout");
    expect(PASSWORD_MIN).toBe(8);
  });
});

describe("the authenticator code", () => {
  it("is exactly six digits; spaces are allowed when pasting '123 456'", () => {
    expect(isSixDigitCode("123456")).toBe(true);
    expect(isSixDigitCode("123 456")).toBe(true);
    expect(isSixDigitCode(" 123456 ")).toBe(true);
    for (const bad of ["12345", "1234567", "12a456", "", "      ", "١٢٣٤٥٦"]) expect(isSixDigitCode(bad), bad).toBe(false);
    expect(normalizeCode("123 456")).toBe("123456");
  });
  it("the test helper matches the standard (RFC 6238 test vector: the secret '12345678901234567890' at 59 seconds gives 287082)", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";              // base32 of the RFC's ASCII secret
    expect(totpAt(secret, 59_000)).toBe("287082");
    expect(totpAt(secret, 1111111109_000)).toBe("081804");
  });
});

describe("loyalty (the app's rules)", () => {
  const tier = { name: "Gold", nameAr: "ذهبي" };
  it("the tier name is Arabic in Arabic when the server has one, else the English one", () => {
    expect(tierName("en", tier)).toBe("Gold");
    expect(tierName("ar", tier)).toBe("ذهبي");
    expect(tierName("ar", { name: "Gold", nameAr: null })).toBe("Gold");
  });
  it("the member label reads 'Gold Member' in English and 'العضوية / ذهبي' in Arabic (word first, then a slash)", () => {
    expect(memberLabel("en", "Gold", "Member")).toBe("Gold Member");
    expect(memberLabel("ar", "ذهبي", "العضوية")).toBe("العضوية / ذهبي");
  });
  it("colours and icons the server names are the app's; anything unknown is the plain grey and the medal", () => {
    expect(tierColor("amber")).toBe("#d98e04"); expect(tierColor("purple")).toBe("#8b5cf6"); expect(tierColor("nonsense")).toBe("#53636f");
    for (const name of ["award", "diamond", "crown", "star"]) expect(tierIcon(name)).toBe(name);
    expect(tierIcon("rocket")).toBe("medal");
  });
  it("the progress bar is a fraction between 0 and 1, whatever the server sends", () => {
    expect(progressFraction({ progressPercent: 42 })).toBeCloseTo(0.42);
    expect(progressFraction({ progressPercent: 250 })).toBe(1);
    expect(progressFraction({ progressPercent: -5 })).toBe(0);
    expect(progressFraction({ progressPercent: NaN })).toBe(0);
  });
});
