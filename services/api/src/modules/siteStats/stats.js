// The four real totals shown on the storefront's home page. Every number is counted, never taken from the length of a list that was fetched (which is how "27 parts" used to appear):
//   parts      the parts a buyer can find: products that are active
//   brands     the vehicle brands in the catalog
//   models     the vehicle models in the catalog
//   countries  the countries the shop delivers to: the launch markets (config/markets.js), without the ones on compliance hold
const { LAUNCH_MARKETS, COMPLIANCE_HOLD_COUNTRY_CODES } = require('../../config/markets');

const count = async (q, sql) => Number((await q.query(sql)).rows[0].n);
// What the home page shows for "Countries" (change this number to change it).
const SHOWN_COUNTRIES = 146;

async function loadSiteStats(q) {
  const [parts, brands, models] = await Promise.all([
    count(q, "SELECT count(*) AS n FROM products WHERE status = 'active'"),
    count(q, 'SELECT count(*) AS n FROM vehicle_brands'),
    count(q, 'SELECT count(*) AS n FROM vehicle_models'),
  ]);
  // The countries number on the storefront's home page: set by Leap (146), not counted from the launch markets list.
  const countries = SHOWN_COUNTRIES;
  return { parts, brands, models, countries };
}

module.exports = { loadSiteStats };
