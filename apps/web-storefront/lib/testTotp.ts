// Test only (never imported by the app): the 6-digit code an authenticator app shows, per RFC 6238 (HMAC-SHA1, 30-second steps), the same that the server's otplib checks.
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

export function totpAt(secret: string, atMs: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 30000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** The code for RIGHT NOW. When less than 2 seconds are left in this 30-second step it waits for the next one, so a request cannot arrive after the code expired. */
export async function currentCode(secret: string): Promise<string> {
  const left = 30000 - (Date.now() % 30000);
  if (left < 2000) await new Promise((resolve) => setTimeout(resolve, left + 100));
  return totpAt(secret, Date.now());
}
