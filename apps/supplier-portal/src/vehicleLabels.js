// How a vehicle is written and pictured in the supplier portal. A vehicle is picked in three steps: Brand, Model, Year (the admin's Vehicle Data adds them the
// same way). A YEAR added there is a one-year entry named by the year (name "2021", 2021 to 2021) with its own photo; older entries (a name like "F20" with a
// range of years) still exist and stay selectable.

export function isSingleYearEntry(g) {
  return g.yearEnd === g.yearStart && String(g.name).trim() === String(g.yearStart);
}

// A year in a dropdown: a one-year entry is just "2021", not "2021 (2021–2021)"; an older entry keeps its range.
export function generationOptionLabel(g, presentWord) {
  return isSingleYearEntry(g) ? g.name : `${g.name} (${g.yearStart}–${g.yearEnd || presentWord})`;
}

// The years a supplier can choose within one entry: exactly one for a one-year entry, the whole range for an older one (an open-ended range runs to next year).
export function yearsWithin(g, thisYear = new Date().getFullYear()) {
  const end = g.yearEnd || thisYear + 1;
  return Array.from({ length: Math.max(0, end - g.yearStart + 1) }, (_, i) => g.yearStart + i);
}

// The photo shown for the vehicle picked so far: the YEAR's photo once a year is chosen, else the BRAND's (models have no photo), else none (a car icon).
// Both photos are the ones the admin added in Vehicle Data.
export function pickerPhoto({ brand, generation }) {
  if (generation?.photoUrl) return { url: generation.photoUrl, kind: 'year' };
  if (brand?.photoUrl) return { url: brand.photoUrl, kind: 'brand' };
  return { url: null, kind: null };
}

// The line under the photo: "Geely", then "Geely Coolray", then "Geely Coolray, 2021". An older entry adds its name: "BMW 1 Series F20, 2017".
export function vehicleCaption({ brand, model, generation, year }) {
  const parts = [brand?.name, model?.name];
  if (generation && !isSingleYearEntry(generation)) parts.push(generation.name);
  const base = parts.filter(Boolean).join(' ');
  return year ? `${base}, ${year}` : base;
}

// A saved or requested vehicle on one line ("Geely Coolray · 2021"; an older entry: "BMW 1 Series (F20) · 2017"): the generation name is left out when it is
// just the year.
export function vehicleSummary({ brand, model, generation, year }) {
  const showGeneration = generation && String(generation).trim() !== String(year);
  return [brand, model, showGeneration ? `(${generation})` : null, `· ${year}`].filter(Boolean).join(' ');
}
