// WHICH CAR a part is for. A pure rule (no database), so it can be tested on its own.
//
// entries: the product's fitment list (rows with generation_id and an optional year); empty = the product fits any car (it is "universal").
// garage:  the buyer's saved cars, the DEFAULT car first, then the newest (rows with generation_id, year, version_id, is_default).
//
//   universal   no fitment list: nothing to verify, no car recorded.
//   no_car      the product is made for specific cars but the buyer has no car (or is a guest).
//   listed      the product's fit list includes a car of the buyer's garage: the DEFAULT car if it fits, else another garage car that does.
//   not_listed  it fits none of them: the default car is shown, with a warning, so the supplier checks before sending.
// "Fits" is the rule of the "Confirmed fit" badge on the website: the car's model (generation) is on the fit list, and, when a fit-list row names a year, the same year. Engine and
// transmission are NOT compared (a garage car's engine is free text): the supplier sees the engine and seats and compares them by eye.
const sameYear = (a, b) => Number(a) === Number(b);

function fits(entries, car) {
  return entries.some((e) => e.generation_id === car.generation_id && (e.year === null || e.year === undefined || sameYear(e.year, car.year)));
}

function chooseCar(entries, garage) {
  if (!entries || entries.length === 0) return { status: 'universal', car: null, isDefault: null };
  if (!garage || garage.length === 0) return { status: 'no_car', car: null, isDefault: null };
  const match = garage.find((car) => fits(entries, car));
  if (match) return { status: 'listed', car: match, isDefault: Boolean(match.is_default) };
  return { status: 'not_listed', car: garage[0], isDefault: Boolean(garage[0].is_default) };
}

module.exports = { fits, chooseCar };
