/** $12.50, as the return instructions show a refund (the refund is kept in US dollars). patch-returns-flow */
export function formatUsd(amount: number): string {
  return `$${Number(amount || 0).toFixed(2)}`;
}
