import { NextRequest, NextResponse } from "next/server";
import { fetchProductsPaginated, fetchSameBrand, fetchSameModel } from "@/lib/api";
import { parseGridQuery } from "@/lib/gridSource";
import { NetworkError } from "@/lib/net";
import { createRateLimiter } from "@/lib/rateLimit";
import { networkMessage } from "@/lib/serverMessages";

// The door the browser uses for the NEXT page of a list (lazy loading). The website's own server asks the shop's API, exactly as it does for the first page, so every page of
// a list is made the same way (same 60-second cache shared by all visitors, same delivery estimates), the browser never talks to the API for this, and only a checked,
// small set of questions is passed on. One visitor can ask at most 120 times a minute (behind a proxy the visitor comes from x-forwarded-for).
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });

function visitor(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
}

export async function GET(request: NextRequest) {
  const verdict = limiter.hit(visitor(request));
  if (!verdict.allowed) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } });

  const parsed = parseGridQuery(request.nextUrl.searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { source, page, limit, lang } = parsed;

  let result: { items: unknown[]; total: number | null; unreachable?: boolean };
  try {
    if (source.kind === "sameBrand" || source.kind === "sameModel") {
      const fetchList = source.kind === "sameBrand" ? fetchSameBrand : fetchSameModel;
      result = { items: await fetchList(source.productId, lang, page, limit), total: null };            // this list has no total: a full page means there may be more
    } else if (source.kind === "newest") {
      result = await fetchProductsPaginated({ sort: "newest", page, limit, lang, more: true });
    } else {
      const { q, category, part, generationId, year, versionId } = source.params;
      result = await fetchProductsPaginated({ search: q, category, part, generationId, year, versionId, page, limit, lang, more: true });
    }
  } catch (e) {
    if (e instanceof NetworkError) return NextResponse.json({ error: networkMessage() }, { status: 503 });
    throw e;
  }
  if (result.unreachable) return NextResponse.json({ error: networkMessage() }, { status: 503 });
  // private: the buyer's own browser may keep it for half a minute (going back and forth), a shared cache may not
  return NextResponse.json({ items: result.items, total: result.total }, { headers: { "Cache-Control": "private, max-age=30" } });
}
