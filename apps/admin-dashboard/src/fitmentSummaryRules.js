// A part that fits many vehicles, summarised for the admin: one line per MODEL with its years as ranges ("BYD Seal  2022–2024"), the number of models and of different vehicles (a generation and a year).
// The same grouping the server does for buyers (services/api/src/modules/orderVehicles/productCars.js groupFit). Each fitment row carries brandName and modelName (older rows only carry the label "BYD Seal (Seal 2022-2024) · 2022": the name is read from that).

const LABEL = /^(.+?)(?: \(.+\))? · (\d{4})$/;

/** The name of the model a fitment row is for: "BYD Seal"; null when it cannot be told. */
export function fitmentModelName(row) {
  if (row && row.brandName && row.modelName) return `${row.brandName} ${row.modelName}`;
  const m = row && typeof row.label === "string" ? LABEL.exec(row.label) : null;
  return m ? m[1] : null;
}

/** [[2022, 2023], [2025, 2025]] for the years 2022, 2023, 2025 (a year that is not a whole number is ignored). */
export function yearRanges(years) {
  const ys = [...new Set(years.filter((y) => Number.isInteger(y)))].sort((a, b) => a - b);
  const ranges = [];
  for (const y of ys) { const last = ranges[ranges.length - 1]; if (last && y === last[1] + 1) last[1] = y; else ranges.push([y, y]); }
  return ranges;
}
export const formatRanges = (ranges) => ranges.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`)).join(", ");

/** { groups: [{ name, ranges, vehicleCount }], models, vehicles } in the order the rows were added; rows whose model cannot be told are counted as vehicles but listed in no group. */
export function summarizeFitment(fitment) {
  const rows = Array.isArray(fitment) ? fitment : [];
  const byName = new Map();
  for (const row of rows) {
    const name = fitmentModelName(row);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(Number(row.year));
  }
  const groups = [...byName].map(([name, years]) => { const ranges = yearRanges(years); return { name, ranges, vehicleCount: ranges.reduce((n, [a, b]) => n + (b - a + 1), 0) }; });
  const vehicles = new Set(rows.map((r) => `${r.generationId}|${r.year}`)).size;
  return { groups, models: groups.length, vehicles };
}
