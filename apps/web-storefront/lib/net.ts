import { networkMessage } from "./serverMessages";

/**
 * The server could not be reached at all (it is not running, or there is no connection): no answer came back. It IS a TypeError (what fetch throws), so code that tells
 * "no answer at all" from "the server refused" (the checkout keeps its duplicate-order key only for the first) keeps working; its message is a friendly one in the page's language.
 */
export class NetworkError extends TypeError {
  constructor() {
    super(networkMessage());
    this.name = "NetworkError";
  }
}

/** fetch that turns "could not connect" into a NetworkError with a readable message. An aborted request is passed on as it is. */
export async function netFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new NetworkError();
  }
}

/** Does the shop's server answer? (A short wait, and the answer is remembered for a few seconds so a busy page does not ask over and over.) */
export async function isShopReachable(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500), next: { revalidate: 5 } } as RequestInit);
    return res.ok;
  } catch {
    return false;
  }
}
