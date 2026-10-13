// How a vehicle YEAR is written in a dropdown. A year added through Vehicle Data is a one-year entry named by the year (name "2021", 2021 to 2021): it is shown
// as "2021", not "2021 (2021–2021)". Older entries (a name like "F20" with a range of years) are shown with their range.
export function generationOptionLabel(g, presentWord) {
  const single = g.yearEnd === g.yearStart && String(g.name).trim() === String(g.yearStart);
  return single ? g.name : `${g.name} (${g.yearStart}–${g.yearEnd || presentWord})`;
}
